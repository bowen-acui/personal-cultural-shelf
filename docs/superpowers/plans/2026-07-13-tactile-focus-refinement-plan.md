# Tactile Focus Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将书、影、音封面的详情交互升级为单击触达的暖玻璃聚焦层，并统一控制栏、目录页、关于页和全站中文排版。

**Architecture:** 保留原生 HTML、CSS 与 ES Modules。详情继续使用现有原生 `dialog`，由 `app.js` 管理聚焦对象、焦点恢复和瞬时状态互斥；视觉变化只进入 `DESIGN.md`、`styles.css`、`shelf.css` 和 `pages.css`，不引入框架或依赖。

**Tech Stack:** HTML、CSS、原生 JavaScript ES modules、Node.js `node:test`、Codex 内置真实浏览器。

---

## 文件职责

| 文件 | 本轮职责 |
|---|---|
| `DESIGN.md` | 增加暖玻璃材质、聚焦层、控制分组、字体与动效 token |
| `app.js` | 单击聚焦、点击空白关闭、焦点恢复、拖拽抑制和状态互斥 |
| `index.html` / `film.html` / `music.html` | 聚焦 dialog 语义与控制栏分组结构 |
| `browse.html` / `about.html` | “目录”用词、页面结构和元信息一致性 |
| `styles.css` | 字体、空间、玻璃、层级和基础交互 token |
| `shelf.css` | 聚焦层、封面触达、控制栏分组和响应式实现 |
| `pages.css` | 目录工具条、标题、正文与卡片排版 |
| `test/site.test.mjs` | 静态结构、双击移除、dialog 语义和控制分组回归 |

### Task 1: 固化新的设计合同

**Files:**
- Modify: `DESIGN.md`
- Reference: `docs/superpowers/specs/2026-07-13-tactile-focus-refinement-design.md`

- [ ] **Step 1: 加入玻璃、聚焦、字体和控制分组 token**

在 `DESIGN.md` 明确：`--glass-surface`、`--glass-edge`、`--glass-shadow`、`--focus-backdrop`、`--motion-focus`、`--ease-focus`，以及三组控制栏语义。

- [ ] **Step 2: 自检设计合同**

Run:

```bash
rg -n "暖玻璃|Focus Layer|Control Group|motion-focus|focus-backdrop" DESIGN.md
```

Expected: 五个设计边界均有明确条目，没有 TBD、TODO 或与旧“无玻璃”规则冲突的描述。

### Task 2: 建立聚焦交互回归测试

**Files:**
- Modify: `test/site.test.mjs`

- [ ] **Step 1: 写失败测试**

测试必须确认：

```js
assert.doesNotMatch(app, /addEventListener\("dblclick"/);
assert.match(app, /function showDetails/);
assert.match(app, /function closeDetails/);
assert.match(index, /class="control-group"/);
assert.match(index, /id="detail-dialog"[^>]*aria-labelledby="detail-title"/);
assert.match(index, />目录</);
```

- [ ] **Step 2: 运行测试确认旧实现失败**

Run: `node --test test/site.test.mjs`

Expected: FAIL，旧代码仍依赖 `dblclick`，控制栏没有语义分组。

### Task 3: 实现单击触达聚焦

**Files:**
- Modify: `app.js`
- Modify: `index.html`
- Modify: `film.html`
- Modify: `music.html`

- [ ] **Step 1: 调整详情 dialog 语义**

三个陈列页的 `#detail-dialog` 统一包含：关闭按钮、媒介标签、完整封面、标题和公开元数据；使用 `aria-labelledby="detail-title"` 与 `aria-describedby="detail-meta"`。

- [ ] **Step 2: 让单击打开聚焦**

将普通模式的封面 click 从只设置 `.is-selected` 改为调用 `showDetails(index, object)`；删除 `dblclick` 监听。Enter 与 Space 复用同一入口。

- [ ] **Step 3: 统一关闭逻辑**

