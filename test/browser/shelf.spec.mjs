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

test("320px 目录头部和底栏都在视口内，长分类不产生横向滚动", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/browse.html");
  await expect(page.locator("#catalog-status")).toContainText("找到");
  const bounds = await page.evaluate(() => {
    const rects = [".brand", ".media-nav", ".site-footer"].map((selector) => document.querySelector(selector).getBoundingClientRect());
    return { rects, viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.viewport);
  for (const rect of bounds.rects) {
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.right).toBeLessThanOrEqual(bounds.viewport);
  }
  await page.locator("#catalog-type").selectOption("music");
  const longCategory = page.locator("#catalog-category option").filter({ hasText: "Cantopop" }).first();
  await page.locator("#catalog-category").selectOption(await longCategory.getAttribute("value"));
  await expect(page.locator("#catalog-category")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
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
