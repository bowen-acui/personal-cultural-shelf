import { createHash } from "node:crypto";
import { lstat, mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const BOUNDARIES = [
  "old-data-backed-up",
  "old-covers-backed-up",
  "candidate-data-promoted",
  "candidate-covers-promoted",
];

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function exactKeys(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

async function assertDirectory(target, label) {
  const details = await lstat(target);
  if (!details.isDirectory() || details.isSymbolicLink()) throw new Error(`${label} must be a real directory`);
}

async function fileEntry(root, relativePath) {
  const target = path.join(root, relativePath);
  const details = await lstat(target);
  if (!details.isFile() || details.isSymbolicLink()) throw new Error(`${relativePath} must be a regular file`);
  const contents = await readFile(target);
  return { path: relativePath, size: contents.length, sha256: sha256(contents) };
}

export async function createManifest(root) {
  const resolvedRoot = path.resolve(root);
  const coversRoot = path.join(resolvedRoot, "public/covers");
  await Promise.all([
    assertDirectory(resolvedRoot, "manifest root"),
    assertDirectory(path.join(resolvedRoot, "data"), "manifest data"),
    assertDirectory(path.join(resolvedRoot, "public"), "manifest public"),
    assertDirectory(coversRoot, "manifest covers"),
  ]);
  const coverNames = (await readdir(coversRoot)).sort();
  const covers = [];
  for (const name of coverNames) covers.push(await fileEntry(resolvedRoot, `public/covers/${name}`));
  return {
    schemaVersion: 1,
    data: await fileEntry(resolvedRoot, "data/media.json"),
    covers,
  };
}

function validateManifest(value, label) {
  if (!exactKeys(value, ["schemaVersion", "data", "covers"]) || value.schemaVersion !== 1 || !Array.isArray(value.covers)) {
    throw new Error(`${label} has an invalid root`);
  }
  const entries = [value.data, ...value.covers];
  for (const entry of entries) {
    if (!exactKeys(entry, ["path", "size", "sha256"])
      || typeof entry.path !== "string"
      || !Number.isInteger(entry.size)
      || entry.size < 0
      || !/^[0-9a-f]{64}$/.test(entry.sha256)) {
      throw new Error(`${label} has an invalid file entry`);
    }
  }
  if (value.data.path !== "data/media.json") throw new Error(`${label} has an invalid data path`);
  const coverPaths = value.covers.map((entry) => entry.path);
  if (coverPaths.some((entry) => !/^public\/covers\/[a-f0-9]{12}-(?:320|720)\.webp$/.test(entry))) {
    throw new Error(`${label} has an invalid cover path`);
  }
  if (JSON.stringify(coverPaths) !== JSON.stringify([...new Set(coverPaths)].sort())) {
    throw new Error(`${label} cover paths must be unique and sorted`);
  }
  return value;
}

export async function writeManifest(root, out) {
  const output = path.resolve(out);
  await rm(output, { force: true });
  const manifest = await createManifest(root);
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

export async function compareManifestFiles(expectedPath, actualPath) {
  const [expectedText, actualText] = await Promise.all([readFile(expectedPath, "utf8"), readFile(actualPath, "utf8")]);
  let expected;
  let actual;
  try {
    expected = validateManifest(JSON.parse(expectedText), "expected manifest");
    actual = validateManifest(JSON.parse(actualText), "actual manifest");
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("manifest is not valid JSON");
    throw error;
  }
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error("manifests differ");
}

async function pathExists(target) {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function rollbackPromotion(paths, state) {
  if (state.candidateCoversPromoted) await rename(paths.projectCovers, paths.candidateCovers);
  if (state.candidateDataPromoted) await rename(paths.projectData, paths.candidateData);
  if (state.oldCoversBackedUp) await rename(paths.backupCovers, paths.projectCovers);
  if (state.oldDataBackedUp) await rename(paths.backupData, paths.projectData);
  await rm(paths.backupRoot, { recursive: true, force: true });
}

export async function promoteLibrary({ candidate, projectRoot, lock, receipt, failAfter = "" }) {
  const candidateRoot = path.resolve(candidate);
  const resolvedProject = path.resolve(projectRoot);
  const lockPath = path.resolve(lock);
  const receiptPath = path.resolve(receipt);
  if (candidateRoot === resolvedProject) throw new Error("candidate and project root must differ");
  const [candidateStat, projectStat] = await Promise.all([stat(candidateRoot), stat(resolvedProject)]);
  if (candidateStat.dev !== projectStat.dev) throw new Error("candidate and project root must share a filesystem");
  const paths = {
    backupRoot: path.join(resolvedProject, ".task2-library-backup"),
    backupData: path.join(resolvedProject, ".task2-library-backup/media.json"),
    backupCovers: path.join(resolvedProject, ".task2-library-backup/covers"),
    projectData: path.join(resolvedProject, "data/media.json"),
    projectCovers: path.join(resolvedProject, "public/covers"),
    candidateData: path.join(candidateRoot, "data/media.json"),
    candidateCovers: path.join(candidateRoot, "public/covers"),
  };
  const startedAt = new Date().toISOString();
  let lockHandle;
  const state = {
    backupCreated: false,
    oldDataBackedUp: false,
    oldCoversBackedUp: false,
    candidateDataPromoted: false,
    candidateCoversPromoted: false,
  };
  let committed = false;
  let receiptManaged = false;
  try {
    lockHandle = await open(lockPath, "wx", 0o600);
    await lockHandle.writeFile(`${JSON.stringify({ pid: process.pid, candidate: candidateRoot, projectRoot: resolvedProject, startedAt })}\n`);
    await lockHandle.sync();
    await rm(receiptPath, { force: true });
    receiptManaged = true;
    if (await pathExists(paths.backupRoot)) throw new Error(`stale backup exists: ${paths.backupRoot}`);
    const [productBefore, candidateManifest] = await Promise.all([createManifest(resolvedProject), createManifest(candidateRoot)]);
    await mkdir(paths.backupRoot);
    state.backupCreated = true;

    await rename(paths.projectData, paths.backupData);
    state.oldDataBackedUp = true;
    if (failAfter === BOUNDARIES[0]) throw new Error(`injected failure after ${BOUNDARIES[0]}`);
    await rename(paths.projectCovers, paths.backupCovers);
    state.oldCoversBackedUp = true;
    if (failAfter === BOUNDARIES[1]) throw new Error(`injected failure after ${BOUNDARIES[1]}`);
    await rename(paths.candidateData, paths.projectData);
    state.candidateDataPromoted = true;
    if (failAfter === BOUNDARIES[2]) throw new Error(`injected failure after ${BOUNDARIES[2]}`);
    await rename(paths.candidateCovers, paths.projectCovers);
    state.candidateCoversPromoted = true;
    if (failAfter === BOUNDARIES[3]) throw new Error(`injected failure after ${BOUNDARIES[3]}`);

    const promotedManifest = await createManifest(resolvedProject);
    if (JSON.stringify(promotedManifest) !== JSON.stringify(candidateManifest)) throw new Error("promoted manifest differs from candidate");
    const promotionReceipt = {
      schemaVersion: 1,
      result: "PASS",
      startedAt,
      finishedAt: new Date().toISOString(),
      boundaries: BOUNDARIES,
      productBeforeManifestSha256: sha256(JSON.stringify(productBefore)),
      candidateManifestSha256: sha256(JSON.stringify(candidateManifest)),
      promotedManifestSha256: sha256(JSON.stringify(promotedManifest)),
      dataSha256: promotedManifest.data.sha256,
      coverFiles: promotedManifest.covers.length,
      backupsRemoved: true,
    };
    await writeFile(receiptPath, `${JSON.stringify(promotionReceipt, null, 2)}\n`, "utf8");
    if (failAfter === "receipt-write") throw new Error("injected failure at receipt-write");
    if (failAfter === "backup-removal") throw new Error("injected failure at backup-removal");
    await rm(paths.backupRoot, { recursive: true });
    committed = true;
    return promotionReceipt;
  } catch (error) {
    const rollbackErrors = [];
    if (!committed && receiptManaged) {
      try {
        await rm(receiptPath, { force: true });
      } catch (receiptError) {
        rollbackErrors.push(receiptError);
      }
    }
    if (!committed && Object.values(state).some(Boolean)) {
      try {
        await rollbackPromotion(paths, state);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length > 0) throw new AggregateError([error, ...rollbackErrors], "promotion failed and rollback was incomplete");
    throw error;
  } finally {
    if (lockHandle) await lockHandle.close();
    if (lockHandle) await rm(lockPath, { force: true });
  }
}

function option(argv, name) {
  const matches = argv.flatMap((value, index) => value === name ? [index] : []);
  if (matches.length !== 1 || !argv[matches[0] + 1] || argv[matches[0] + 1].startsWith("--")) {
    throw new Error(`${name} is required exactly once`);
  }
  return argv[matches[0] + 1];
}

async function main(argv) {
  if (argv[0] === "--manifest-only" && argv.length === 5) {
    const manifest = await writeManifest(option(argv, "--root"), option(argv, "--out"));
    process.stdout.write(`Manifest PASS: ${manifest.covers.length} cover files\n`);
    return;
  }
  if (argv[0] === "--compare-manifests" && argv.length === 3) {
    await compareManifestFiles(argv[1], argv[2]);
    process.stdout.write("Manifest comparison PASS\n");
    return;
  }
  if (argv[0] === "--self-test" && argv.length === 3) {
    const { runPromoteLibrarySelfTest } = await import("../.omo/evidence/personal-cultural-shelf-smoothness-audit/self-test-promote-library.mjs");
    await runPromoteLibrarySelfTest({ tmpRoot: option(argv, "--tmp-root"), promoteLibrary, promoterPath: process.argv[1] });
    return;
  }
  if (argv.length !== 8) throw new Error("unknown or malformed arguments");
  const receipt = await promoteLibrary({
    candidate: option(argv, "--candidate"),
    projectRoot: option(argv, "--project-root"),
    lock: option(argv, "--lock"),
    receipt: option(argv, "--receipt"),
  });
  process.stdout.write(`Promotion PASS: ${receipt.coverFiles} cover files\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2));
