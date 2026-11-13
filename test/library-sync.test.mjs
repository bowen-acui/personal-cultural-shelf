import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const buildScript = path.join(projectRoot, "scripts/build-library.mjs");
const coverFixture = path.join(projectRoot, "public/covers/7617e4175015-320.webp");

const sourceDirectories = {
  book: "Project：存放项目的必要信息/閱讀書單 Book Tracker/書櫃",
  film: "Project：存放项目的必要信息/影",
  music: "Project：存放项目的必要信息/音",
};

async function createVault({ includeMissingCover }) {
  const root = await mkdtemp(path.join(os.tmpdir(), "shelf-vault-"));
  const coverPath = path.join(root, "source-cover.webp");
  await copyFile(coverFixture, coverPath);
  for (const directory of Object.values(sourceDirectories)) await mkdir(path.join(root, directory), { recursive: true });
  await writeFile(path.join(root, sourceDirectories.book, "有效作品.md"), `---\n书名: 有效作品\n封面: source-cover.webp\n完读日期: 2024-01-01\n---\n`, "utf8");
  if (includeMissingCover) {
    await writeFile(path.join(root, sourceDirectories.book, "王川宝典.md"), `---\n书名: 王川宝典\n状态: 读完待整理\n---\n`, "utf8");
  }
  return root;
}

function runBuild(vaultRoot, outputRoot) {
  return spawnSync(process.execPath, [buildScript], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env, OBSIDIAN_VAULT: vaultRoot, BUILD_OUTPUT_ROOT: outputRoot },
  });
}

test("candidate build blocks a completed note without a cover before writing media data", async () => {
  const vaultRoot = await createVault({ includeMissingCover: true });
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "shelf-output-"));
  try {
    const result = runBuild(vaultRoot, outputRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /Source audit: included=1 skipped=0 errors=1/);
    assert.match(result.stdout, /ERROR book\/王川宝典\.md missing-cover/);
    await assert.rejects(readFile(path.join(outputRoot, "data/media.json")), { code: "ENOENT" });
  } finally {
    await Promise.all([rm(vaultRoot, { recursive: true, force: true }), rm(outputRoot, { recursive: true, force: true })]);
  }
});

test("candidate build writes one valid record when every publishable note has a cover", async () => {
  const vaultRoot = await createVault({ includeMissingCover: false });
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "shelf-output-"));
  try {
    const result = runBuild(vaultRoot, outputRoot);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Source audit: included=1 skipped=0 errors=0/);
    const records = JSON.parse(await readFile(path.join(outputRoot, "data/media.json"), "utf8"));
    assert.deepEqual(records.map((record) => record.title), ["有效作品"]);
    assert.ok(records[0].cover.endsWith("-320.webp"));
    assert.ok(records[0].coverLarge.endsWith("-720.webp"));
    assert.equal(records[0].aspectRatio, 1);
  } finally {
    await Promise.all([rm(vaultRoot, { recursive: true, force: true }), rm(outputRoot, { recursive: true, force: true })]);
  }
});
