import { execFileSync } from "node:child_process";
import { access, copyFile, mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createManifest, promoteLibrary } from "./promote-library.mjs";
import { buildSubset, verifyFont } from "./subset-font.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildScript = path.join(projectRoot, "scripts/build-library.mjs");
const sourceFont = path.join(projectRoot, "public/fonts/lxgw-wenkai-regular.ttf");
const committedFont = path.join(projectRoot, "public/fonts/lxgw-wenkai-subset.woff2");

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function runCandidateBuild(candidateRoot) {
  execFileSync(process.execPath, [buildScript], {
    cwd: projectRoot,
    env: { ...process.env, BUILD_OUTPUT_ROOT: candidateRoot },
    stdio: "inherit",
  });
}

async function prepareFont(candidateRoot) {
  const candidateMedia = path.join(candidateRoot, "data/media.json");
  const candidateFont = path.join(candidateRoot, "public/fonts/lxgw-wenkai-subset.woff2");
  await mkdir(path.dirname(candidateFont), { recursive: true });
  if (await exists(sourceFont)) {
    await buildSubset({ sourcePath: sourceFont, mediaPath: candidateMedia, outputPath: candidateFont, verify: true });
    return;
  }
  const result = await verifyFont({ fontPath: committedFont, mediaPath: candidateMedia });
  await copyFile(committedFont, candidateFont);
  process.stdout.write(`Verified existing WOFF2 for ${result.records} candidate records because source TTF is unavailable.\n`);
}

async function syncLibrary(mode) {
  const candidateRoot = await mkdtemp(path.join(os.tmpdir(), "shelf-candidate-"));
  const controlRoot = await mkdtemp(path.join(os.tmpdir(), "shelf-promotion-"));
  try {
    runCandidateBuild(candidateRoot);
    await prepareFont(candidateRoot);
    const manifest = await createManifest(candidateRoot);
    process.stdout.write(`Candidate manifest PASS: ${manifest.data.size} bytes, ${manifest.covers.length} cover files.\n`);
    if (mode === "check") {
      process.stdout.write("Data check PASS: formal library unchanged.\n");
      return;
    }
    const receipt = await promoteLibrary({
      candidate: candidateRoot,
      projectRoot,
      lock: path.join(controlRoot, "promotion.lock"),
      receipt: path.join(controlRoot, "promotion-receipt.json"),
    });
    process.stdout.write(`Library promotion PASS: data=${receipt.dataSha256} font=${receipt.fontSha256}.\n`);
  } finally {
    await Promise.all([
      rm(candidateRoot, { recursive: true, force: true }),
      rm(controlRoot, { recursive: true, force: true }),
    ]);
  }
}

async function main(argv) {
  if (argv.length !== 1 || !["--check", "--promote"].includes(argv[0])) {
    throw new Error("usage: node scripts/sync-library.mjs --check|--promote");
  }
  await syncLibrary(argv[0] === "--check" ? "check" : "promote");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
