import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { buildSubset, charsetFromMedia, verifyFont } from "../scripts/subset-font.mjs";

const scriptPath = fileURLToPath(new URL("../scripts/subset-font.mjs", import.meta.url));
const mediaPath = fileURLToPath(new URL("../data/media.json", import.meta.url));
const committedFontPath = fileURLToPath(new URL("../public/fonts/lxgw-wenkai-subset.woff2", import.meta.url));
const sourceFontPath = fileURLToPath(new URL("../assets/fonts/lxgw-wenkai-regular.ttf", import.meta.url));

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

test("default mode verifies the committed WOFF2 without changing it", async () => {
  const before = createHash("sha256").update(await readFile(committedFontPath)).digest("hex");
  const result = runSubsetFont();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Verified existing WOFF2/);
  const after = createHash("sha256").update(await readFile(committedFontPath)).digest("hex");
  assert.equal(after, before);
});

test("the pinned source font builds an isolated subset for the new library glyphs", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "shelf-new-glyphs-"));
  const media = path.join(root, "media.json");
  const output = path.join(root, "subset.woff2");
  const record = {
    id: "music:font-regression",
    type: "music",
    title: "É蛙室质网季擱淺變候乙鴿螢粉紅遊戲陽执郭",
    creator: "陈奕迅",
    categories: ["音乐"],
    cover: "public/covers/a-320.webp",
  };
  try {
    await writeFile(media, JSON.stringify([record]), "utf8");
    await buildSubset({ sourcePath: sourceFontPath, mediaPath: media, outputPath: output, verify: true });
    assert.equal((await verifyFont({ fontPath: output, mediaPath: media })).records, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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
