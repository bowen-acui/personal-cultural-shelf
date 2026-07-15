import test from "node:test";
import assert from "node:assert/strict";

import { categoryCounts, filterCatalog, toggleCategory } from "../lib/catalog.js";

const items = [
  { type: "book", title: "黑天鹅", creator: "塔勒布", categories: ["投资", "思维"] },
  { type: "book", title: "反脆弱", creator: "塔勒布", categories: ["思维"] },
  { type: "film", title: "一一", creator: "杨德昌", categories: ["剧情"] },
  { type: "music", title: "Blonde", creator: "Frank Ocean", categories: ["R&B"] },
];

test("catalog filters by search and category", () => {
  assert.deepEqual(filterCatalog(items, "塔勒布", "思维").map((item) => item.title), [
    "黑天鹅",
    "反脆弱",
  ]);
  assert.deepEqual(filterCatalog(items, "Blonde", "全部").map((item) => item.title), ["Blonde"]);
});

test("category counts are sorted by frequency then name", () => {
  assert.deepEqual(categoryCounts(items), [
    ["思维", 2],
    ["剧情", 1],
    ["投资", 1],
    ["R&B", 1],
  ]);
});

test("clicking the active category clears the filter", () => {
  assert.equal(toggleCategory("投资", "投资"), "全部");
  assert.equal(toggleCategory("投资", "思维"), "思维");
});
