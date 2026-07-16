import test from "node:test";
import assert from "node:assert/strict";

import { pathForType, typeFromPath } from "../lib/routes.js";

test("typeFromPath reads the media type off the page name", () => {
  assert.equal(typeFromPath("/film.html"), "film");
  assert.equal(typeFromPath("/music.html"), "music");
  assert.equal(typeFromPath("/"), "book");
  assert.equal(typeFromPath("/index.html"), "book");
  assert.equal(typeFromPath(), "book");
});

test("typeFromPath survives the GitHub Pages project subpath", () => {
  assert.equal(typeFromPath("/personal-cultural-shelf/film.html"), "film");
  assert.equal(typeFromPath("/personal-cultural-shelf/music.html"), "music");
  assert.equal(typeFromPath("/personal-cultural-shelf/"), "book");
  assert.equal(typeFromPath("/personal-cultural-shelf/index.html"), "book");
});

test("typeFromPath does not match a page that merely ends in the same letters", () => {
  assert.equal(typeFromPath("/short-film.html"), "book");
});

test("pathForType stays relative so both deploy targets resolve it", () => {
  assert.equal(pathForType("book"), "./");
  assert.equal(pathForType("film"), "./film.html");
  assert.equal(pathForType("music"), "./music.html");
});
