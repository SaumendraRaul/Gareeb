import { test, expect, type Page } from "@playwright/test";
async function demo(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Take a look around with demo data" })
    .click();
  await expect(page.getByRole("heading", { name: "Hey friend" })).toBeVisible();
}
async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation", {
      name: (await page.locator(".bottom-nav").isVisible())
        ? "Mobile navigation"
        : "Main navigation",
    })
    .getByRole("button", { name, exact: true })
    .click();
}
async function add(page: Page) {
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .filter({ visible: true })
    .first()
    .click();
}
test("shortcuts prefill for review, survive restart, and duplicate without overwriting", async ({
  page,
}) => {
  await demo(page);
  await add(page);
  await page.getByLabel("Amount", { exact: true }).fill("120");
  await page.getByLabel("What was it for?").fill("Daily train");
  await page
    .getByText("More details · notes, receipt, shortcut", { exact: true })
    .click();
  await page.getByLabel("Save as a shortcut", { exact: false }).check();
  await page.getByRole("button", { name: "Save expense" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Use shortcut Daily train" }).click();
  await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("120");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Use shortcut Daily train" }).click();
  await page.getByLabel("Amount", { exact: true }).fill("150");
  await page.getByRole("button", { name: "Save expense" }).click();
  await nav(page, "Activity");
  await page.getByLabel("Search transactions").fill("Daily train");
  await expect(page.locator(".transaction")).toHaveCount(2);
  await page.locator(".transaction").first().click();
  await page.getByRole("button", { name: "Duplicate for today" }).click();
  await expect(page.getByRole("dialog")).toHaveAttribute(
    "aria-label",
    "New transaction",
  );
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.locator(".transaction")).toHaveCount(3);
  await nav(page, "Overview");
  await page
    .getByRole("button", { name: "Remove shortcut Daily train" })
    .click();
  await expect(
    page.getByRole("button", { name: "Use shortcut Daily train" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Use shortcut Daily train" }),
  ).toBeVisible();
});
test("calendar filters a day and weekly recap renders at 320px", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 320, height: 760 });
  await demo(page);
  await nav(page, "Activity");
  await page.getByRole("button", { name: "Calendar", exact: true }).click();
  const date = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  await page
    .getByRole("button", { name: new RegExp("^" + date + ":") })
    .click();
  await expect(
    page.getByRole("heading", { name: /Transactions on/ }),
  ).toBeVisible();
  await expect(page.locator(".calendar-summary")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Show full month" }).click();
  await expect(
    page.getByRole("heading", { name: "Every transaction", exact: true }),
  ).toBeVisible();
  await nav(page, "Insights");
  await expect(
    page.getByRole("heading", { name: "Your seven-day check-in" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await nav(page, "Plan");
  await page.getByRole("button", { name: "Bills", exact: true }).click();
  await expect(page.getByText("Your recurring commitments")).toBeVisible();
  expect(errors).toEqual([]);
});
test("haptics and reduced motion preferences persist and system reduced motion wins", async ({
  page,
}) => {
  await demo(page);
  await page
    .getByRole("button", { name: "Open settings", exact: true })
    .click();
  await page.getByRole("switch", { name: "Haptic feedback" }).uncheck();
  await expect(page.getByRole("status")).toContainText(
    "Haptic preference saved",
  );
  await page.getByRole("switch", { name: "Reduce motion" }).check();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await page.reload();
  await page
    .getByRole("button", { name: "Open settings", exact: true })
    .click();
  await expect(
    page.getByRole("switch", { name: "Haptic feedback" }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("switch", { name: "Reduce motion" }),
  ).toBeChecked();
  expect(
    await page
      .locator("main")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.getByRole("switch", { name: "Reduce motion" }).uncheck();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await nav(page, "Overview");
  expect(
    await page
      .locator("main")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});
test("mobile sheets support drag dismissal without saving", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await demo(page);
  await add(page);
  await page.getByLabel("What was it for?").fill("Unsubmitted draft");
  const handle = page.getByRole("button", { name: "Close sheet", exact: true });
  const box = await handle.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width / 2,
    box!.y + box!.height / 2 + 130,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav(page, "Activity");
  await page.getByLabel("Search transactions").fill("Unsubmitted draft");
  await expect(page.locator(".transaction")).toHaveCount(0);
});
