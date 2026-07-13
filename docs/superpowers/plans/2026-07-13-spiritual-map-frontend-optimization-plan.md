# Spiritual Map Frontend Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变 The Visible Shelf 单一视觉方向、不增加后端的前提下，把“阿崔的精神地图”优化为操作一致、响应式可靠、无障碍可用、数据更新安全、适合长期发布维护的静态书影音网站。

**Architecture:** 保留原生 HTML/CSS/ES Modules 和静态 JSON 架构。`app.js` 继续承担陈列页控制器职责，纯逻辑只拆出三个可测试模块：媒体数据加载、路由映射、海报几何；布局和筛选继续留在现有 `lib/`。数据构建保持 Obsidian 只读，增加安全诊断、原子写入和孤儿封面清理。

**Tech Stack:** 原生 ES modules、HTML、CSS、Node.js `node:test`、Canvas、静态文件托管、真实浏览器 QA。

---

## 成功标准

1. `/` 始终默认显示书籍散落，102 本当前数据全部存在；未来新增数据不需要修改测试常量。
2. 书 → 影 → 音后，浏览器返回键依次回到影、书。
3. 筛选、分享、详情和海报任意时刻最多只有一个瞬时状态。
4. 375px、523px、768px、1280px 无横向溢出，作品不进入 footer。
5. 375px 首屏至少 16 件、523px 至少 20 件、1280px 至少 45 件书籍对象。
6. 顶部媒介和底部操作在手机端均有至少 44 × 44px 触控区域。
7. 8 次 Tab 以内可以到达主要布局与筛选操作；被筛掉作品不进入 Tab 顺序。
8. 音乐分享海报保持 1:1，书和电影保持竖向，所有图片不拉伸。
9. `media.json` 失败时首页和浏览页均显示可理解的错误状态。
10. 构建完成后 `public/covers` 不存在无引用哈希文件；坏记录不会覆盖上一份可用数据。
11. 自动测试、语法检查、设计 token 检查、真实浏览器交互和最终审计全部通过。

## 文件职责

| 文件 | 责任 |
|---|---|
| `DESIGN.md` | 唯一视觉、交互、无障碍和 accepted debt 合同 |
| `app.js` | 陈列页 DOM 渲染、交互协调和页面状态 |
| `catalog-page.js` | 浏览页筛选、搜索和渲染 |
| `lib/media-data.js` | 共享 JSON 加载与边界校验 |
| `lib/routes.js` | pathname 与 book/film/music 的纯映射 |
| `lib/poster.js` | 分享海报槽位、裁剪和 Canvas 绘制 |
| `lib/layouts.js` | 三媒介布局坐标、尺寸和画布高度 |
| `lib/catalog.js` | 搜索、分类统计和当前媒介分类派生 |
| `scripts/build-library.mjs` | Obsidian 只读导入、诊断、原子输出、封面清理 |
| `styles.css` | 全局 token、结构、导航、焦点与响应式基础 |
| `shelf.css` | 陈列对象、浮层、控制条、对话框与状态 |
| `pages.css` | 浏览页和关于页 |
| `test/*.test.mjs` | 纯逻辑、静态结构、生成数据与回归边界 |

### Task 0: 固化优化前基线

**Files:**
- Verify: all current project files
- Evidence: `qa/ux-audit-2026-07-13/`

- [ ] **Step 1: 运行当前基线验证**

Run:

```bash
npm run build:data
npm test
node --check app.js
node --check catalog-page.js
node --check scripts/build-library.mjs
git diff --check
```

Expected: 115 条媒体数据；17 个测试通过；语法和 diff 检查通过。

- [ ] **Step 2: 保存当前工作版本作为可回退基线**

Run only after the user authorizes the implementation commit:

```bash
git add .
git commit -m "feat: build spiritual map media shelves"
```

Expected: 工作树干净，后续每个优化任务可以独立审查和回退。

### Task 1: 修正设计合同和 CSS token 架构

