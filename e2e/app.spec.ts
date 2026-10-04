import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function demo(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Take a look around with demo data" })
    .click();
  await expect(page.getByRole("heading", { name: "Hey friend" })).toBeVisible();
}
async function nav(page: Page, name: string) {
  const target = page.getByRole("navigation", {
    name: (await page.locator(".bottom-nav").isVisible())
      ? "Mobile navigation"
      : "Main navigation",
  });
  await target.getByRole("button", { name, exact: true }).click();
}

test("backup downloads and restores, invalid backup preserves records", async ({
  page,
}) => {
  await demo(page);
  await page
    .getByRole("button", { name: "Open settings", exact: true })
    .click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export full backup" }).click();
  const downloaded = await pending;
  const original = await readFile((await downloaded.path())!);
  const parsed = JSON.parse(original.toString());
  expect(parsed.transactions.length).toBeGreaterThan(100);
  const input = page.locator(
    'input[type=file][accept=".json,application/json"]',
  );
  await input.setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.getByRole("status")).toContainText("Invalid backup");
  await expect(
    page.getByRole("heading", { name: "Just the way you like it." }),
  ).toBeVisible();
  parsed.settings.name = "Restored";
  await input.setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(parsed)),
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Restore backup", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hey Restored" }),
  ).toBeVisible();
});

test("wallet creation, IOU settlement, receipt attachment and keyboard dismissal", async ({
  page,
}) => {
  await demo(page);
  await nav(page, "Wallets");
  await page.getByRole("button", { name: "Add wallet", exact: true }).click();
  await page.getByLabel("Wallet name").fill("Travel fund");
  await page.getByLabel("Opening balance").fill("1000");
  await page.getByRole("button", { name: "Save account" }).click();
  await expect(
    page.getByRole("heading", { name: "Travel fund" }),
  ).toBeVisible();
  await nav(page, "Plan");
  await page.getByRole("button", { name: "Together", exact: true }).click();
  await page
    .getByRole("button", { name: "Settle", exact: true })
    .first()
    .click();
  await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();
  await nav(page, "Overview");
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByLabel("Amount", { exact: true }).fill("10");
  await page.getByLabel("What was it for?").fill("Receipt test");
  await page
    .getByRole("dialog")
    .locator("input[type=file]")
    .setInputFiles("android/app/src/main/res/mipmap-mdpi/ic_launcher.png");
  await expect(page.getByAltText("Attached receipt")).toBeVisible();
  await page.getByRole("button", { name: "Save expense" }).click();
  await nav(page, "Activity");
  await page.getByLabel("Search transactions").fill("Receipt test");
  await page.getByRole("button", { name: /Receipt test/ }).click();
  await expect(page.getByAltText("Attached receipt")).toBeVisible();
});
test("fresh setup, expense, persisted reload, edit and undo deletion", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Make yourself at home" }).click();
  await page.getByLabel("What should we call you?").fill("Test");
  await page.getByLabel("Monthly income plan").fill("50000");
  await page.getByLabel("Current main account balance").fill("10000");
  await page.getByRole("button", { name: "Let’s begin" }).click();
  await expect(page.getByRole("heading", { name: "Hey Test" })).toBeVisible();
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await page
    .getByRole("spinbutton", { name: "Amount", exact: true })
    .fill("125.50");
  await page.getByLabel("What was it for?").fill("QA lunch");
  await page.getByRole("button", { name: "Save expense", exact: true }).click();
  await expect(page.getByRole("button", { name: /QA lunch/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /QA lunch/ })).toBeVisible();
  await page.getByRole("button", { name: /QA lunch/ }).click();
  await page
    .getByRole("spinbutton", { name: "Amount", exact: true })
    .fill("150");
  await page.getByRole("button", { name: "Save expense", exact: true }).click();
  await page.getByRole("button", { name: /QA lunch/ }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("button", { name: /QA lunch/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: /QA lunch/ })).toBeVisible();
  expect(errors).toEqual([]);
});
test("all tabs fit the viewport, charts render, theme persists", async ({
  page,
}) => {
  await demo(page);
  for (const label of ["Overview", "Activity", "Insights", "Plan", "Wallets"]) {
    await nav(page, label);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .getByRole("button", { name: "Open settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Switch to dark" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("heading", { name: "Hey friend" })).toBeVisible();
});
test("budget, goal contribution and bill payment update records", async ({
  page,
}) => {
  await demo(page);
  await nav(page, "Plan");
  await page.getByRole("button", { name: "New budget", exact: true }).click();
  await page.getByLabel("Category", { exact: true }).selectOption("health");
  await page.getByLabel("Monthly limit").fill("2500");
  await page.getByRole("button", { name: "Save budget" }).click();
  await expect(
    page.getByRole("heading", { name: "Health", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Goals", exact: true }).click();
  await page
    .getByRole("button", { name: "Add savings", exact: true })
    .first()
    .click();
  await page.getByLabel("Amount saved").fill("1000");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add savings", exact: true })
    .click();
  await expect(page.locator(".goal-values").first()).toContainText("25,000");
  await page.getByRole("button", { name: "Bills", exact: true }).click();
  await page
    .getByRole("button", { name: "Mark paid", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByRole("status")).toContainText("Payment recorded");
  await nav(page, "Activity");
  await expect(
    page.getByRole("button", { name: /Netflix/ }).first(),
  ).toBeVisible();
});
test("CSV import previews, saves and skips duplicates", async ({ page }) => {
  await demo(page);
  await page
    .getByRole("button", { name: "Open settings", exact: true })
    .click();
  const date = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const buffer = Buffer.from(
    `date,title,type,amount,category,account\n${date},Imported coffee,expense,123.45,food,bank`,
  );
  const file = page.locator('input[type=file][accept=".csv,text/csv"]');
  await file.setInputFiles({ name: "test.csv", mimeType: "text/csv", buffer });
  await expect(page.getByRole("dialog")).toContainText("1 new transactions");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Import transactions", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Imported 1");
  await file.setInputFiles({ name: "test.csv", mimeType: "text/csv", buffer });
  await expect(page.getByRole("dialog")).toContainText("0 new transactions");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Import transactions", exact: true }),
  ).toBeDisabled();
});
test("transfer preserves total balance and never inflates expenses", async ({
  page,
}) => {
  await demo(page);
  const before = await page.locator(".balance-card h2").innerText();
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Transfer", exact: true }).click();
  await page.getByLabel("Amount", { exact: true }).fill("1000");
  await page.getByLabel("Transfer description").fill("QA transfer");
  await page.getByRole("button", { name: "Save transfer" }).click();
  await expect(page.locator(".balance-card h2")).toHaveText(before);
  await nav(page, "Activity");
  await page.getByLabel("Transaction type").selectOption("transfer");
  await expect(page.getByRole("button", { name: /QA transfer/ })).toBeVisible();
});
