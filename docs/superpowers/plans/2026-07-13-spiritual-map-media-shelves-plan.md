# Spiritual Map Media Shelves Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有书架改造成由真实 Obsidian 数据驱动的“阿崔的精神地图”，提供书、影、音三个共享视觉系统但密度不同的艺术陈列架。

**Architecture:** 扩展现有静态构建脚本，让三个 Obsidian 目录生成统一的公开媒体数据；首页由同一套布局引擎按媒介比例和密度渲染，公共交互保持筛选、整理、拖拽、详情和分享；仅保留书籍完读年月，移除影音日期、时间线和统计等不符合新目标的功能。

**Tech Stack:** 原生 ES modules、HTML、CSS、Node.js `node:test`、Python 静态服务器、真实浏览器验收。

---

### Task 1: 扩展媒体数据构建管线

**Files:**
- Modify: `scripts/build-library.mjs`
- Modify: `test/build-library.test.mjs`
- Modify: `package.json`
- Generate: `data/media.json`, `public/covers/`

- [ ] **Step 1: 写失败测试**

  增加 `parseFrontmatter`/`toPublicMedia`/`buildMediaRecord` 测试，覆盖 `book`、`film`、`music` 三类统一字段，模板空名称被过滤，只有书籍可公开完读年月。

- [ ] **Step 2: 运行测试确认失败**

  Run: `node --test test/build-library.test.mjs`
  Expected: FAIL because `toPublicMedia` and the media collection builder do not exist.

- [ ] **Step 3: 最小实现**

  为每个源目录定义 `{ type, directory, coverRoot }` 配置；读取 Markdown frontmatter，使用文件所在目录决定 `type`，输出 `{ id, type, title, creator, cover, categories }`；忽略模板、空名称、缺封面、越界 symlink 与非法扩展名；保留已有书籍兼容逻辑。

- [ ] **Step 4: 生成真实数据并运行测试**

  Run: `npm run build:data && node --test`
  Expected: 102 books + 5 films + 8 music records; all tests PASS; only book records may contain `completedMonth`, and no record contains full dates, `状态`, `评分` or private fields.

### Task 2: 将首页改造成三媒介共享陈列架

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `lib/layouts.js`
- Modify: `lib/catalog.js`
- Modify: `shelf.css`
- Modify: `styles.css`
- Add: `data/media.json`
- Modify: `test/site.test.mjs`, `test/layouts.test.mjs`, `test/catalog.test.mjs`

- [ ] **Step 1: 写失败测试**

  断言三个媒体入口加载，切换 `book/film/music` 后对象数量分别为 102/5/8；电影使用较大的 portrait 尺寸，音乐使用 square 尺寸；书籍显示完读年月，影音无日期文本。

- [ ] **Step 2: 运行测试确认失败**

  Run: `node --test test/site.test.mjs test/layouts.test.mjs`
  Expected: FAIL against the current book-only shell and layouts.

- [ ] **Step 3: 最小实现**

  `app.js` 统一读取 `data/media.json`，用 `state.type` 切换当前媒体；布局函数接收 `type`，书/影/音分别使用 portrait-dense、portrait-dramatic、square-collage 参数；媒体导航成为可操作按钮；详情只展示名称、创作者、分类。

- [ ] **Step 4: 运行单元与静态测试**

  Run: `node --test`
  Expected: all tests PASS, with media counts and aspect-ratio assertions green.

### Task 3: 清理不符合目标的页面与文案

**Files:**
- Delete: `stats.html`, `timeline.html`
- Modify: `browse.html`, `catalog-page.js`, `about.html`, `film.html`, `music.html`
- Modify: `README.md`, `DESIGN.md`
- Modify: `test/site.test.mjs`

- [ ] **Step 1: 写失败测试**

  断言首页和浏览页不出现影音日期/年份/时间线入口；浏览页展示三类媒体筛选；影/音空状态只在没有数据时出现，而真实数据加载后不再出现。

- [ ] **Step 2: 运行测试确认失败**

  Run: `node --test test/site.test.mjs`
  Expected: FAIL because current routes still expose stats/timeline and film/music are static empty pages.

- [ ] **Step 3: 最小实现**

  浏览页从统一数据源派生，支持媒体类型和分类筛选；关于页改写为“精神地图”说明；移除时间线、年份统计和旧“书架”命名；影/音页面复用统一媒体渲染入口，不保留静态假空态。

- [ ] **Step 4: 运行测试**

  Run: `node --test`
  Expected: all tests PASS and only首页、书、影、音、浏览、关于是公开页面。

### Task 4: 真实浏览器验收与收口

**Files:**
- Modify if needed: `styles.css`, `shelf.css`, `pages.css`, `DESIGN.md`
- Evidence: `qa/final-fresh/`

- [ ] **Step 1: 启动静态服务器**

  Run: `python3 -m http.server 4174` from the worktree.

- [ ] **Step 2: 逐媒介验收**

  Open `/`, `/browse.html`, `/film.html`, `/music.html` at 1280px, 768px, and 375px; verify counts, navigation, book completion months, no film/music dates, no console errors, and no horizontal overflow.

- [ ] **Step 3: 验收交互**

  Click type navigation, Scatter/Shake/Tidy/Vortex, Filter, five-item share, double-click/Enter details, Escape reset, and Browse search.

- [ ] **Step 4: 完成验证**

  Run: `npm run build:data && npm test && node --check app.js && node --check catalog-page.js && git diff --check`
  Expected: all tests and syntax checks PASS; fresh screenshots show three coherent but density-differentiated shelves.