**Files:**
- Modify: `DESIGN.md`
- Modify: `styles.css`
- Modify: `shelf.css`
- Modify: `pages.css`
- Modify: `test/site.test.mjs`

- [ ] **Step 1: 增加设计系统漂移的失败测试**

在 `test/site.test.mjs` 增加：

```js
test("styles use the documented token and layer scale", async () => {
  const styles = await Promise.all(
    ["styles", "shelf", "pages"].map((name) =>
      readFile(new URL(`../${name}.css`, import.meta.url), "utf8"),
    ),
  );
  const css = styles.join("\n");
  assert.doesNotMatch(css, /z-index:(?:8000|9999|10000|10001|10002|10003)/);
  assert.doesNotMatch(css, /--muted:|--line:/);
  assert.match(css, /--ink-muted:/);
  assert.match(css, /--paper-line:/);
  assert.match(css, /--layer-controls:/);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/site.test.mjs`

Expected: FAIL，当前仍使用旧 token 和任意 z-index。

- [ ] **Step 3: 更新 `DESIGN.md` 合同**

将标题改为“阿崔的精神地图 Design System”，并补充：

```md
- Header layer: `--layer-header: 40`
- Object active layer: `--layer-object-active: 50`
- Filter layer: `--layer-filter: 60`
- Controls layer: `--layer-controls: 70`
- Dialog uses the browser top layer
- Minimum interactive target: 44px
- Transient UI is mutually exclusive: idle/filtering/picking/detail/poster
```

明确记录书籍完读年月例外、523px 密度档、导航历史和触控规则。

- [ ] **Step 4: 统一 CSS token**

在 `styles.css` 的 `:root` 中建立唯一 token：

```css
:root {
  --paper: #e8e2d8;
  --paper-light: #f4f1ea;
  --ink: #1a1a1a;
  --ink-muted: #625d55;
  --paper-line: #d5cec2;
  --active: #c45d3e;
  --control: #2a2826;
  --target-min: 44px;
  --layer-footer: 30;
  --layer-header: 40;
  --layer-object-active: 50;
  --layer-filter: 60;
  --layer-controls: 70;
  --layer-status: 80;
}
```

用 token 替换旧变量和任意层级，不改变已确认的颜色、字体和阴影表现。

- [ ] **Step 5: 格式化 HTML/CSS/JS**

把当前单行 HTML 和压缩式 CSS 展开为项目统一的两空格缩进。只做机械格式化，不改变语义。

- [ ] **Step 6: 运行测试并提交**

Run: `npm test && git diff --check`

Commit:

```bash
git add DESIGN.md styles.css shelf.css pages.css index.html film.html music.html browse.html about.html test/site.test.mjs
git commit -m "refactor: align the spiritual map design system"
```

### Task 2: 让 Obsidian 构建适合长期更新

**Files:**
- Modify: `scripts/build-library.mjs`
- Modify: `test/build-library.test.mjs`
- Modify: `test/media-data.test.mjs`
- Modify: `README.md`

- [ ] **Step 1: 写路径、重复 ID 和孤儿封面测试**

在 `test/build-library.test.mjs` 增加纯函数测试：

```js
test("vault root defaults below the current home directory", () => {
  assert.equal(
    resolveVaultRoot({}, "/Users/example"),
    "/Users/example/Documents/obsidian/阿崔",
  );
  assert.equal(
    resolveVaultRoot({ OBSIDIAN_VAULT: "/vault" }, "/Users/example"),
    "/vault",
  );
});

test("validateUniqueRecords rejects duplicate public ids", () => {
  assert.throws(
    () => validateUniqueRecords([{ id: "book:a" }, { id: "book:a" }]),
    /Duplicate media id: book:a/,
  );
});

test("orphanCoverNames returns only unreferenced hashed covers", () => {
  assert.deepEqual(
    orphanCoverNames(
      ["abc123abc123.jpg", "def456def456.webp", "manual-note.txt"],
      new Set(["abc123abc123.jpg"]),
    ),
    ["def456def456.webp"],
  );
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/build-library.test.mjs`

Expected: FAIL，三个函数尚不存在。

