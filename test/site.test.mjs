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

test("public pages expose local identity assets", async () => {
  const pages = await Promise.all(["index", "film", "music", "browse", "about"].map((name) => readFile(new URL(`../${name}.html`, import.meta.url), "utf8")));
  assert.ok(pages.every((page) => page.includes("favicon.svg") && page.includes("og:title")));
  assert.match(await readFile(new URL("../404.html", import.meta.url), "utf8"), /返回陈列/);
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

test("media objects open a same-page flipping detail object", async () => {
  const [app, index, shelf] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../shelf.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(app, /addEventListener\("dblclick"/);
  assert.match(app, /function openWork/);
  assert.match(app, /完读日期/);
  assert.match(app, /workDialog\.showModal\(\)/);
  assert.match(app, /Array\.from\(\{ length: 5 \}/);
  assert.doesNotMatch(app, /function focusObject/);
  assert.match(index, /id="work-dialog"/);
  assert.match(index, /class="control-catalog" href="browse\.html">目录 →<\/a>/);
  assert.match(shelf, /transition-timing-function:cubic-bezier\(.2,.8,.2,1\)/);
  assert.match(shelf, /rotateY\(180deg\)/);
  assert.match(shelf, /LXGW WenKai/);
});

test("shelf pages expose synchronized metadata and keyboard entry points", async () => {
  const pages = await Promise.all(["index", "film", "music", "browse", "about"].map((name) => readFile(new URL(`../${name}.html`, import.meta.url), "utf8")));
  assert.ok(pages.every((page) => page.includes('class="skip-link"')));
  assert.ok(pages.every((page) => page.includes('meta name="description"')));
  assert.match(pages[0], /data-mode="scatter" aria-pressed="true"/);
  assert.match(pages[0], /data-mode="tidy" aria-pressed="false"/);
  assert.match(pages[0], /aria-labelledby="poster-title"/);
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /const pageMeta =/);
  assert.match(app, /document\.title = meta\.title/);
  assert.match(app, /filterPanel\.querySelector\("\.filter-pill"\)\?\.focus\(\)/);
  assert.match(app, /\.media-object:not\(\[aria-hidden="true"\]\)/);
  assert.doesNotMatch(app, /stateMessage\.innerHTML/);
});

test("shelf controls use one continuous rhythm with count and catalog", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /class="control-stat"/);
  assert.equal((html.match(/class="control-divider"/g) ?? []).length, 2);
  assert.match(html, /class="control-catalog" href="browse\.html">目录 →<\/a>/);
  assert.doesNotMatch(html, /control-destination/);
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
