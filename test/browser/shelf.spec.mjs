import { expect, test } from "@playwright/test";

async function waitForShelf(page) {
  await expect(page.locator("#shelf-stage")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".media-object").first()).toBeVisible();
}

test("首页默认散落书架，书影音切换与浏览器返回保持正确", async ({ page }) => {
  await page.goto("/");
  await waitForShelf(page);
  await expect(page.locator("#shelf-stage")).toHaveAttribute("data-mode", "scatter");
  await expect(page.locator("#item-kind")).toHaveText("书");
  await page.locator('.media-nav [data-type="film"]').click();
  await expect(page).toHaveURL(/\/film\.html$/);
  await expect(page.locator("#item-kind")).toHaveText("影");
  await page.locator('.media-nav [data-type="music"]').click();
  await expect(page).toHaveURL(/\/music\.html$/);
  await expect(page.locator("#item-kind")).toHaveText("音");
  await page.goBack();
  await page.goBack();
  await waitForShelf(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#item-kind")).toHaveText("书");
});

test("选择分类后再次点击同一分类会取消，非匹配封面保留轻微退后感", async ({ page }) => {
  await page.goto("/");
  await waitForShelf(page);
  await page.locator('[data-action="filter"]').click();
  await page.locator('.filter-pill[data-category="投资"]').click();
  await expect(page.locator('[data-action="filter"]')).toContainText("投资");
  expect(await page.locator(".media-object.is-dimmed").count()).toBeGreaterThan(0);
  await expect.poll(async () => Number(await page.locator(".media-object.is-dimmed").first().evaluate((node) => getComputedStyle(node).opacity))).toBeCloseTo(0.12, 2);
  await page.locator('[data-action="filter"]').click();
  await page.locator('.filter-pill[data-category="投资"]').click();
  await expect(page.locator('[data-action="filter"]')).toHaveText("筛选");
  await expect(page.locator(".media-object.is-dimmed")).toHaveCount(0);
});

test("少量分类进入分享时可选全部五件，取消后恢复分类", async ({ page }) => {
  const records = Array.from({ length: 6 }, (_, index) => ({
    id: `book:share-${index}`,
    type: "book",
    title: `作品 ${index}`,
    creator: "测试作者",
    cover: "public/avatar.png",
    categories: index === 0 ? ["少量"] : ["其他"],
  }));
  await page.route("**/data/media.json", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(records),
  }));
  await page.goto("/");
  await waitForShelf(page);
  await page.locator('[data-action="filter"]').click();
  await page.locator('.filter-pill[data-category="少量"]').click();
  await expect(page.locator(".media-object.is-dimmed")).toHaveCount(5);
  await page.locator('[data-action="share"]').click();
  await expect(page.locator(".media-object.is-dimmed")).toHaveCount(0);
  for (let index = 0; index < 5; index += 1) {
    await page.locator(".media-object").nth(index).dispatchEvent("click");
  }
  await expect(page.locator("#make-poster")).toBeEnabled();
  await page.locator('[data-action="share"]').click();
  await expect(page.locator('[data-action="filter"]')).toContainText("少量");
  await expect(page.locator(".media-object.is-dimmed")).toHaveCount(5);
});

for (const route of ["/", "/film.html", "/music.html"]) {
  test(`${route} 加载中不显示零件且不开放操作`, async ({ page }) => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    await page.route("**/data/media.json", async (request) => {
      await gate;
      await request.continue();
    });
    await page.goto(route, { waitUntil: "domcontentloaded" });
    try {
      await expect(page.locator(".shelf-loading")).toBeVisible();
      await expect(page.locator("#item-count")).toHaveText("…");
      for (const action of ["layout", "filter", "share"]) {
        await expect(page.locator(`[data-action="${action}"]`)).toBeDisabled();
      }
    } finally {
      release();
    }
    await waitForShelf(page);
    await expect(page.locator(".shelf-loading")).toHaveCount(0);
    await expect(page.locator('[data-action="share"]')).toBeEnabled();
  });
}

test("读取失败只留下重试，成功后恢复操作", async ({ page }) => {
  let fail = true;
  await page.route("**/data/media.json", (request) => fail
    ? request.fulfill({ status: 503, body: "暂不可用" })
    : request.continue());
  await page.goto("/");
  await expect(page.locator(".shelf-error")).toBeVisible();
  for (const action of ["layout", "filter", "share"]) {
    await expect(page.locator(`[data-action="${action}"]`)).toBeDisabled();
  }
  fail = false;
  await page.locator('[data-action="retry"]').click();
  await waitForShelf(page);
  await expect(page.locator('[data-action="share"]')).toBeEnabled();
});