- [ ] **Step 3: 实现可移植路径和稳定 ID**

```js
import os from "node:os";

export function resolveVaultRoot(env = process.env, home = os.homedir()) {
  return path.resolve(env.OBSIDIAN_VAULT || path.join(home, "Documents/obsidian/阿崔"));
}

function publicId(filename, type) {
  return `${type}:${path.basename(filename, path.extname(filename))}`;
}
```

不再把 `/Users/acui` 写入公开仓库；标题仍来自 metadata，ID 来自文件名。

- [ ] **Step 4: 实现诊断、原子写入和成功后清理**

构建顺序固定为：

```text
read sources -> collect valid records and diagnostics
-> fail without replacing media.json when non-template diagnostics exist
-> validate unique ids
-> copy referenced covers
-> write data/media.json.tmp
-> rename tmp to data/media.json
-> remove only unreferenced /^[a-f0-9]{12}\.(jpg|jpeg|png|webp|avif)$/ covers
```

空模板继续忽略；非空记录缺名称、缺封面或封面越界时打印文件名与原因并退出 1。

- [ ] **Step 5: 移除硬编码数量断言**

将 `test/media-data.test.mjs` 改为：

```js
assert.ok(records.length > 0);
assert.ok(["book", "film", "music"].every(
  (type) => records.some((item) => item.type === type),
));
assert.equal(new Set(records.map((item) => item.id)).size, records.length);
assert.ok(records.every((item) => item.title && item.cover));
```

保留封面存在、日期边界和 schema 校验。

- [ ] **Step 6: 更新 README 的数据命令**

```bash
npm run build:data
OBSIDIAN_VAULT="/另一处/阿崔" npm run build:data
```

README 不再写死 102/5/8，只说明构建命令会输出实时数量。

- [ ] **Step 7: 验证重复构建不增长封面目录**

Run:

```bash
npm run build:data
find public/covers -type f | wc -l
npm run build:data
find public/covers -type f | wc -l
npm test
```

Expected: 两次文件数相同且等于公开数据引用的唯一封面数；测试通过。

- [ ] **Step 8: 提交**

```bash
git add scripts/build-library.mjs test/build-library.test.mjs test/media-data.test.mjs README.md data/media.json public/covers
git commit -m "fix: make media builds safe and repeatable"
```

### Task 3: 增加共享数据加载和可见错误状态

**Files:**
- Create: `lib/media-data.js`
- Create: `test/media-data-loader.test.mjs`
- Modify: `app.js`
- Modify: `catalog-page.js`
- Modify: `index.html`
- Modify: `film.html`
- Modify: `music.html`
- Modify: `browse.html`
- Modify: `shelf.css`
- Modify: `pages.css`

- [ ] **Step 1: 写媒体加载器失败测试**

```js
import { loadMedia } from "../lib/media-data.js";

test("loadMedia rejects a non-ok response", async () => {
  await assert.rejects(
    loadMedia(async () => ({ ok: false, status: 404 })),
    /媒体数据加载失败：404/,
  );
});

test("loadMedia rejects a malformed catalog", async () => {
  await assert.rejects(
    loadMedia(async () => ({ ok: true, json: async () => ({}) })),
    /媒体数据格式错误/,
  );
});
```

- [ ] **Step 2: 实现最小加载器**

```js
export async function loadMedia(fetcher = fetch) {
  const response = await fetcher("data/media.json");
  if (!response.ok) throw new Error(`媒体数据加载失败：${response.status}`);
  const items = await response.json();
  if (!Array.isArray(items)) throw new Error("媒体数据格式错误");
  return items;
}
```

- [ ] **Step 3: 给页面加入共享状态区**

在陈列页 main 内加入：

```html
<p id="load-status" class="load-status" role="status" aria-live="polite">
  正在铺开藏品…
</p>
```

浏览页复用 `#catalog-status`。加载成功后移除 loading；失败时显示“藏品暂时没有铺开，请重新加载”，并提供原生链接按钮。

