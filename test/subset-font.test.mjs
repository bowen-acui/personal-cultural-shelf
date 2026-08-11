import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { charsetFromMedia } from "../scripts/subset-font.mjs";

const scriptPath = fileURLToPath(new URL("../scripts/subset-font.mjs", import.meta.url));
const mediaPath = fileURLToPath(new URL("../data/media.json", import.meta.url));
const committedFontPath = fileURLToPath(new URL("../public/fonts/lxgw-wenkai-subset.woff2", import.meta.url));

function runSubsetFont(...args) {
  return spawnSync(process.execPath, [scriptPath, ...args], { encoding: "utf8" });
}

// 海报画布用 LXGW WenKai 画这行标题（lib/poster.js），字体是子集，缺字就是豆腐块。
const POSTER_TITLE = "阿崔的精神地图 · 书影音";

test("the subset covers the poster title even with an empty library", () => {
  // 传空数组 = 只剩固定文案。藏品数据顺带覆盖不算数：
  // 一条笔记删掉就可能带走某个字，海报是站点自己的文案，不该受藏品增删影响。
  const charset = new Set(charsetFromMedia([]));
  const missing = [...POSTER_TITLE].filter((character) => !charset.has(character));
  assert.deepEqual(missing, [], `固定文案未覆盖海报标题用字：${missing.join(" ")}`);
});

test("the subset covers every title and creator in the real library", async () => {
  const records = JSON.parse(await readFile(new URL("../data/media.json", import.meta.url), "utf8"));
  const charset = new Set(charsetFromMedia(records));
  const missing = new Set();
  for (const record of records) {
    for (const value of [record.title, record.creator, ...(record.categories ?? [])]) {
      for (const character of String(value ?? "")) if (!charset.has(character)) missing.add(character);
    }
  }
  assert.deepEqual([...missing], []);
});

test("the committed WOFF2 passes verification through the explicit CLI mode", () => {
  const result = runSubsetFont("--verify-only", "--font", committedFontPath, "--media", mediaPath);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Verified .*cmap/);
});

test("verify-only rejects a missing font instead of silently skipping", () => {
  const result = runSubsetFont("--verify-only", "--font", path.join(os.tmpdir(), "missing-shelf-font.woff2"), "--media", mediaPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not found|ENOENT/i);
});

test("self-test-missing proves an omitted codepoint fails in an isolated root", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "shelf-subset-test-"));
  try {
    const result = runSubsetFont("--self-test-missing", "U+963F", "--tmp-root", tmpRoot);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /rejected the intentionally incomplete font/i);
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
});
