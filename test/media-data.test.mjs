import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

import { validateMediaData } from "../lib/media-data.js";

const good = (id, extra = {}) => ({ id, type: "book", title: id, cover: "public/covers/a-320.webp", ...extra });

function captureWarnings(run) {
  const warnings = [];
  const original = console.warn;
  console.warn = (message) => warnings.push(message);
  try {
    return { result: run(), warnings };
  } finally {
    console.warn = original;
  }
}

test("generated media catalog contains the three real shelves", async () => {
  const records = JSON.parse(await readFile(new URL("../data/media.json", import.meta.url), "utf8"));
  const counts = records.reduce((result, item) => {
    result[item.type] = (result[item.type] ?? 0) + 1;
    return result;
  }, {});
  assert.ok(records.length > 0);
  assert.ok(["book", "film", "music"].every((type) => counts[type] > 0));
  assert.equal(new Set(records.map((item) => item.id)).size, records.length);
  assert.ok(records.every((item) => !Object.hasOwn(item, "year") && item.title && item.cover));
  assert.ok(records.every((item) => item.coverLarge && item.cover.endsWith("-320.webp") && item.coverLarge.endsWith("-720.webp")));
  assert.ok(records.filter((item) => item.type !== "book").every((item) => !Object.hasOwn(item, "completedMonth")));
  assert.ok(records.filter((item) => item.type === "book" && item.completedMonth).every((item) => /^\d{4}-\d{2}$/.test(item.completedMonth)));
  assert.ok(records.filter((item) => item.rating !== undefined).every((item) => Number.isInteger(item.rating) && item.rating >= 1 && item.rating <= 5));
  assert.ok(records.filter((item) => item.type !== "book").every((item) => !Object.hasOwn(item, "rating")));
  await Promise.all(records.map((item) => access(new URL(`../${item.cover}`, import.meta.url))));
  await Promise.all(records.map((item) => access(new URL(`../${item.coverLarge}`, import.meta.url))));
});

test("validateMediaData keeps every record when the data is clean", () => {
  const { result, warnings } = captureWarnings(() => validateMediaData([good("book:a"), good("book:b")]));
  assert.deepEqual(result.map((item) => item.id), ["book:a", "book:b"]);
  assert.deepEqual(warnings, []);
});

test("validateMediaData skips a broken record and names it instead of blanking the site", () => {
  const { result, warnings } = captureWarnings(() =>
    validateMediaData([good("book:a"), { id: "book:broken", type: "book", title: 42 }, good("book:b")]),
  );
  assert.deepEqual(result.map((item) => item.id), ["book:a", "book:b"]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /book:broken/);
});

test("validateMediaData falls back to the index when a broken record has no id", () => {
  const { warnings } = captureWarnings(() => validateMediaData([good("book:a"), null]));
  assert.match(warnings[0], /#1/);
});

test("validateMediaData still throws on duplicate ids — that is a build bug", () => {
  assert.throws(() => validateMediaData([good("book:a"), good("book:a")]), /重复 ID/);
});

test("validateMediaData still throws when the payload is not an array", () => {
  assert.throws(() => validateMediaData({ id: "book:a" }), /不是数组/);
});

test("the build-time 置顶 field never reaches the public payload", async () => {
  const records = JSON.parse(await readFile(new URL("../data/media.json", import.meta.url), "utf8"));
  assert.ok(records.every((item) => !Object.hasOwn(item, "pinned") && !Object.hasOwn(item, "置顶")));
});
