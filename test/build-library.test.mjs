import test from "node:test";
import assert from "node:assert/strict";

import {
  isDisplayableBook,
  parseFrontmatter,
  isDisplayableMedia,
  completedMonth,
  publicRating,
  toPublicMedia,
  toPublicBook,
  orphanCoverNames,
  resolveVaultRoot,
  validateUniqueRecords,
  sortMediaRecords,
  pinnedRank,
} from "../lib/build-utils.mjs";

test("parseFrontmatter reads quoted scalars and dates", () => {
  const note = `---
书名: "黑天鹅"
作者: "纳西姆•尼古拉斯•塔勒布"
封面: "照片/书架/黑天鹅.jpg"
状态: 读完待整理
完读日期: 2024-08-23
分类:
  - 投资
  - 思维
评分: 5
---

## 私人摘抄
不会公开`;

  assert.deepEqual(parseFrontmatter(note), {
    书名: "黑天鹅",
    作者: "纳西姆•尼古拉斯•塔勒布",
    封面: "照片/书架/黑天鹅.jpg",
    状态: "读完待整理",
    完读日期: "2024-08-23",
    分类: ["投资", "思维"],
    评分: "5",
  });
});

test("isDisplayableBook requires a cover and completed reading evidence", () => {
  assert.equal(
    isDisplayableBook({ 封面: "covers/book.jpg", 完读日期: "2024-01-02" }),
    true,
  );
  assert.equal(
    isDisplayableBook({ 封面: "covers/book.jpg", 状态: "已读" }),
    true,
  );
  assert.equal(
    isDisplayableBook({ 封面: "covers/book.jpg", 状态: "想读" }),
    false,
  );
  assert.equal(
    isDisplayableBook({ 封面: "covers/book.jpg", 状态: "未完成" }),
    false,
  );
  assert.equal(isDisplayableBook({ 状态: "已读" }), false);
});

test("completedMonth keeps only the year and month", () => {
  assert.equal(completedMonth("2024-08-23"), "2024-08");
  assert.equal(completedMonth("2024年8月"), "2024-08");
  assert.equal(completedMonth(""), "");
});

test("publicRating accepts only whole scores from one to five", () => {
  assert.equal(publicRating("5"), 5);
  assert.equal(publicRating(3), 3);
  assert.equal(publicRating("4.5"), 0);
  assert.equal(publicRating(6), 0);
  assert.equal(publicRating(""), 0);
});

test("toPublicBook exposes only display fields", () => {
  const publicBook = toPublicBook(
    "黑天鹅.md",
    {
      书名: "黑天鹅",
      作者: "纳西姆•尼古拉斯•塔勒布",
      封面: "照片/书架/黑天鹅.jpg",
      完读日期: "2024-08-23",
      分类: ["投资", "思维"],
      ISBN: "9787508698823",
      评分: "5",
      来源: "book_search",
    },
    "covers/black-swan.jpg",
  );

  assert.deepEqual(publicBook, {
    id: "book:黑天鹅",
    type: "book",
    title: "黑天鹅",
    creator: "纳西姆•尼古拉斯•塔勒布",
    cover: "covers/black-swan.jpg",
    categories: ["投资", "思维"],
    completedMonth: "2024-08",
    rating: 5,
  });
  assert.equal("ISBN" in publicBook, false);
  assert.equal("评分" in publicBook, false);
  assert.equal("来源" in publicBook, false);
});

test("toPublicBook falls back to the filename and omits missing optional fields", () => {
  assert.deepEqual(
    toPublicBook("围城.md", { 封面: "照片/围城.jpg" }, "covers/fortress.jpg"),
    {
      id: "book:围城",
      type: "book",
      title: "围城",
      cover: "covers/fortress.jpg",
      categories: [],
    },
  );
});

test("media records use the folder type and never expose dates", () => {
  const metadata = {
    名称: "一一",
    创作者: "杨德昌",
    封面: "附件/电影封面/一一.jpg",
    分类: ["剧情", ""],
    完成日期: "2024-01-01",
    评分: "5",
  };
  assert.equal(isDisplayableMedia(metadata), true);
  assert.deepEqual(toPublicMedia("一一.md", metadata, "covers/one-one.jpg", "film"), {
    id: "film:一一",
    type: "film",
    title: "一一",
    creator: "杨德昌",
    cover: "covers/one-one.jpg",
    categories: ["剧情"],
  });
  assert.equal("completedMonth" in toPublicMedia("一一.md", { ...metadata, 完读日期: "2024-01-01" }, "covers/one-one.jpg", "film"), false);
  assert.equal("rating" in toPublicMedia("一一.md", metadata, "covers/one-one.jpg", "film"), false);
  assert.equal(isDisplayableMedia({ 名称: "", 封面: "cover.jpg" }), false);
});

test("vault root is portable and duplicate ids are rejected", () => {
  assert.equal(resolveVaultRoot({}, "/Users/example"), "/Users/example/Documents/obsidian/阿崔");
  assert.equal(resolveVaultRoot({ OBSIDIAN_VAULT: "/vault" }, "/Users/example"), "/vault");
  assert.throws(() => validateUniqueRecords([{ id: "book:a" }, { id: "book:a" }]), /Duplicate media id: book:a/);
});

test("orphan cover names only includes generated, unreferenced files", () => {
  assert.deepEqual(orphanCoverNames(["abc123abc123-320.webp", "def456def456-720.webp", "manual-note.txt"], new Set(["abc123abc123-320.webp"])), ["def456def456-720.webp"]);
});

test("book records sort from five stars to one while other shelves keep title order", () => {
  const records = [
    { id: "music:z", type: "music", title: "乙" },
    { id: "book:two", type: "book", title: "乙", rating: 2 },
    { id: "book:five", type: "book", title: "丙", rating: 5 },
    { id: "book:none", type: "book", title: "甲" },
    { id: "film:a", type: "film", title: "甲" },
    { id: "book:four", type: "book", title: "甲", rating: 4 },
    { id: "music:a", type: "music", title: "甲" },
  ];
  sortMediaRecords(records);
  assert.deepEqual(records.map((item) => item.id), ["book:five", "book:four", "book:two", "book:none", "film:a", "music:a", "music:z"]);
});

test("pinnedRank reads the 置顶 frontmatter field and defaults to the back", () => {
  assert.equal(pinnedRank({ 置顶: "0" }), 0);
  assert.equal(pinnedRank({ 置顶: "3" }), 3);
  assert.equal(pinnedRank({}), 99);
  assert.equal(pinnedRank({ 置顶: "" }), 99);
  assert.equal(pinnedRank({ 置顶: "第一" }), 99);
});

test("film and music records honor 置顶 before their usual ordering", () => {
  const records = [
    { id: "film:late", type: "film", title: "乙", doubanRating: 9.5 },
    { id: "film:pinned", type: "film", title: "甲", doubanRating: 6, pinned: 0 },
    { id: "music:late", type: "music", title: "甲" },
    { id: "music:pinned", type: "music", title: "乙", pinned: 1 },
  ];
  sortMediaRecords(records);
  assert.deepEqual(records.map((item) => item.id), ["film:pinned", "film:late", "music:pinned", "music:late"]);
});
