import { test, expect, type Page } from "@playwright/test";

async function demo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Take a look around with demo data" }).click();
  await expect(page.locator(".app-shell")).toBeVisible();
}
async function openEntry(page: Page) {
  await page.getByRole("button", { name: "Add transaction", exact: true }).filter({ visible: true }).first().click();
  await expect.poll(() => page.locator(".modal-backdrop").getAttribute("data-phase")).toBe("open");
}

test("a long swipe keeps moving downward during dismissal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await demo(page);
  await openEntry(page);
  const handle = page.getByRole("button", { name: "Close sheet", exact: true });
  const box = (await handle.boundingBox())!;
  // A short drag should settle back and stay open before a longer dismissal.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 20, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect.poll(() => page.locator(".modal").evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42)).toBe(0);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 220, { steps: 12 });
  await page.evaluate(() => {
    (window as any).motionSample = [];
    const el = document.querySelector(".modal")!;
    const tick = () => {
      if (!el.isConnected) return;
      (window as any).motionSample.push(el.getBoundingClientRect().top);
      requestAnimationFrame(tick);
    };
    tick();
  });
  await page.mouse.up();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const positions: number[] = await page.evaluate(() => (window as any).motionSample);
  expect(positions.length).toBeGreaterThan(2);
  for (let i = 1; i < positions.length; i++) expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1] - 1);
});

test("Spend check controls align at narrow widths and enlarged text", async ({ page }) => {
  await demo(page);
  const nav = page.getByRole("navigation", { name: await page.locator(".bottom-nav").isVisible() ? "Mobile navigation" : "Main navigation" });
  await nav.getByRole("button", { name: "Plan", exact: true }).click();
  await page.getByRole("button", { name: "Spend check", exact: true }).click();
  for (const width of [320, 360, 390, 412, 540, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const enlarged of [false, true]) {
      await page.locator(".spend-check .field > span").evaluateAll((els, large) => els.forEach((el) => (el as HTMLElement).style.fontSize = large ? "20px" : ""), enlarged);
      const amount = (await page.getByLabel("Planned purchase amount").boundingBox())!;
      const period = (await page.getByLabel("Plan ahead").boundingBox())!;
      expect(Math.abs(amount.height - period.height), `height at ${width}`).toBeLessThan(1);
      if (Math.abs(amount.x - period.x) > 5) expect(Math.abs(amount.y - period.y), `top at ${width}, enlarged=${enlarged}`).toBeLessThan(1);
      else expect(period.y).toBeGreaterThan(amount.y + amount.height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test("viewport resizing during close cannot pull the sheet upward", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 540 });
  await demo(page);
  await openEntry(page);
  await page.getByLabel("Amount", { exact: true }).focus();
  await page.evaluate(() => {
    (window as any).motionSample = [];
    const el = document.querySelector(".modal")!;
    const tick = () => {
      if (!el.isConnected) return;
      (window as any).motionSample.push(el.getBoundingClientRect().top);
      requestAnimationFrame(tick);
    };
    tick();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  });
  // Simulate the visual viewport expanding as a phone keyboard hides.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const positions: number[] = await page.evaluate(() => (window as any).motionSample);
  for (let i = 1; i < positions.length; i++) expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1] - 1);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openEntry(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