test("数据读取超时显示重试，第二次请求成功恢复书架", async ({ page }) => {
  const record = { id: "book:timeout-retry", type: "book", title: "超时后恢复", creator: "测试", cover: "public/avatar.png", categories: [] };
  await page.clock.install();
  await page.addInitScript((records) => {
    const originalFetch = window.fetch.bind(window);
    window.mediaAttempts = 0;
    window.fetch = async (resource, options = {}) => {
      if (!String(resource).includes("data/media.json")) return originalFetch(resource, options);
      window.mediaAttempts += 1;
      if (window.mediaAttempts > 1) return new Response(JSON.stringify(records), { status: 200, headers: { "content-type": "application/json" } });
      return new Promise((resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
      });
    };
  }, [record]);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".shelf-loading")).toBeVisible();
  await page.clock.fastForward(15_000);
  await expect(page.locator(".shelf-error")).toContainText("读取超时");
  await page.locator('[data-action="retry"]').click();
  await waitForShelf(page);
  await expect(page.locator(".media-object")).toContainText("超时后恢复");
});

test("加载期间连续切类保留加载状态，完成后显示最后选定类别", async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route("**/data/media.json", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  try {
    await page.locator('.media-nav [data-type="film"]').click();
    await page.locator('.media-nav [data-type="music"]').click();
    await expect(page.locator(".shelf-loading")).toBeVisible();
    await expect(page.locator("#shelf-stage")).toHaveAttribute("aria-busy", "true");
    await expect(page.locator("#item-count")).toHaveText("…");
    await expect(page.locator('[data-action="share"]')).toBeDisabled();
  } finally {
    release();
  }
  await waitForShelf(page);
  await expect(page).toHaveURL(/\/music\.html$/);
  await expect(page.locator("#item-kind")).toHaveText("音");
});

test("加载失败后切类保留重试，并在恢复后进入最后选定类别", async ({ page }) => {
  let fail = true;
  await page.route("**/data/media.json", (route) => fail
    ? route.fulfill({ status: 503, body: "暂不可用" })
    : route.continue());
  await page.goto("/");
  await expect(page.locator(".shelf-error")).toBeVisible();
  await page.locator('.media-nav [data-type="film"]').click();
  await expect(page.locator(".shelf-error")).toBeVisible();
  await expect(page.locator('[data-action="retry"]')).toBeVisible();
  fail = false;
  await page.locator('[data-action="retry"]').click();
  await waitForShelf(page);
  await expect(page).toHaveURL(/\/film\.html$/);
  await expect(page.locator("#item-kind")).toHaveText("影");
});

test("目录加载失败时检索不能覆盖重试，恢复后开放控件", async ({ page }) => {
  let fail = true;
  await page.route("**/data/media.json", (route) => fail
    ? route.fulfill({ status: 503, body: "暂不可用" })
    : route.continue());
  await page.goto("/browse.html");
  await expect(page.locator("#catalog-status")).toContainText("503");
  for (const selector of ["#catalog-search", "#catalog-type", "#catalog-category"]) {
    await expect(page.locator(selector)).toBeDisabled();
  }
  await expect(page.locator(".page-retry")).toBeVisible();
  fail = false;
  await page.locator(".page-retry").click();
  await expect(page.locator("#catalog-status")).toContainText("找到");
  await expect(page.locator("#catalog-search")).toBeEnabled();
});

test("目录分帧呈现，切换分类会丢弃过期批次", async ({ page }) => {
  await page.addInitScript(() => {
    window.catalogFrames = [];
    window.flushCatalogFrames = () => {
      while (window.catalogFrames.length) window.catalogFrames.shift()(performance.now());
    };
    window.requestAnimationFrame = (callback) => {
      window.catalogFrames.push(callback);
      return window.catalogFrames.length;
    };
  });
  await page.goto("/browse.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#catalog-status")).toContainText("找到 736");
  const countCards = () => page.evaluate(() => document.querySelectorAll(".catalog-card").length);
  expect(await countCards()).toBeLessThan(736);
  await page.locator("#catalog-type").selectOption("music");
  expect(await countCards()).toBeLessThan(261);
  await page.evaluate(() => window.flushCatalogFrames());
  await expect.poll(countCards).toBe(261);
});

