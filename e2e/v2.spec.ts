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
async function state(page: Page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("CapacitorStorage.gareeb.v1")!),
  );
}
async function circle(page: Page) {
  await nav(page, "Plan");
  await page.getByRole("button", { name: "Together", exact: true }).click();
  await page.getByRole("button", { name: "New group", exact: true }).click();
  await page.getByLabel("Group name", { exact: true }).fill("Goa weekend");
  await page
    .getByLabel("Members (comma separated)", { exact: true })
    .fill("You, Aman, Priya");
  await page.getByLabel("Group budget (optional)").fill("12000");
  await page.getByRole("button", { name: "Save group", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Goa weekend", exact: true }),
  ).toBeVisible();
}
test("shared groups preserve exact splits, custom amounts, partial payments and history", async ({
  page,
}) => {
  await demo(page);
  const before = await state(page);
  await circle(page);
  await page
    .getByRole("button", { name: "Add shared expense", exact: true })
    .click();
  await page.getByLabel("Shared expense title").fill("Sunset dinner");
  await page.getByLabel("Total shared amount").fill("100");
  await page
    .getByRole("button", { name: "Save shared expense", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  let saved = await state(page);
  expect(
    saved.groups[0].expenses[0].shares.map((x: { amount: number }) => x.amount),
  ).toEqual([3334, 3333, 3333]);
  expect(saved.transactions).toEqual(before.transactions);
  await page
    .getByRole("button", { name: "Record payment", exact: true })
    .first()
    .click();
  await page.getByLabel("Payment amount").fill("10");
  await page.getByRole("button", { name: "Confirm payment received" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  saved = await state(page);
  expect(saved.groups[0].settlements[0].amount).toBe(1000);
  await page
    .getByRole("button", { name: "Add shared expense", exact: true })
    .click();
  await page.getByLabel("Shared expense title").fill("Taxi");
  await page.getByLabel("Total shared amount").fill("90");
  await page
    .getByRole("button", { name: "Custom amounts", exact: true })
    .click();
  await page.getByLabel("You share", { exact: true }).fill("30");
  await page.getByLabel("Aman share", { exact: true }).fill("20");
  await page.getByLabel("Priya share", { exact: true }).fill("30");
  await page
    .getByRole("button", { name: "Save shared expense", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("add up exactly");
  await page.getByLabel("Priya share", { exact: true }).fill("40");
  await page
    .getByRole("button", { name: "Save shared expense", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await nav(page, "Plan");
  await page.getByRole("button", { name: "Together", exact: true }).click();
  await page.locator(".group-card").filter({ hasText: "Goa weekend" }).click();
  await expect(page.locator(".group-history")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Delete Taxi shared expense" })
    .click();
  await page
    .getByRole("button", { name: "Delete record", exact: true })
    .click();
  await expect(page.locator(".group-history")).toHaveCount(2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".group-history")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Archive group", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add shared expense", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Reopen group", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add shared expense", exact: true }),
  ).toBeVisible();
});
test("quick entry reviews before saving and custom categories reach filters and charts", async ({
  page,
}) => {
  await demo(page);
  const count = (await state(page)).transactions.length;
  await page.getByLabel("Describe an expense").fill("180 lunch yesterday cash");
  await page.getByRole("button", { name: "Review quick entry" }).click();
  await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("180");
  expect((await state(page)).transactions.length).toBe(count);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Open settings", exact: true })
    .click();
  await page.getByRole("button", { name: "New category", exact: true }).click();
  await page.getByLabel("Category name").fill("Pets");
  await page.getByLabel("Category icon").selectOption("Dog");
  await page
    .getByRole("button", { name: "Save category", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav(page, "Overview");
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByLabel("Amount", { exact: true }).fill("230");
  await page.getByLabel("What was it for?").fill("Cat food");
  await page
    .getByLabel("Category", { exact: true })
    .selectOption({ label: "Pets" });
  await page.getByRole("button", { name: "Save expense", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav(page, "Insights");
  await page
    .getByRole("button", { name: "Explore the changes", exact: true })
    .click();
  await page
    .locator(".story-changes button")
    .filter({ hasText: "Pets" })
    .click();
  await expect(page.locator(".transaction")).toHaveCount(1);
  await expect(page.locator(".transaction")).toContainText("Cat food");
});
test("weekly rollover preferences and encrypted backups survive restoration", async ({
  page,
}) => {
  await demo(page);
  await nav(page, "Plan");
  await page.getByRole("button", { name: "New budget", exact: true }).click();
  await page.getByLabel("Category", { exact: true }).selectOption("health");
  await page.getByLabel("Period limit").fill("250");
  await page.getByLabel("Budget period").selectOption("weekly");
  await page.getByLabel("Carry unused budget forward").check();
  await page.getByRole("button", { name: "Save budget", exact: true }).click();
  await expect(page.getByLabel("Week containing")).toBeVisible();
  expect(
    (await state(page)).budgets.find(
      (b: { category: string }) => b.category === "health",
    ),
  ).toMatchObject({ period: "weekly", rollover: true });
  await page
    .getByRole("button", { name: "Open settings", exact: true })
    .click();
  await page.getByRole("switch", { name: "Gareeb humour" }).check();
  await expect(page.getByRole("status").first()).toContainText("Personality");
  await page
    .locator(".privacy-settings")
    .getByRole("button", { name: "Export", exact: true })
    .click();
  await page
    .getByLabel("Backup passphrase", { exact: true })
    .fill("my little private vault");
  await page
    .getByLabel("Confirm passphrase", { exact: true })
    .fill("my little private vault");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Create encrypted backup" }).click();
  const file = await downloaded;
  const path = await file.path();
  expect(path).toBeTruthy();
  await page
    .locator('input[type=file][accept=".json,application/json"]')
    .setInputFiles(path!);
  await page
    .getByLabel("Backup passphrase", { exact: true })
    .fill("wrong passphrase");
  await page
    .getByRole("button", { name: "Unlock backup", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Could not unlock");
  await page
    .getByLabel("Backup passphrase", { exact: true })
    .fill("my little private vault");
  await page
    .getByRole("button", { name: "Unlock backup", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Restore backup", exact: true })
    .click();
  await expect(page.getByRole("status").first()).toContainText(
    "Backup restored",
  );
  expect((await state(page)).settings.humour).toBe(true);
});
test("shared-expense screens fit 320px, and group changes fail safely when storage is full", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await demo(page);
  await circle(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Add shared expense", exact: true })
    .click();
  await page.getByLabel("Shared expense title").fill("Unsaved meal");
  await page.getByLabel("Total shared amount").fill("300");
  await page.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw Error("Storage full");
    };
  });
  await page
    .getByRole("button", { name: "Save shared expense", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Could not save");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect((await state(page)).groups[0].expenses).toHaveLength(0);
});
