import { test, expect, type Page } from "@playwright/test";
async function start(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Take a look around with demo data" })
    .click();
  await expect(page.locator(".app-shell")).toBeVisible();
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
test("autopay and income inbox confirm actual charges once and preserve them after reopening", async ({
  page,
}) => {
  await start(page);
  const before = await state(page);
  await nav(page, "Plan");
  await page.getByRole("button", { name: "Bills", exact: true }).click();
  await page.getByRole("button", { name: "Add bill", exact: true }).click();
  await page.getByLabel("Bill or subscription").fill("V3 streaming");
  await page.getByLabel("Amount", { exact: true }).fill("149");
  await page.getByLabel("Paid automatically (Autopay)").check();
  await page.getByRole("button", { name: "Save bill", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const pending = page
    .locator(".expected-row")
    .filter({ hasText: "V3 streaming" });
  await expect(pending).toBeVisible();
  let s = await state(page);
  expect(s.transactions).toHaveLength(before.transactions.length);
  await pending.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByLabel("Actual payment amount").fill("159");
  await page.getByRole("button", { name: "Confirm paid", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  s = await state(page);
  expect(
    s.transactions.filter((t: any) => t.title === "V3 streaming"),
  ).toHaveLength(1);
  expect(
    s.transactions.find((t: any) => t.title === "V3 streaming").amount,
  ).toBe(15900);
  await page.getByRole("button", { name: "Add income", exact: true }).click();
  await page.getByLabel("Income name").fill("V3 salary");
  await page.getByLabel("Income amount").fill("50000");
  await page.getByRole("button", { name: "Save income schedule" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .locator(".expected-row")
    .filter({ hasText: "V3 salary" })
    .filter({ has: page.getByRole("button", { name: "Review", exact: true }) })
    .getByRole("button", { name: "Review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm received", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  s = await state(page);
  expect(
    s.transactions.filter((t: any) => t.title === "V3 salary"),
  ).toHaveLength(1);
  expect(
    s.expectedPayments.filter((e: any) => e.status === "expected"),
  ).toHaveLength(0);
});
test("weighted and percentage groups expose person history and record a wallet share once", async ({
  page,
}) => {
  await start(page);
  await nav(page, "Plan");
  await page.getByRole("button", { name: "Together", exact: true }).click();
  await page.getByRole("button", { name: "New group", exact: true }).click();
  await page.getByLabel("Group name", { exact: true }).fill("V3 stay");
  await page
    .getByLabel("Members (comma separated)", { exact: true })
    .fill("You, Sam");
  await page.getByRole("button", { name: "Save group", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Add shared expense", exact: true })
    .click();
  await page.getByLabel("Shared expense title").fill("Three nights");
  await page.getByLabel("Total shared amount").fill("100.01");
  await page.getByRole("button", { name: "Shares", exact: true }).click();
  await page.getByLabel("You weight").fill("3");
  await page.getByLabel("Sam weight").fill("1");
  await page
    .getByRole("button", { name: "Save shared expense", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  let s = await state(page);
  expect(s.groups[0].expenses[0].shares.map((x: any) => x.amount)).toEqual([
    7501, 2500,
  ]);
  await page
    .getByRole("button", { name: "Record my share of Three nights" })
    .click();
  await page.getByRole("button", { name: "Record my share once" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Record my share of Three nights" }),
  ).toHaveCount(0);
  s = await state(page);
  expect(
    s.transactions.filter((t: any) => t.title === "Three nights"),
  ).toHaveLength(1);
  await page.getByLabel("History for person").selectOption({ label: "Sam" });
  await expect(
    page.locator(".group-history").filter({ hasText: "Three nights" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add shared expense", exact: true })
    .click();
  await page.getByLabel("Shared expense title").fill("Percentage meal");
  await page.getByLabel("Total shared amount").fill("200");
  await page.getByRole("button", { name: "Percentages", exact: true }).click();
  await page.getByLabel("You percent").fill("40");
  await page.getByLabel("Sam percent").fill("60");
  await page
    .getByRole("button", { name: "Save shared expense", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  s = await state(page);
  expect(s.groups[0].expenses[1].shares.map((x: any) => x.amount)).toEqual([
    8000, 12000,
  ]);
});
test("clean mobile chrome, spending check, and repeated sheets do not leave scroll or motion stuck", async ({
  page,
}) => {
  await start(page);
  const css = await page
    .locator(".topbar")
    .evaluate((el) => ({
      background: getComputedStyle(el).backgroundColor,
      filter: getComputedStyle(el).backdropFilter,
    }));
  expect(css.background).not.toContain("rgba");
  expect(css.filter).toBe("none");
  await nav(page, "Plan");
  await page.getByRole("button", { name: "Spend check", exact: true }).click();
  await page.getByLabel("Planned purchase amount").fill("1000");
  await page.getByLabel("Plan ahead").selectOption("14");
  await expect(page.locator(".spend-result")).toContainText("14 days");
  await page.getByLabel("Planned purchase amount").fill("99999999");
  await expect(page.locator(".spend-result")).toContainText(
    "Short of your plan",
  );
  await nav(page, "Overview");
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("button", { name: "Add transaction", exact: true })
      .filter({ visible: true })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel("Note (optional)")).toBeHidden();
    await page.getByRole("button", { name: "Yesterday", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByLabel("Amount", { exact: true }).fill("12");
  await page.getByLabel("What was it for?").fill("Smooth save");
  await page.getByRole("button", { name: "Save expense", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
});