- [ ] **Step 4: 替换两个入口的 fetch**

`app.js` 和 `catalog-page.js` 都从 `loadMedia()` 获取数据并在 catch 中调用 `renderLoadError(error)`；不再吞掉错误或让顶层 await 中断整个模块。

- [ ] **Step 5: 验证正常、404 和坏 JSON 三种状态**

Run: `node --test test/media-data-loader.test.mjs && npm test`

Browser: 正常数据渲染；临时把请求指向不存在文件后出现错误提示；恢复后重新加载正常。

- [ ] **Step 6: 提交**

```bash
git add lib/media-data.js test/media-data-loader.test.mjs app.js catalog-page.js index.html film.html music.html browse.html shelf.css pages.css
git commit -m "feat: add resilient media loading states"
```

### Task 4: 修复媒体历史和瞬时状态冲突

**Files:**
- Create: `lib/routes.js`
- Create: `test/routes.test.mjs`
- Modify: `app.js`

- [ ] **Step 1: 写路由映射失败测试**

```js
test("media routes round-trip", () => {
  assert.equal(typeFromPath("/"), "book");
  assert.equal(typeFromPath("/index.html"), "book");
  assert.equal(typeFromPath("/film.html"), "film");
  assert.equal(typeFromPath("/music.html"), "music");
  assert.equal(pathForType("book"), "./");
  assert.equal(pathForType("film"), "film.html");
});
```

- [ ] **Step 2: 实现路由映射**

```js
export function typeFromPath(pathname) {
  if (pathname.endsWith("/film.html")) return "film";
  if (pathname.endsWith("/music.html")) return "music";
  return "book";
}

export function pathForType(type) {
  return type === "book" ? "./" : `${type}.html`;
}
```

- [ ] **Step 3: 建立唯一瞬时状态**

将 state 增加：

```js
transient: "idle" // idle | filtering | picking | detail | poster
```

实现 `enterTransient(next)`：进入 filtering 时停止 picking；进入 picking 时关闭 filter；进入 detail/poster 时关闭两者；进入 idle 时关闭所有面板并恢复按钮文案。

- [ ] **Step 4: 改为 pushState + popstate**

```js
function navigateType(type) {
  switchType(type);
  history.pushState({ type }, "", pathForType(type));
}

addEventListener("popstate", () => {
  switchType(typeFromPath(location.pathname));
});
```

`switchType` 同步 `document.title`、`body.dataset.mediaType`、当前导航和总数。

- [ ] **Step 5: 统一 Escape**

Escape 按顺序关闭原生 dialog、瞬时状态和选中信息签；筛选面板不再残留。

- [ ] **Step 6: 真实浏览器验证**

验证：筛选 → 分享没有重叠；分享 → 切换媒介状态完全清理；书 → 影 → 音 → 返回 → 返回得到影、书。

- [ ] **Step 7: 提交**

```bash
git add lib/routes.js test/routes.test.mjs app.js
git commit -m "fix: coordinate shelf state and browser history"
```

### Task 5: 修复键盘、触控和拖拽逻辑

**Files:**
- Modify: `index.html`
- Modify: `film.html`
- Modify: `music.html`
- Modify: `app.js`
- Modify: `styles.css`
- Modify: `shelf.css`
- Modify: `test/site.test.mjs`

- [ ] **Step 1: 写静态结构失败测试**

```js
assert.match(html, /class="skip-link"/);
assert.ok(html.indexOf('id="shelf-controls"') < html.indexOf('id="shelf-stage"'));
```

- [ ] **Step 2: 调整 DOM 顺序并增加跳转链接**

```html
<a class="skip-link" href="#shelf-controls">跳到陈列操作</a>
<a class="skip-link" href="#shelf-stage">跳到作品</a>
```

控制条在 DOM 中放在 main 前，CSS 继续固定在底部。

- [ ] **Step 3: 确保触控尺寸**

```css
.media-nav a,
.shelf-controls button,
.shelf-controls a {
  min-width: var(--target-min);
  min-height: var(--target-min);
  display: inline-grid;
  place-items: center;
}
```

