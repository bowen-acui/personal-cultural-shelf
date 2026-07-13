import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("site shell exposes the media shelves and reference interactions", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /阿崔的精神地图/);
  assert.match(html, /data-type="book"/);
  assert.match(html, /href="film\.html">影/);
  assert.match(html, /href="music\.html">音/);
  assert.match(html, /data-mode="scatter"/);
  assert.match(html, /data-mode="tidy"/);
  assert.match(html, /data-mode="vortex"/);
  assert.match(html, /data-action="shake"/);
  assert.match(html, /data-action="filter"/);
  assert.match(html, /data-action="share"/);
  assert.match(html, /href="browse\.html"/);
  assert.doesNotMatch(html, /ISBN|出版社|重点摘抄|阅读天数|评分/);
});

test("browse, film, music and about pages exist", async () => {
  const pages = await Promise.all(
    ["browse", "about", "film", "music"].map((name) =>
      readFile(new URL(`../${name}.html`, import.meta.url), "utf8"),
    ),
  );
  assert.ok(pages.every((page) => page.includes("阿崔的精神地图")));
});

test("styles use the documented token and layer scale", async () => {
  const styles = await Promise.all(["styles", "shelf", "pages"].map((name) => readFile(new URL(`../${name}.css`, import.meta.url), "utf8")));
  const css = styles.join("\n");
  assert.doesNotMatch(css, /z-index:(?:8000|9999|10000|10001|10002|10003)/);
  assert.doesNotMatch(css, /--muted:|--line:/);
  assert.match(css, /--ink-muted:/);
  assert.match(css, /--paper-line:/);
  assert.match(css, /--layer-controls:/);
});

test("media objects open a semantic focus layer without double click", async () => {
  const [app, index] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(app, /addEventListener\("dblclick"/);
  assert.match(app, /function showDetails/);
  assert.match(app, /function closeDetails/);
  assert.match(index, /id="detail-dialog"[^>]*aria-labelledby="detail-title"/);
  assert.match(index, /aria-describedby="detail-meta"/);
});

test("shelf controls separate layout, actions and destination", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.equal((html.match(/class="control-group/g) ?? []).length, 3);
  assert.match(html, /class="control-group control-destination"/);
  assert.match(html, /href="browse\.html">目录<\/a>/);
});

test("drag cleanup survives pointer release outside the cover", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(app, /window\.addEventListener\("pointerup", finish, \{ once: true \}\)/);
  assert.match(app, /window\.addEventListener\("pointercancel", finish, \{ once: true \}\)/);
});

test("component styles consume color tokens instead of raw hex values", async () => {
  const styles = await Promise.all(["styles", "shelf", "pages"].map((name) => readFile(new URL(`../${name}.css`, import.meta.url), "utf8")));
  const componentCss = styles.join("\n").replace(/:root\s*\{[^}]+\}/, "");

  assert.doesNotMatch(componentCss, /#[0-9a-fA-F]{3,8}\b/);
});