test("主动切换陈列从顶部进入，返回仍在旧陈列位置", async ({ page }) => {
  await page.goto("/");
  await waitForShelf(page);
  await page.evaluate(() => scrollTo(0, 700));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(400);
  await page.locator('.media-nav [data-type="film"]').click();
  await expect(page).toHaveURL(/\/film\.html$/);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(2);
  await page.goBack();
  await waitForShelf(page);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(400);
});

test("单击封面打开浮层、翻面、背景关闭并把焦点还给原封面", async ({ page }) => {
  await page.goto("/");
  await waitForShelf(page);
  const cover = page.locator(".media-object").first();
  await cover.click({ force: true });
  await expect(page.locator("#work-dialog")).toBeVisible();
  await page.locator("#work-flip").click();
  await expect(page.locator("#work-flip")).toHaveClass(/is-flipped/);
  await page.mouse.click(6, 6);
  await expect(page.locator("#work-dialog")).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.className)).toContain("media-object");
});

test("音乐详情封面跟随指针并回正，点击仍能翻面", async ({ page }) => {
  await page.goto("/music.html");
  await waitForShelf(page);
  await page.locator(".media-object").first().dispatchEvent("click");
  const cover = page.locator("#work-flip");
  await expect(cover).toBeVisible();
  await expect(cover).not.toHaveClass(/is-flipped/);
  const bounds = await cover.boundingBox();
  await expect.poll(() => page.evaluate(([x, y]) => Boolean(document.elementFromPoint(x, y)?.closest("#work-flip")), [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2])).toBe(true);
  await page.mouse.move(bounds.x + bounds.width * 0.8, bounds.y + bounds.height * 0.2);
  await expect(cover).toHaveClass(/is-tilting/);
  expect(await cover.evaluate((node) => node.style.getPropertyValue("--tilt-y"))).not.toBe("0deg");
  await page.mouse.move(4, 4);
  await expect(cover).not.toHaveClass(/is-tilting/);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 42, bounds.y + bounds.height / 2 + 18);
  await page.mouse.up();
  await expect(cover).not.toHaveClass(/is-flipped/);
  await cover.click();
  await expect(cover).toHaveClass(/is-flipped/);
});

test("触屏音乐先显示封面，拖动不误翻，点按才翻面", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await page.goto("/music.html");
    await waitForShelf(page);
    await page.locator(".media-object").first().dispatchEvent("click");
    const cover = page.locator("#work-flip");
    await expect(cover).toBeVisible();
    await expect(cover).not.toHaveClass(/is-flipped/);
    const bounds = await cover.boundingBox();
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    await expect.poll(() => page.evaluate(([clientX, clientY]) => Boolean(document.elementFromPoint(clientX, clientY)?.closest("#work-flip")), [x, y])).toBe(true);
    const input = await context.newCDPSession(page);
    await input.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await input.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + 42, y: y + 18 }] });
    await expect(cover).toHaveClass(/is-tilting/);
    await input.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(cover).not.toHaveClass(/is-flipped/);
    await cover.tap();
    await expect(cover).toHaveClass(/is-flipped/);
    await cover.tap();
    await expect(cover).not.toHaveClass(/is-flipped/);
  } finally {
    await context.close();
  }
});

test("分享选择五件、打开海报、关闭后焦点回到分享按钮", async ({ page }) => {
  await page.goto("/");
  await waitForShelf(page);
  const share = page.locator('[data-action="share"]');
  await share.click();
  const objects = page.locator(".media-object");
  for (let index = 0; index < 5; index += 1) await objects.nth(index).dispatchEvent("click");
  await expect(page.locator("#make-poster")).toBeEnabled();
  await page.locator("#make-poster").click();
  await expect(page.locator("#poster-dialog")).toBeVisible({ timeout: 30_000 });
  await page.locator("#poster-dialog .dialog-close").click();
  await expect.poll(() => page.evaluate(() => document.activeElement?.dataset.action)).toBe("share");
});