视觉字体尺寸不放大，只增加透明点击区。

- [ ] **Step 4: 让筛选集合与无障碍集合一致**

```js
const hiddenByFilter = category !== "全部" && !matches;
object.classList.toggle("is-dimmed", hiddenByFilter);
object.inert = hiddenByFilter;
object.setAttribute("aria-hidden", String(hiddenByFilter));
```

恢复全部时移除 `inert` 和 `aria-hidden`。

- [ ] **Step 5: 重写拖拽判定**

pointerdown 只记录起点；移动超过 6px 才 `setPointerCapture` 并进入 dragging；pointerup/pointercancel 都清理监听器；dragging 完成后抑制一次 click。

- [ ] **Step 6: 统一点击含义**

- hover/focus：显示信息签。
- 单击/轻触：打开详情。
- 拖拽：只改变位置，不打开详情。
- Enter：打开详情。
- Space：保持原生按钮激活行为。

- [ ] **Step 7: 浏览器验证**

检查 Tab 顺序、焦点环、44px 触控目标、筛选后 Tab 集合、轻触详情、拖拽阈值和 pointercancel。

- [ ] **Step 8: 提交**

```bash
git add index.html film.html music.html app.js styles.css shelf.css test/site.test.mjs
git commit -m "fix: make shelf controls accessible and predictable"
```

### Task 6: 提升数量感并修复三媒介布局

**Files:**
- Modify: `lib/layouts.js`
- Modify: `test/layouts.test.mjs`
- Modify: `app.js`
- Modify: `shelf.css`

- [ ] **Step 1: 写断点、画布底边和媒介分布测试**

```js
test("book scatter uses four columns in compact desktop windows", () => {
  const compactBooks = Array.from({ length: 8 }, (_, index) => ({
    id: `book:${index}`,
    title: `Book ${index}`,
  }));
  const layout = createScatterLayout(compactBooks, { width: 523 }, 0, "book");
  assert.ok(new Set(layout.slice(0, 4).map((entry) => entry.column)).size === 4);
});

test("stage height contains every rendered cover", () => {
  const layout = createScatterLayout(items, { width: 1280 }, 0, "book");
  const height = stageHeightForLayout(layout, 32);
  const bottom = Math.max(...layout.map((item) => item.top + item.width / item.ratio));
  assert.ok(bottom <= height - 32);
});

test("music scatter uses two vertical bands", () => {
  const layout = createScatterLayout(musicItems, { width: 1280 }, 0, "music");
  assert.ok(Math.max(...layout.map((item) => item.top)) - Math.min(...layout.map((item) => item.top)) > 120);
});
```

- [ ] **Step 2: 增加 440–639px 四列档**

书籍布局：

```text
320–439: 3 columns
440–639: 4 columns
640–1023: 6 columns
1024+: 10 columns
```

封面宽度按 cell 限制，保持可辨识，不为追求数量缩成缩略图。

- [ ] **Step 3: 调整影和音构图**

- 电影：5 张分成 3+2 两个高度带，对角重心，保留克制重叠。
- 音乐：8 张分成 4+4 两个松散高度带，保持 1:1。
- 书：继续密集、随机、纵向延展。

- [ ] **Step 4: 画布高度改用实际布局**

```js
export function stageHeightForLayout(layout, bottomPadding = 32) {
  const maxBottom = Math.max(0, ...layout.map(
    (item) => item.top + item.width / item.ratio,
  ));
  return Math.max(700, Math.ceil(maxBottom + bottomPadding));
}
```

`applyLayout()` 直接使用当前 layout 计算高度，不再重复一套行数公式。

- [ ] **Step 5: 将位移动画改为 transform**

CSS 使用 `translate3d(var(--x), var(--y), 0) rotate(...) scale(...)`；不再动画 left/top。宽度变化使用尺寸 scale 或在模式切换前后直接设置，避免持续 layout thrash。

- [ ] **Step 6: 节流 resize**

