import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

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
