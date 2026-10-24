# 手机端详情卡交互与流畅度 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 手机触摸书、影、音的详情卡时，翻面可靠、不会留下橙色焦点圈，打开过程尽量顺畅，同时保留桌面端现有交互。

**Architecture:** 沿用现有原生 `dialog`、CSS 3D 翻面和 View Transitions，不增加动画库或新组件。先修触摸事件与焦点模式，再只在触屏设备上移除整页过渡；如果 iPhone 微信内浏览器验收仍卡，才启用预先定义的触屏降级路径。

**Tech Stack:** 原生 JavaScript、CSS、Playwright、GitHub Pages。

---

## 范围与依据

- “手机端”在本计划中指 `(hover: none) and (pointer: coarse)` 的触摸设备；不单凭窗口宽度判断，避免缩窄桌面浏览器也失去原动效。最终必须在用户截图所示的 iPhone 微信内浏览器验收。
- 当前 `app.js` 的书、影在触摸下默认显示背面，但 `pointerdown` 只跟踪音乐触摸，`click` 又忽略触摸；已在移动模拟中复现书卡点按不翻回封面。
- 当前 `styles.css` 的 `:focus-visible` 为橙色；弹窗自动聚焦关闭按钮，关闭后焦点返回封面。用户截图分别显示这两处轮廓。不能全局删除键盘焦点提示。
- 当前打开详情时，浏览器同时创建 `root` 250 ms、`work-card` 420 ms 和背景 240 ms 动画。4 倍 CPU 限速、390×844 触屏模拟的短样本：原样最长帧间隔约 83 ms；仅去掉 `root` 后约 67 ms；完全不用共享元素过渡约 50 ms。这些是定位依据，不是 iPhone 真机帧率或性能承诺。
- 不改数据导入、封面资源、排布算法、桌面端动效，也不新增第三方依赖。

## 文件边界

- `app.js`：触摸翻面事件、最近一次输入方式；若最后需要触屏降级，也只改现有 `canMorph` 判断。
- `styles.css`：仅对触摸操作造成的详情控件与封面焦点轮廓做局部抑制，保留键盘焦点样式。
- `shelf.css`：仅在触屏设备上禁止 `root` 参与 View Transition；保留 `work-card`。
- `test/browser/shelf.spec.mjs`：补书、影的真实触屏点按回归；沿用已有音乐拖动测试。

### Task 1: 修复书、影的触摸翻面

**Files:** `app.js`、`test/browser/shelf.spec.mjs`

- [x] **Step 1: 在已有触屏测试附近加入失败用例。** 使用真实 `tap()`，不能用 `dispatchEvent("click")` 代替手指。

```js
for (const route of ["/", "/film.html"]) {
  test(`${route} 触摸详情卡能从信息面翻回封面并再次翻回`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await page.goto(route);
      await waitForShelf(page);
      await page.locator(".media-object").first().tap({ force: true });
      const flip = page.locator("#work-flip");
      await expect(flip).toHaveClass(/is-flipped/);
      await flip.tap();
      await expect(flip).not.toHaveClass(/is-flipped/);
      await flip.tap();
      await expect(flip).toHaveClass(/is-flipped/);
    } finally {
      await context.close();
    }
  });
}
```

- [x] **Step 2: 运行目标用例，确认旧代码失败在第一次 `flip.tap()` 后仍有 `is-flipped`。**

```sh
npx playwright test test/browser/shelf.spec.mjs -g '触摸详情卡能从信息面翻回封面'
```

- [x] **Step 3: 只改 `workFlip` 的 `pointerdown` 早退条件，让所有触摸类型建立指针状态；非触摸仍仅允许音乐倾斜。** 保留现有 `pointerup` 的移动阈值和 `click` 去重。

```js
workFlip.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") skipFlipClick = false;
  if (event.pointerType !== "touch" && !canTiltCover()) return;
  coverPointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  workFlip.setPointerCapture(event.pointerId);
});
```

- [x] **Step 4: 目标用例应通过；再运行已有“触屏音乐先显示封面，拖动不误翻，点按才翻面”。** 手指在书/影背面滚动长内容时必须能滚动，不能因指针捕获误翻。
- [ ] **Step 5: 形成独立提交。** 只包含上述两处文件。

### Task 2: 只清除触摸遗留的橙色焦点轮廓

**Files:** `app.js`、`styles.css`、`test/browser/shelf.spec.mjs`

- [x] **Step 1: 加移动端回归用例。** 触摸打开、关闭后检查输入模式标记和原封面；随后按 Tab 确认标记撤销。颜色是否仍出现必须辅以真机或截图验收，Chromium 的触摸 `:focus-visible` 行为不能代替 iOS。