用一个 `requestAnimationFrame` 标记合并连续 resize，不在每个事件中更新 102 个节点。

- [ ] **Step 7: 浏览器数量与边界验收**

测量 375/523/768/1280 的首屏对象数、页面高度、最大底边和横向溢出；保存四个断点截图。

- [ ] **Step 8: 提交**

```bash
git add lib/layouts.js test/layouts.test.mjs app.js shelf.css
git commit -m "feat: refine responsive media compositions"
```

### Task 7: 重建类型正确的分享海报

**Files:**
- Create: `lib/poster.js`
- Create: `test/poster.test.mjs`
- Modify: `app.js`
- Modify: `shelf.css`

- [ ] **Step 1: 写槽位比例失败测试**

```js
test("music poster slots are square", () => {
  assert.ok(posterSlots("music").every((slot) => slot.width === slot.height));
});

test("book and film poster slots are portrait", () => {
  for (const type of ["book", "film"]) {
    assert.ok(posterSlots(type).every((slot) => slot.height > slot.width));
  }
});
```

- [ ] **Step 2: 实现槽位和 cover 裁剪**

```js
export function coverCrop(image, slot) {
  const scale = Math.max(slot.width / image.naturalWidth, slot.height / image.naturalHeight);
  const sourceWidth = slot.width / scale;
  const sourceHeight = slot.height / scale;
  return {
    sx: (image.naturalWidth - sourceWidth) / 2,
    sy: (image.naturalHeight - sourceHeight) / 2,
    sw: sourceWidth,
    sh: sourceHeight,
  };
}
```

Canvas 使用九参数 `drawImage`，不再直接拉伸。

- [ ] **Step 3: 在生成前等待五张图片可用**

使用 `image.decode()`；任何一张失败时在共享状态区显示“有一张封面还没有准备好，请重试”，不打开空海报。

- [ ] **Step 4: 增加复制反馈**

复制成功把按钮文字短暂改为“已复制”；失败显示可读状态并保留原链接。

- [ ] **Step 5: 真实浏览器对比三类海报**

各生成一张书、影、音海报；确认比例、裁剪、标题、下载文件和移动端对话框。

- [ ] **Step 6: 提交**

```bash
git add lib/poster.js test/poster.test.mjs app.js shelf.css
git commit -m "fix: preserve cover ratios in share posters"
```

### Task 8: 优化浏览页联动、文案和发布基础

**Files:**
- Modify: `lib/catalog.js`
- Modify: `test/catalog.test.mjs`
- Modify: `catalog-page.js`
- Modify: `browse.html`
- Modify: `about.html`
- Modify: `index.html`
- Modify: `film.html`
- Modify: `music.html`
- Modify: `pages.css`
- Modify: `README.md`

- [ ] **Step 1: 写当前媒介分类测试**

```js
test("category counts can be scoped to a media type", () => {
  assert.deepEqual(categoryCounts(items.filter((item) => item.type === "film")), [
    ["剧情", 1],
  ]);
});
```

- [ ] **Step 2: 媒介变化时重建分类**

`renderCategoryOptions(source)` 只使用当前媒介数据；当前分类不在新 source 中时恢复“全部”；随后只调用一次 `render()`。

- [ ] **Step 3: 优化手机筛选排版**

375px 下搜索占整行，媒介和分类在第二行各占一半；桌面继续保持单行胶囊。

- [ ] **Step 4: 修正文案边界**

关于页明确写：

```text
书籍只显示完读年月；电影与音乐不显示日期。
这里不公开评分、摘抄、进度或私人笔记。
```

- [ ] **Step 5: 补齐静态页面元信息**

每页加入唯一 description、theme-color；为未来部署位置保留 canonical 注入步骤。社交图使用真实封面拼贴生成，不手绘替代资产。

- [ ] **Step 6: 更新 README**

说明页面结构、数据更新、验证命令、GitHub 静态部署边界和不包含的功能。

- [ ] **Step 7: 验证并提交**

Run: `npm test && git diff --check`

Commit:

