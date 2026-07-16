import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { charsetFromMedia } from "../scripts/subset-font.mjs";

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