新增 `closeDetails()`：关闭 dialog、清除 `.is-selected`、恢复触发封面焦点。监听 dialog backdrop click；内容区 click 不关闭。媒体切换、筛选、分享与 Escape 复用该函数。

- [ ] **Step 4: 保留拖拽和分享语义**

拖拽超过 6px 后的 click 被抑制；`state.picking` 为 true 时，click 只选择分享项，永不打开聚焦。

- [ ] **Step 5: 运行静态测试与语法检查**

Run:

```bash
node --test test/site.test.mjs
node --check app.js
```

Expected: PASS。

### Task 4: 实现暖玻璃材质与触达动画

**Files:**
- Modify: `styles.css`
- Modify: `shelf.css`

- [ ] **Step 1: 在全局 token 中加入材质和动效**

只通过 token 使用暖玻璃底色、边缘、遮罩、阴影、320ms 聚焦时长和减速曲线。

- [ ] **Step 2: 重写详情 dialog 的视觉构图**

桌面使用封面与信息错位布局；移动端改为垂直布局。书与影封面完整适配，音乐维持正方形。背景只退后，不彻底消失。

- [ ] **Step 3: 增加物理触达反馈**

封面按下使用 0.985 缩放；聚焦层只动画 transform、opacity 与 backdrop-filter；`prefers-reduced-motion` 下即时切换。

- [ ] **Step 4: 检查原始颜色与层级漂移**

Run:

```bash
rg -n "#[0-9a-fA-F]{3,8}|z-index:[0-9]" styles.css shelf.css pages.css
```

Expected: 新增材质值只出现在 `:root`，组件使用 token；无任意高层级。

### Task 5: 重构控制栏与全站排版

**Files:**
- Modify: `index.html`
- Modify: `film.html`
- Modify: `music.html`
- Modify: `browse.html`
- Modify: `about.html`
- Modify: `styles.css`
- Modify: `shelf.css`
- Modify: `pages.css`

- [ ] **Step 1: 控制栏改为三组**

为陈列、操作、去向增加 `.control-group`；去向文案统一为“目录”。通过边线和间距建立层级，不新增图标依赖。

- [ ] **Step 2: 降低当前模式视觉噪声**

当前模式改用内高光、浅底与小状态点；保留橙色只作为微小状态信号与焦点色。

- [ ] **Step 3: 统一字体职责**

宋体栈负责中文展示标题，Instrument Serif 负责英文展示，Inter/苹方负责正文，Space Mono 仅负责数量和微型标签。

- [ ] **Step 4: 精炼目录和关于页面**

目录工具条使用暖玻璃材质；标题缩放、行宽、行高和卡片间距依照设计规范。关于页控制在 28-36 个汉字行宽，避免孤行。

- [ ] **Step 5: 响应式检查**

375px、768px、1280px 均无横向溢出；控制区目标至少 44px；移动端胶囊可滚动但无可见滚动条。

### Task 6: 完整验证

**Files:**
- Verify: all changed files
- Evidence: `qa/tactile-focus-2026-07-13/`

- [ ] **Step 1: 自动验证**

Run:

```bash
npm run build:data
npm test
node --check app.js
node --check catalog-page.js
git diff --check
```

Expected: 312 条媒体数据；全部测试通过；语法和 diff 检查通过。

- [ ] **Step 2: 真实浏览器桌面验收**

验证首页、影、音、目录、关于；单击封面打开、点击空白关闭、点击另一件切换、Escape 关闭、拖拽不误开、分享选择不误开。

- [ ] **Step 3: 真实浏览器移动端验收**

在 375 × 812 检查聚焦封面完整可见、音乐 1:1、信息不被底部胶囊遮挡、无横向溢出、主要点击目标至少 44px。

- [ ] **Step 4: 浏览器错误检查**

Expected: console error 为 0；所有路由数据数量正确；浏览页筛选仍返回正确结果。

- [ ] **Step 5: 最终设计复核**

确认没有新增数据库式信息、蓝紫玻璃、无意义动画、额外路由或不属于展示面的功能。