```bash
git add lib/catalog.js test/catalog.test.mjs catalog-page.js browse.html about.html index.html film.html music.html pages.css README.md
git commit -m "feat: polish browsing and public metadata"
```

### Task 9: 建立最终验证和审批门槛

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify if defects are found: relevant source/test files
- Evidence: `qa/frontend-optimization-final/`

- [ ] **Step 1: 增加统一验证命令**

```json
{
  "scripts": {
    "build:data": "node scripts/build-library.mjs",
    "test": "node --test",
    "check": "node --check app.js && node --check catalog-page.js && node --check scripts/build-library.mjs",
    "verify": "npm run build:data && npm test && npm run check"
  }
}
```

- [ ] **Step 2: 运行完整自动验证**

Run:

```bash
npm run verify
git diff --check
```

Expected: 所有数据、测试、语法和 diff 检查通过；封面目录没有孤儿文件。

- [ ] **Step 3: 运行真实浏览器视觉 QA**

在 375、523、768、1280px 检查：

- 首页书籍散落和总数。
- 影、音构图和比例。
- 散落、抖动、整理、漩涡。
- 筛选互斥、Escape、无障碍集合。
- 单击详情和拖拽阈值。
- 三类五件分享海报。
- 浏览搜索、媒介与分类联动、空结果。
- 加载错误状态。
- 返回键与刷新。

- [ ] **Step 4: 运行无障碍审批**

确认：主要操作 8 次 Tab 内可达、所有焦点可见、触控目标 44px、对话框焦点返回、筛选后非匹配项不进入 Tab/读屏集合、reduced-motion 有效。

- [ ] **Step 5: 运行性能和发布审批**

先清理孤儿封面并测量真实网络请求。只有真实浏览器审计确认图片是主要瓶颈时，才另开任务引入 WebP/AVIF 缩略图构建；不得为了分数删除交互或动画。

在正式 GitHub Pages 地址出现后，重新检查实际 CDN、字体、资源路径、404 和分享元信息。

- [ ] **Step 6: 最终代码审查**

逐项核对本计划成功标准和 `docs/audits/2026-07-13-spiritual-map-frontend-audit.md` 的 P1/P2 问题；每个问题必须是“已修复并复测”或“用户明确接受的设计债务”。

- [ ] **Step 7: 最终提交**

```bash
git add package.json README.md qa/frontend-optimization-final
git commit -m "chore: verify the spiritual map frontend"
```

QA 图片默认保持本地忽略；若 GitHub 仓库不需要保存证据，不添加 `qa/`。

## 实施顺序与检查点

| 阶段 | Tasks | 可独立交付结果 | 用户检查点 |
|---|---|---|---|
| A 基础安全 | 0–3 | 设计合同、数据构建、加载错误稳定 | 检查数据更新是否顺手 |
| B 操作逻辑 | 4–5 | 返回、浮层、键盘、触控、拖拽正确 | 亲自试书/影/音和筛选 |
| C 视觉构图 | 6 | 数量感、影/音布局、画布边界 | 确认艺术方向仍然纯粹 |
| D 分享与浏览 | 7–8 | 海报比例、浏览联动、公开文案 | 检查分享图与浏览页 |
| E 最终审批 | 9 | 自动测试、真实浏览器、发布检查 | 决定提交与推送 GitHub |

## 计划自审结果

- **范围覆盖**：覆盖审计中的所有 P1/P2 问题，P3 发布项在 Task 8–9 收口。
- **架构控制**：只新增 `media-data.js`、`routes.js`、`poster.js` 三个有明确边界的纯模块；不迁移框架，不增加后端。
- **数据边界**：Obsidian 始终只读；空模板忽略；非空坏记录阻止覆盖可用数据。
- **视觉边界**：不加入其他网站风格，不改变暖纸、封面材质、散落构图和低噪音导航。
- **测试边界**：新增数据不再依赖固定数量；布局、路由、海报和加载器都由纯逻辑测试保护。
- **性能边界**：先清理 11MB 左右孤儿资源并测量，再决定是否增加图片转换依赖。
