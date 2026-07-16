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

const manyOf = (type, count) =>
  Array.from({ length: count }, (_, index) => ({ id: `${type}:${index}`, title: `${type} ${index}` }));

const layoutBottom = (layout) =>
  layout.reduce((lowest, place) => Math.max(lowest, place.top + place.width / place.ratio), 0);

test("film stage height follows its five-column layout", () => {
  const scatter = (count) => stageHeightFor(createScatterLayout(manyOf("film", count), { width: 1280 }, 0, "film"), "scatter");
  assert.ok(scatter(15) > scatter(5));
});

test("stage height grows for narrow screens", () => {
  const scatter = (width) => stageHeightFor(createScatterLayout(manyOf("book", 60), { width }, 0), "scatter");
  assert.ok(scatter(375) > scatter(1280));
});

// 回归：舞台高度曾经照着 dimensions() 的行高另算一遍，和 createTidyLayout 实际用的行高错开，
// 移动端音乐页页脚横线穿过封面中间（实测溢出 497px）。高度必须始终盖住最后一排。
test("stage height contains every cover in tidy and scatter", () => {
  for (const type of ["book", "film", "music"]) {
    for (const width of [375, 768, 1280]) {
      const items = manyOf(type, 206);
      const tidy = createTidyLayout(items, { width }, type);
      assert.ok(stageHeightFor(tidy, "tidy") >= layoutBottom(tidy), `tidy ${type} @${width}`);
      const scatter = createScatterLayout(items, { width }, 0, type);
      assert.ok(stageHeightFor(scatter, "scatter") >= layoutBottom(scatter), `scatter ${type} @${width}`);
    }
  }
});