test("取消等待字体的海报任务后，新一轮生成不受旧任务影响", async ({ page }) => {
  await page.addInitScript(() => {
    const original = document.fonts.load.bind(document.fonts);
    const originalShowModal = HTMLDialogElement.prototype.showModal;
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    window.releasePosterFont = release;
    window.posterFontRequests = 0;
    window.posterDialogOpens = 0;
    window.posterBlobCalls = 0;
    HTMLDialogElement.prototype.showModal = function (...args) {
      if (this.id === "poster-dialog") window.posterDialogOpens += 1;
      return originalShowModal.apply(this, args);
    };
    HTMLCanvasElement.prototype.toBlob = function (...args) {
      window.posterBlobCalls += 1;
      return originalToBlob.apply(this, args);
    };
    document.fonts.load = async (...args) => {
      window.posterFontRequests += 1;
      await gate;
      return original(...args);
    };
  });
  await page.goto("/");
  await waitForShelf(page);
  const share = page.locator('[data-action="share"]');
  const objects = page.locator(".media-object");
  await share.click();
  for (let index = 0; index < 5; index += 1) await objects.nth(index).dispatchEvent("click");
  await page.locator("#make-poster").click();
  await expect.poll(() => page.evaluate(() => window.posterFontRequests)).toBe(1);
  await share.click();
  await expect(page.locator("#pick-status")).toBeHidden();
  await share.click();
  for (let index = 0; index < 5; index += 1) await objects.nth(index).dispatchEvent("click");
  await page.locator("#make-poster").click();
  await expect.poll(() => page.evaluate(() => window.posterFontRequests)).toBe(2);
  await page.evaluate(() => window.releasePosterFont());
  await expect.poll(() => page.evaluate(() => window.posterBlobCalls)).toBe(1);
  await expect(page.locator("#poster-dialog")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.posterDialogOpens)).toBe(1);
  await page.locator("#poster-dialog .dialog-close").click();
  await expect.poll(() => page.evaluate(() => document.activeElement?.dataset.action)).toBe("share");
});

test("取消正在等待字体的海报后，不会在稍后弹出旧结果", async ({ page }) => {
  await page.addInitScript(() => {
    const original = document.fonts.load.bind(document.fonts);
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    window.releasePosterFont = release;
    window.posterFontRequested = false;
    window.posterBlobCalls = 0;
    document.fonts.load = async (...args) => {
      window.posterFontRequested = true;
      await gate;
      return original(...args);
    };
    HTMLCanvasElement.prototype.toBlob = function (...args) {
      window.posterBlobCalls += 1;
      return originalToBlob.apply(this, args);
    };
  });
  await page.goto("/");
  await waitForShelf(page);
  const share = page.locator('[data-action="share"]');
  const objects = page.locator(".media-object");
  await share.click();
  for (let index = 0; index < 5; index += 1) await objects.nth(index).dispatchEvent("click");
  await page.locator("#make-poster").click();
  await expect.poll(() => page.evaluate(() => window.posterFontRequested)).toBe(true);
  await share.click();
  await expect(page.locator("#pick-status")).toBeHidden();
  await page.evaluate(() => window.releasePosterFont());
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect.poll(() => page.evaluate(() => window.posterBlobCalls)).toBe(0);
  await expect(page.locator("#poster-dialog")).not.toBeVisible();
});

test("海报字体等待超时后保留选择并可再次生成", async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    const original = document.fonts.load.bind(document.fonts);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    window.releasePosterFont = release;
    window.posterFontRequested = false;
    document.fonts.load = async (...args) => {
      window.posterFontRequested = true;
      await gate;
      return original(...args);
    };
  });
  await page.goto("/");
  await waitForShelf(page);
  await page.locator('[data-action="share"]').click();
  const objects = page.locator(".media-object");
  for (let index = 0; index < 5; index += 1) await objects.nth(index).dispatchEvent("click");
  await page.locator("#make-poster").click();
  await expect.poll(() => page.evaluate(() => window.posterFontRequested)).toBe(true);
  await page.clock.fastForward(20_000);
  await expect(page.locator("#pick-status .pick-label")).toContainText("海报生成超时，请重试");
  await expect(page.locator("#make-poster")).toBeEnabled();
  await page.evaluate(() => window.releasePosterFont());
  await page.locator("#make-poster").click();
  await expect(page.locator("#poster-dialog")).toBeVisible();
});

