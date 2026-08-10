import test from "node:test";
import assert from "node:assert/strict";

import {
  createScatterLayout,
  createTidyLayout,
  createVortexLayout,
  placementIntersectsViewportMargin,
  stageHeightFor,
  topVortexLayerIndexes,
  viewportPriorityIndexes,
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

test("viewport margin includes exact edges and excludes placements beyond them", () => {
  // Given: a 200px viewport starting at y=100 with a 50% vertical margin.
  const viewport = { top: 100, height: 200 };
  const placement = { width: 10, ratio: 1 };

  // When: covers touch or cross either expanded edge.
  // Then: touching edges count, while a sub-pixel gap does not.
  assert.equal(placementIntersectsViewportMargin({ ...placement, top: -10 }, viewport), true);
  assert.equal(placementIntersectsViewportMargin({ ...placement, top: -10.01 }, viewport), false);
  assert.equal(placementIntersectsViewportMargin({ ...placement, top: 400 }, viewport), true);
  assert.equal(placementIntersectsViewportMargin({ ...placement, top: 400.01 }, viewport), false);
});

test("viewport priority selects only the nearest twelve visible placements", () => {
  // Given: twenty covers intersecting the actual viewport.
  const placements = Array.from({ length: 20 }, (_, index) => ({
    top: index * 10,
    width: 10,
    ratio: 1,
  }));

  // When: initial high-priority indexes are selected.
  const indexes = viewportPriorityIndexes(placements, { top: 0, height: 200 });

  // Then: selection is capped at twelve and ordered nearest the viewport centre.
  assert.deepEqual(indexes, [9, 10, 8, 11, 7, 12, 6, 13, 5, 14, 4, 15]);
});

test("vortex priority selects only the top thirty-six layers", () => {
  // Given: fifty placements with ascending layers.
  const placements = Array.from({ length: 50 }, (_, index) => ({ layer: index + 1 }));

  // When: the visible vortex front is selected.
  const indexes = topVortexLayerIndexes(placements);

  // Then: only the top thirty-six indexes remain, highest layer first.
  assert.deepEqual(indexes, Array.from({ length: 36 }, (_, index) => 49 - index));
});