```js
test("触摸焦点不遗留橙色圈，转为键盘操作后恢复焦点提示", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await waitForShelf(page);
    await page.locator(".media-object").first().tap({ force: true });
    await expect(page.locator("body")).toHaveAttribute("data-touch-input", "true");
    await page.locator(".work-close").tap();
    await expect(page.locator("body")).toHaveAttribute("data-touch-input", "true");
    await page.keyboard.press("Tab");
    await expect(page.locator("body")).not.toHaveAttribute("data-touch-input");
  } finally {
    await context.close();
  }
});
```

- [x] **Step 2: 运行目标用例，确认标记不存在而失败。**

```sh
npx playwright test test/browser/shelf.spec.mjs -g '触摸焦点不遗留橙色圈'
```

- [x] **Step 3: 在 `app.js` 现有文档事件监听区加入输入模式跟踪。** 触摸置位；鼠标、触控笔或键盘切换时撤销。不改变原有焦点回退逻辑。

```js
document.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch") document.body.dataset.touchInput = "true";
  else delete document.body.dataset.touchInput;
}, { capture: true });
document.addEventListener("keydown", () => {
  delete document.body.dataset.touchInput;
}, { capture: true });
```

- [x] **Step 4: 在 `styles.css` 现有 `:focus-visible` 规则之后添加局部覆盖。** 不覆盖筛选、分享等其他控件，也不删除全站焦点规则。

```css
body[data-touch-input="true"] :is(.media-object,.work-close,.work-flip):focus-visible {
  outline:none;
}
```

- [ ] **Step 5: 用触屏模拟重跑目标用例，并以键盘在详情中聚焦关闭按钮与封面，确认非触摸时仍有焦点提示。** 自动化已通过：触摸状态焦点轮廓为 `none`，键盘状态为 `solid`；iPhone 真机检查打开、翻面、关闭后的两处橙色轮廓均消失仍待完成。
- [ ] **Step 6: 形成独立提交。**

### Task 3: 减少手机打开详情时的整页动画负担

**Files:** `shelf.css`

- [x] **Step 1: 在 `shelf.css` 增加触屏专用规则，禁止整页参与 View Transition；不要关闭卡片 `work-card`。** 已在临时注入实验中确认可保留卡片动画、移除 `root` 动画。

```css
@media (hover:none) and (pointer:coarse) {
  html { view-transition-name:none; }
}
```

- [x] **Step 2: 用 390×844 触屏与桌面鼠标分别打开、关闭书/影/音详情。** 手机只应有 `work-card` 共享动画；桌面仍保留原开合；背景点击与关闭按钮都能可靠关闭。检查动画期间没有残留的透明点击层、封面位置跳动或橙色轮廓。动画层对照已通过；iPhone 真机观感仍待验收。
- [ ] **Step 3: 做短时性能对照并真机验收。** 桌面模拟与触屏模拟的动画层已对照；限速帧间隔样本波动，不能用来判断真机流畅度。需在同一 iPhone、同一浏览器中比较修改前后打开与关闭卡片，至少检查微信内浏览器，再检查 Safari。若仍能明显感知停顿，执行 Task 4；否则停止，不扩大改动。
- [ ] **Step 4: 形成独立提交。**

### Task 4: 仅在真机仍卡顿时启用触屏降级

**Files:** `app.js`、`shelf.css`

- [ ] **Step 1: 仅修改现有 `canMorph`，让触屏设备直接打开原生详情弹窗；桌面仍走共享元素动画。**

```js
const canMorph = () => typeof document.startViewTransition === "function"
  && !matchMedia("(prefers-reduced-motion: reduce)").matches
  && !matchMedia("(hover: none) and (pointer: coarse)").matches;
```

- [ ] **Step 2: 在触屏媒体查询中删去 Task 3 的 `html { view-transition-name:none; }`，因为触屏已不再启动 View Transition。** 不叠加新的 3D、玻璃或全屏模糊动效；沿用现有弹窗与背景过渡。
- [ ] **Step 3: 重验手机开、关、翻面和焦点；真机对照确认确实比 Task 3 更顺滑，且视觉没有变得突兀。** 若视觉不接受或改善不明显，撤销本任务，保留 Task 1–3 的结果。
- [ ] **Step 4: 若采用，单独提交；若不采用，不留半套降级代码。**

## 最终验收与边界

- 手机书、影：点一次打开信息面，再点卡片翻到封面，再点回信息面；音乐维持封面先显示、拖动不误翻、点按能翻面。
- 手机：打开、翻面、关闭、回到原封面后，不出现橙色轮廓；接入键盘时焦点提示仍在。
- 动画：手机打开与关闭不再出现明显停顿、残影或整页闪动；桌面交互与视觉保持原状。若 Task 3 不够，Task 4 必须由真机结果触发。
- 运行 `npm run test:all`。本地模拟通过不等于 iPhone 微信内浏览器通过；上线前在真机确认，再合并推送与检查 GitHub Pages 新 SHA。
