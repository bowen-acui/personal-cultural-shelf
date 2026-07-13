import test from "node:test";
import assert from "node:assert/strict";

import {
  createScatterLayout,
  createTidyLayout,
  createVortexLayout,
  stageHeightFor,
} from "../lib/layouts.js";

const items = Array.from({ length: 12 }, (_, index) => ({
  id: `book:${index}`,
  title: `Book ${index}`,
}));

test("scatter is deterministic for a seed and stays inside the stage", () => {
  const first = createScatterLayout(items, { width: 900 }, 4);
  const second = createScatterLayout(items, { width: 900 }, 4);
  assert.deepEqual(first, second);
  assert.ok(first.every((item) => item.left >= 16 && item.left + item.width <= 884));
  assert.ok(first.some((item) => item.rotation !== 0));
});

test("tidy creates an unrotated regular grid", () => {
  const layout = createTidyLayout(items, { width: 900 });
  assert.ok(layout.every((item) => item.rotation === 0 && item.width === 80));
  assert.equal(layout[1].left - layout[0].left, 92);
});

test("vortex pulls covers toward the center", () => {
  const layout = createVortexLayout(items, { width: 900, height: 700 });
  assert.ok(layout.every((item) => item.scale === 0.3));
  assert.ok(layout.every((item) => Math.abs(item.left - 410) < 100));
});

test("film scatter uses a wider dramatic spread than a book pile", () => {
  const films = Array.from({ length: 5 }, (_, index) => ({ id: `film:${index}`, title: `Film ${index}` }));
  const layout = createScatterLayout(films, { width: 1280 }, 0, "film");
  assert.ok(layout.at(-1).left > 900);
  assert.ok(layout.every((item) => item.width >= 130));
});

test("film stage height follows its five-column layout", () => {
  assert.ok(stageHeightFor(15, 1280, "scatter", "film") > stageHeightFor(5, 1280, "scatter", "film"));
});

test("stage height grows for narrow screens", () => {
  const desktop = stageHeightFor(60, 1280, "scatter");
  const mobile = stageHeightFor(60, 375, "scatter");
  assert.ok(mobile > desktop);
});
