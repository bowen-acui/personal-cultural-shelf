import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

// 这里只断言「发布出去的东西」：HTML 结构、隐私边界、CSS 令牌约定。
// 不要断言 app.js 的源码文本（函数名、事件绑定写法、缓动曲线数值）——
// 那种用例改一行就红，却抓不到任何真 bug。行为覆盖该由 DOM 测试承担。
test("site shell exposes the media shelves and reference interactions", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /阿崔的精神地图/);
  assert.match(html, /data-type="book"/);
  assert.match(html, /href="film\.html">影/);
  assert.match(html, /href="music\.html">音/);
  // 三种排布合成一个循环键，移动端才塞得下：断言只剩一个排布控件，且旧的并列按钮没有残留。
  assert.match(html, /data-action="layout"/);
  assert.doesNotMatch(html, /data-mode=|data-action="shake"/);
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
  assert.ok(pages.every((page) => page.includes('rel="icon" href="public/avatar.png"') && page.includes("og:title")));
  assert.ok(pages.every((page) => page.includes("og:image") && page.includes("avatar.png")));
  await access(new URL("../public/avatar.png", import.meta.url));
  assert.match(await readFile(new URL("../404.html", import.meta.url), "utf8"), /返回陈列/);
});

test("every page tints the mobile address bar the same paper color", async () => {
  const names = ["index", "film", "music", "browse", "about", "404"];
  const pages = await Promise.all(names.map((name) => readFile(new URL(`../${name}.html`, import.meta.url), "utf8")));
  for (const [index, page] of pages.entries()) {
    assert.match(page, /<meta name="theme-color" content="#e8e2d8">/, `${names[index]}.html 缺 theme-color 或取值不一致`);
  }
});

test("pages that render the shelf preload the media data", async () => {
  const names = ["index", "film", "music", "browse"];
  const pages = await Promise.all(names.map((name) => readFile(new URL(`../${name}.html`, import.meta.url), "utf8")));
  for (const [index, page] of pages.entries()) {
    assert.match(page, /<link rel="preload" href="data\/media\.json" as="fetch"/, `${names[index]}.html 缺 media.json preload`);
  }
  // about/404 不加载 media.json，预载了反而是浪费请求。
  for (const name of ["about", "404"]) {
    assert.doesNotMatch(await readFile(new URL(`../${name}.html`, import.meta.url), "utf8"), /rel="preload" href="data\/media\.json"/);
  }
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

test("shelf pages expose synchronized metadata and keyboard entry points", async () => {
  const pages = await Promise.all(["index", "film", "music", "browse", "about"].map((name) => readFile(new URL(`../${name}.html`, import.meta.url), "utf8")));
  assert.ok(pages.every((page) => page.includes('class="skip-link"')));
  assert.ok(pages.every((page) => page.includes('meta name="description"')));
  // 循环键的按钮文字就是当前排布，屏幕阅读器靠 aria-label 知道「点一下会换」。
  assert.match(pages[0], /<button data-action="layout" type="button" aria-label="当前排布：散落，点击换下一种">散落<\/button>/);
  assert.match(pages[0], /aria-labelledby="poster-title"/);
  assert.match(pages[0], /id="work-dialog"/);
});

test("shelf controls use one continuous rhythm with count and catalog", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /class="control-stat"/);
  assert.equal((html.match(/class="control-divider"/g) ?? []).length, 2);
  assert.match(html, /class="control-catalog" href="browse\.html">目录 →<\/a>/);
  assert.doesNotMatch(html, /control-destination/);
});

test("component styles consume color tokens instead of raw hex values", async () => {
  const styles = await Promise.all(["styles", "shelf", "pages"].map((name) => readFile(new URL(`../${name}.css`, import.meta.url), "utf8")));
  const componentCss = styles.join("\n").replace(/:root\s*\{[^}]+\}/, "");

  assert.doesNotMatch(componentCss, /#[0-9a-fA-F]{3,8}\b/);
});
