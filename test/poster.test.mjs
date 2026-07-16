import test from "node:test";
import assert from "node:assert/strict";

import { coverPlacement, coverRatio, posterSlot } from "../lib/poster.js";

const near = (a, b) => Math.abs(a - b) < 0.01;

test("music slot is a centered square inside the tall slot", () => {
  const slot = posterSlot(0);
  const box = { x: slot.x, y: slot.y + (slot.height - slot.width) / 2, size: slot.width };
  // 正方形封面应正好铺满正方形可视框，不多不少。
  const place = coverPlacement({ naturalWidth: 320, naturalHeight: 320 }, slot, "music");
  assert.ok(near(place.width, box.size) && near(place.height, box.size), "square fills the square box");
  assert.ok(near(place.x, box.x) && near(place.y, box.y), "centered in the square box");
});

test("a wide cover keeps its full width and is never cropped", () => {
  const slot = posterSlot(1);
  // 320x180 是库里最扁的封面，旧实现只画得出 38%。
  const place = coverPlacement({ naturalWidth: 320, naturalHeight: 180 }, slot, "book");
  assert.ok(place.width <= slot.width + 0.01, "does not exceed the slot width");
  assert.ok(near(place.width / place.height, 320 / 180), "aspect ratio preserved, no crop");
  assert.ok(place.x >= slot.x - 0.01, "stays inside the slot horizontally");
});

test("a tall cover keeps its full height inside the book slot", () => {
  const slot = posterSlot(2);
  const place = coverPlacement({ naturalWidth: 200, naturalHeight: 400 }, slot, "book");
  assert.ok(place.height <= slot.height + 0.01, "does not exceed the slot height");
  assert.ok(near(place.width / place.height, 200 / 400), "aspect ratio preserved, no crop");
  assert.ok(place.y >= slot.y - 0.01, "stays inside the slot vertically");
});

test("every cover stays within its slot regardless of source ratio", () => {
  const ratios = [[320, 180], [320, 480], [93, 130], [200, 200], [640, 200]];
  for (let position = 0; position < ratios.length; position += 1) {
    const slot = posterSlot(position);
    for (const type of ["book", "film", "music"]) {
      const [w, h] = ratios[position];
      const place = coverPlacement({ naturalWidth: w, naturalHeight: h }, slot, type);
      const boxHeight = type === "music" ? slot.width : slot.height;
      const boxTop = slot.y + (slot.height - boxHeight) / 2;
      assert.ok(place.x >= slot.x - 0.01, `${type} ${w}x${h} left`);
      assert.ok(place.x + place.width <= slot.x + slot.width + 0.01, `${type} ${w}x${h} right`);
      assert.ok(place.y >= boxTop - 0.01, `${type} ${w}x${h} top`);
      assert.ok(place.y + place.height <= boxTop + boxHeight + 0.01, `${type} ${w}x${h} bottom`);
      assert.ok(near(place.width / place.height, w / h), `${type} ${w}x${h} ratio preserved`);
    }
  }
});

test("coverRatio still reports the intended shapes", () => {
  assert.equal(coverRatio("music"), 1);
  assert.equal(coverRatio("book"), 2 / 3);
});