test("320px 目录头部和底栏都在视口内，长分类不产生横向滚动", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/browse.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#catalog-status")).toContainText("找到");
  await expect(page.locator("#catalog-type")).toBeEnabled();
  await expect(page.locator("#catalog-category")).toBeEnabled();
  await page.locator("#catalog-type").selectOption("music");
  const longCategory = page.locator("#catalog-category option").filter({ hasText: "Cantopop" }).first();
  await expect(longCategory).toHaveCount(1);
  await page.locator("#catalog-category").selectOption(await longCategory.getAttribute("value"));
  await expect(page.locator("#catalog-category")).toBeVisible();
  const bounds = await page.evaluate(() => {
    const rects = [".brand", ".media-nav", ".site-footer"].map((selector) => document.querySelector(selector).getBoundingClientRect());
    return { rects, viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  expect(bounds.scrollWidth).toBeLessThanOrEqual(320);
  for (const rect of bounds.rects) {
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.right).toBeLessThanOrEqual(bounds.viewport);
  }
});

test("三类详情卡和关闭按钮在短视口、横屏及 200% 等效视口内", async ({ page }) => {
  const viewports = [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 667, height: 375 },
    { width: 844, height: 390 },
    { width: 1280, height: 720 },
    { width: 640, height: 360 },
  ];
  for (const route of ["/", "/film.html", "/music.html"]) {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(route);
    await waitForShelf(page);
    await page.locator(".media-object").first().click({ force: true });
    await expect(page.locator("#work-dialog")).toBeVisible();
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      const bounds = await page.evaluate(() => {
        const rect = (selector) => {
          const { left, right, top, bottom, width, height } = document.querySelector(selector).getBoundingClientRect();
          return { left, right, top, bottom, width, height };
        };
        return { viewport: { width: innerWidth, height: innerHeight }, card: rect("#work-flip"), close: rect(".work-close") };
      });
      for (const element of [bounds.card, bounds.close]) {
        expect(element.left, `${route} ${viewport.width}x${viewport.height}`).toBeGreaterThanOrEqual(0);
        expect(element.top, `${route} ${viewport.width}x${viewport.height}`).toBeGreaterThanOrEqual(0);
        expect(element.right, `${route} ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(bounds.viewport.width);
        expect(element.bottom, `${route} ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(bounds.viewport.height);
      }
      expect(bounds.close.width).toBeGreaterThanOrEqual(44);
      expect(bounds.close.height).toBeGreaterThanOrEqual(44);
    }
    await page.locator(".work-close").click({ force: true });
  }
});

test("长背面信息可滚动到底部且评分与完读日期可达", async ({ page }) => {
  const record = {
    id: "book:long-detail",
    type: "book",
    title: "这是一条用于验证详情卡长标题完整显示的测试记录",
    creator: "长作者名称。".repeat(24),
    cover: "public/avatar.png",
    categories: Array.from({ length: 12 }, (_, index) => `LongCategory${index}`),
    completedMonth: "2026-10",
    rating: 5,
  };
  await page.route("**/data/media.json", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([record]),
  }));
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto("/");
  await waitForShelf(page);
  await page.locator(".media-object").first().click({ force: true });
  await page.locator("#work-flip").click();
  const content = page.locator(".work-back-content");
  await expect.poll(() => content.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
  await page.locator("#work-flip").focus();
  await page.keyboard.press("End");
  await expect.poll(() => content.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  const bottom = await content.evaluate((node) => Math.abs(node.scrollHeight - node.clientHeight - node.scrollTop) < 2);
  expect(bottom).toBe(true);
  await expect(page.locator("#work-rating")).toBeVisible();
  await expect(page.locator("#work-meta")).toContainText("完读日期：2026年10月");
});

for (const { route, title, ratio } of [
  { route: "/", title: "不二", ratio: 2 / 3 },
  { route: "/film.html", title: "猜火车", ratio: 2 / 3 },
  { route: "/music.html", title: "Live for Today", ratio: 1 },
]) {
  test(`${title} 在书架、详情和目录均使用类别展示比例`, async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 900 });
    await page.goto(route);
    await waitForShelf(page);
    const object = page.locator(".media-object").filter({ hasText: title }).first();
    await expect(object).toHaveCount(1);
    const image = object.locator("img");
    await expect.poll(() => image.evaluate((node) => node.offsetWidth / node.offsetHeight)).toBeCloseTo(ratio, 2);
    await object.dispatchEvent("click");
    await expect(page.locator("#work-dialog")).toBeVisible();
    const detailRatio = await page.locator(".work-flip-inner").evaluate((node) => node.offsetWidth / node.offsetHeight);
    expect(detailRatio).toBeCloseTo(ratio, 2);
    await page.goto("/browse.html");
    await expect(page.locator("#catalog-status")).toContainText("找到");
    await page.locator("#catalog-search").fill(title);
    const card = page.locator(".catalog-card").filter({ hasText: title }).first();
    await expect(card).toBeVisible();
    const cardRatio = await card.locator("img").evaluate((node) => node.offsetWidth / node.offsetHeight);
    expect(cardRatio).toBeCloseTo(ratio, 2);
  });
}
