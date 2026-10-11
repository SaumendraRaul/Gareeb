import { test, expect, type Page } from "@playwright/test";

async function demo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Take a look around with demo data" }).click();
  await expect(page.locator(".app-shell")).toBeVisible();
}
async function menu(page: Page) {
  return page.getByRole("navigation", { name: await page.locator(".bottom-nav").isVisible() ? "Mobile navigation" : "Main navigation" });
}
async function settle(page: Page, view: string) {
  await expect(page.locator("main.content")).toHaveAttribute("data-view", view);
  await expect(page.locator("main.content")).toHaveAttribute("data-phase", "idle");
}

test("tab changes have real exit and directional entry frames", async ({ page }) => {
  await demo(page);
  for (const [label, target, direction] of [["Activity", "activity", 1], ["Overview", "home", -1]] as const) {
    const frames = await page.evaluate(async ({ label, target }) => {
      const nav = [...document.querySelectorAll("nav")].find(el => el.getClientRects().length)!;
      const button = [...nav.querySelectorAll("button")].find(el => el.textContent?.trim() === label)!;
      const main = document.querySelector<HTMLElement>("main.content")!;
      const samples: { phase: string; x: number; opacity: number }[] = [];
      button.click();
      await new Promise<void>((resolve, reject) => {
        let count = 0;
        const tick = () => {
          const style = getComputedStyle(main);
          samples.push({ phase: main.dataset.phase || "idle", x: new DOMMatrixReadOnly(style.transform).m41, opacity: Number(style.opacity) });
          if (main.dataset.view === target && main.dataset.phase === "idle") return resolve();
          if (++count > 180) return reject(Error("Navigation did not settle"));
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      return samples;
    }, { label, target });
    expect(frames.some(f => f.phase === "exiting")).toBe(true);
    expect(frames.some(f => f.phase === "entering" && f.x * direction > 0.5)).toBe(true);
    expect(frames.some(f => f.opacity > 0.05 && f.opacity < 0.95)).toBe(true);
    expect(await page.locator("main.content").evaluate(el => (el as HTMLElement).inert)).toBe(false);
  }
});

test("rapid navigation keeps the last destination and leaves no invisible blocking layer", async ({ page }) => {
  await demo(page);
  const nav = await menu(page);
  for (const names of [["Plan", "Activity", "Wallets"], ["Insights", "Overview"]]) {
    await nav.evaluate(async (el, names) => {
      for (const name of names) {
        [...el.querySelectorAll("button")].find(b => b.textContent?.trim() === name)!.click();
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    }, names);
    await settle(page, names.at(-1) === "Wallets" ? "wallets" : "home");
    await expect(nav.locator('[aria-current="page"]')).toHaveText(names.at(-1)!);
    expect(await page.locator("[inert]").count()).toBe(0);
  }
  await page.getByRole("button", { name: "Add transaction", exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("button press and release animates, while keyboard activation still works", async ({ page }) => {
  await demo(page);
  const button = page.getByRole("button", { name: "Hide balances", exact: true });
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(() => button.evaluate(el => Number(getComputedStyle(el).scale))).toBeLessThan(0.98);
  await page.mouse.up();
  const shown = page.getByRole("button", { name: "Show balances", exact: true });
  await expect(shown).toBeVisible();
  await expect.poll(() => shown.evaluate(el => getComputedStyle(el).scale)).toBe("none");
  await shown.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Hide balances", exact: true })).toBeVisible();
});

test("moving highlights align after presses and resizing, subtabs keep form values", async ({ page }) => {
  await demo(page);
  await (await menu(page)).getByRole("button", { name: "Plan", exact: true }).click();
  await settle(page, "plan");
  await page.getByRole("button", { name: "Spend check", exact: true }).click();
  await expect(page.locator('.motion-panel[data-view="Spend check"]')).toHaveAttribute("data-phase", "idle");
  for (const width of [320, 390, 540, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.locator(".plan-tabs").evaluate(el => {
      const bounds = el.getBoundingClientRect();
      return [...el.querySelectorAll("button")].every(button => {
        const rect = button.getBoundingClientRect();
        return rect.left >= bounds.left && rect.right <= bounds.right && button.scrollWidth <= button.clientWidth;
      });
    })).toBe(true);
    await expect.poll(async () => {
      return page.locator(".plan-tabs").evaluate(el => {
        const active = el.querySelector("button.selected")!.getBoundingClientRect();
        const pill = el.querySelector(".moving-highlight")!.getBoundingClientRect();
        return Math.max(Math.abs(active.x - pill.x), Math.abs(active.width - pill.width), Math.abs(active.y - pill.y));
      });
    }).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await (await menu(page)).getByRole("button", { name: "Overview", exact: true }).click();
  await settle(page, "home");
  await page.getByRole("button", { name: "Add transaction", exact: true }).filter({ visible: true }).first().click();
  await page.getByLabel("Amount", { exact: true }).fill("123.45");
  await page.getByRole("button", { name: "Income", exact: true }).click();
  await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("123.45");
  await expect(page.getByRole("button", { name: "Save income", exact: true })).toBeVisible();
});

test("system and app reduced motion skip transitions without blocking navigation", async ({ page }) => {
  await demo(page);
  for (const system of [true, false]) {
    await page.emulateMedia({ reducedMotion: system ? "reduce" : "no-preference" });
    if (!system) await page.evaluate(() => { document.documentElement.dataset.motion = "reduced"; });
    const nav = await menu(page);
    await nav.getByRole("button", { name: system ? "Activity" : "Plan", exact: true }).click();
    await settle(page, system ? "activity" : "plan");
    expect(await page.locator("main.content").evaluate(el => el.getAnimations().length)).toBe(0);
    expect(await page.locator("[inert]").count()).toBe(0);
  }
});
