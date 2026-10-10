import { _android as android } from "playwright";
import { expect } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const out = "work/android-qa";
await mkdir(out, { recursive: true });
const apk = await readFile("work/released.apk");
const previous = await readFile("work/previous.apk").catch(() => null);
const report = {
  apk: process.env.RELEASE_TAG || "local",
  sha256: createHash("sha256").update(apk).digest("hex"),
  checks: [],
  errors: [],
};
const [device] = await android.devices();
assert.ok(device, "Android emulator must be connected");
device.setDefaultTimeout(45000);
let page;
const pkg = "com.gareeb.money";
async function install(content, label) {
  const path = `/data/local/tmp/gareeb-${label}.apk`;
  await device.push(content, path);
  const result = (await device.shell(`pm install -r -t ${path}`)).toString();
  console.log(`INSTALL ${label}: ${result.trim()}`);
  assert.match(
    result,
    /Success/,
    `Android must accept the ${label} APK: ${result}`,
  );
  report[label + "Package"] = (await device.shell(`dumpsys package ${pkg}`))
    .toString()
    .split("\n")
    .filter((line) => /versionCode=|versionName=/.test(line));
  console.log(report[label + "Package"].join("\n"));
}
async function check(name, fn) {
  await fn();
  report.checks.push(name);
  console.log("PASS: " + name);
  await writeFile(out + "/report.json", JSON.stringify(report, null, 2));
}
async function launch() {
  await device.shell(`am start -n ${pkg}/.MainActivity`);
  // The old debugging socket can outlive force-stop. Match the current app
  // process rather than accidentally reconnecting to its closing WebView.
  let view;
  await expect
    .poll(
      async () => {
        const pid = Number(
          (await device.shell(`pidof ${pkg}`)).toString().trim(),
        );
        view = device
          .webViews()
          .find(
            (candidate) => candidate.pkg() === pkg && candidate.pid() === pid,
          );
        return Boolean(view);
      },
      { timeout: 45000, message: "Wait for the relaunched app's WebView" },
    )
    .toBe(true);
  page = await view.page();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (e) => report.errors.push(e.message));
  // Native storage and first WebView rendering can exceed the matcher default
  // on a cold emulator. Wait for the actual ready UI, not a fixed sleep.
  await expect(
    page.locator(".welcome-wrap, .app-shell, .privacy-screen"),
  ).toBeVisible({ timeout: 30000 });
  return page;
}
async function nav(name) {
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name, exact: true })
    .click();
}
try {
  report.device = {
    model: device.model(),
    android: (await device.shell("getprop ro.build.version.release"))
      .toString()
      .trim(),
  };
  await check("APK installs and opens the welcome screen", async () => {
    await install(previous || apk, "initial");
    await launch();
    await expect(
      page.getByRole("button", { name: "Make yourself at home" }),
    ).toBeVisible();
    await device.screenshot({ path: out + "/01-welcome.png" });
  });
  await check(
    "Fresh setup saves through the native Preferences plugin",
    async () => {
      await page.getByRole("button", { name: "Make yourself at home" }).click();
      await page.getByLabel("What should we call you?").fill("Android QA");
      await page.getByLabel("Monthly income plan").fill("50000");
      await page.getByLabel("Current main account balance").fill("10000");
      await page.getByRole("button", { name: "Let’s begin" }).click();
      await expect(
        page.getByRole("heading", { name: "Hey Android QA" }),
      ).toBeVisible();
    },
  );
  await check(
    "Expense changes real wallet balance by the exact amount",
    async () => {
      await page
        .getByRole("button", { name: "Add transaction", exact: true })
        .filter({ visible: true })
        .first()
        .click();
      await page.getByLabel("Amount", { exact: true }).fill("123.45");
      await page.getByLabel("What was it for?").fill("Android coffee");
      await page.getByRole("button", { name: "Save expense" }).click();
      await expect(page.locator(".balance-card h2")).toHaveText("₹9,876.55");
    },
  );
  if (previous && process.env.PREVIOUS_STABLE !== "true")
    await check(
      "Legacy backup restores into the durable-signed APK",
      async () => {
        await page
          .getByRole("button", { name: "Open settings", exact: true })
          .click();
        await page.getByRole("button", { name: "Export full backup" }).click();
        let files = "";
        await expect
          .poll(
            async () => {
              files = (
                await device.shell("run-as " + pkg + " ls cache")
              ).toString();
              return files;
            },
            { timeout: 20000 },
          )
          .toContain("gareeb-backup-");
        const filename = files
          .split(/\s+/)
          .find((x) => /^gareeb-backup-.*\.json$/.test(x));
        assert.ok(filename);
        const backup = (
          await device.shell("run-as " + pkg + " cat cache/" + filename)
        ).toString();
        assert.equal(JSON.parse(backup).transactions.length, 1);
        await device.shell("am force-stop " + pkg);
        // Only the disposable emulator installation is removed. The exported backup is held by this test.
        assert.match(
          (await device.shell("pm uninstall " + pkg)).toString(),
          /Success/,
        );
        await install(apk, "updated");
        await launch();
        await page
          .getByRole("button", { name: "Make yourself at home" })
          .click();
        await page.getByLabel("What should we call you?").fill("Recovery");
        await page.getByLabel("Monthly income plan").fill("0");
        await page.getByLabel("Current main account balance").fill("0");
        await page.getByRole("button", { name: "Let’s begin" }).click();
        await page
          .getByRole("button", { name: "Open settings", exact: true })
          .click();
        await page
          .locator('input[type=file][accept=".json,application/json"]')
          .setInputFiles({
            name: "legacy-backup.json",
            mimeType: "application/json",
            buffer: Buffer.from(backup),
          });
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Restore backup", exact: true })
          .click();
        await expect(page.getByRole("status")).toContainText("Backup restored");
        await nav("Overview");
        await expect(
          page.getByRole("heading", { name: "Hey Android QA" }),
        ).toBeVisible();
        await expect(page.locator(".balance-card h2")).toHaveText("₹9,876.55");
        await expect(page.locator(".page-footer")).toContainText("v3.0");
        await expect(
          page.getByRole("region", { name: "Transaction shortcuts" }),
        ).toBeVisible();
      },
    );
  if (previous && process.env.PREVIOUS_STABLE === "true")
    await check(
      "V2 to V3 update preserves real saved records without uninstall",
      async () => {
        await device.shell("am force-stop " + pkg);
        await install(apk, "updated");
        await launch();
        await expect(
          page.getByRole("heading", { name: "Hey Android QA" }),
        ).toBeVisible();
        await expect(page.locator(".balance-card h2")).toHaveText("₹9,876.55");
        await expect(page.locator(".page-footer")).toContainText("v3.0");
      },
    );
  await check("Stable-signed replacement preserves saved records", async () => {
    await device.shell("am force-stop " + pkg);
    await install(apk, "replacement");
    await launch();
    await expect(
      page.getByRole("heading", { name: "Hey Android QA" }),
    ).toBeVisible();
    await expect(page.locator(".balance-card h2")).toHaveText("₹9,876.55");
    await expect(page.locator(".page-footer")).toContainText("v3.0");
  });
  await check(
    "Force-stop and offline relaunch retain the saved expense",
    async () => {
      await device.shell("svc wifi disable");
      await device.shell("svc data disable");
      await device.shell(`am force-stop ${pkg}`);
      await launch();
      await expect(
        page.getByRole("heading", { name: "Hey Android QA" }),
      ).toBeVisible();
      await expect(
        page.locator(".transaction").filter({ hasText: "Android coffee" }),
      ).toBeVisible();
      await expect(page.locator(".balance-card h2")).toHaveText("₹9,876.55");
      await device.screenshot({ path: out + "/02-offline-relaunch.png" });
    },
  );
  await check(
    "Android back button closes an entry sheet without losing data",
    async () => {
      await page
        .getByRole("button", { name: "Add transaction", exact: true })
        .filter({ visible: true })
        .first()
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await device.shell("input keyevent 4");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.locator(".balance-card h2")).toHaveText("₹9,876.55");
    },
  );
  await check("All primary pages fit the Android WebView", async () => {
    for (const name of [
      "Activity",
      "Insights",
      "Plan",
      "Wallets",
      "Overview",
    ]) {
      await nav(name);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        name + " overflows",
      );
    }
  });
  await check(
    "Transfer preserves the total across native wallets",
    async () => {
      await page
        .getByRole("button", { name: "Add transaction", exact: true })
        .filter({ visible: true })
        .first()
        .click();
      await page.getByRole("button", { name: "Transfer", exact: true }).click();
      await page.getByLabel("Amount", { exact: true }).fill("500");
      await page.getByLabel("Transfer description").fill("Cash withdrawal");
      await page.getByRole("button", { name: "Save transfer" }).click();
      await expect(page.locator(".balance-card h2")).toHaveText("₹9,876.55");
    },
  );
  await check(
    "Pinned shortcuts persist and open a reviewable entry",
    async () => {
      await nav("Overview");
      await page
        .locator(".transaction")
        .filter({ hasText: "Android coffee" })
        .first()
        .click();
      await page
        .getByText("More details · notes, receipt, shortcut", { exact: true })
        .click();
      await page.getByLabel("Save as a shortcut", { exact: false }).check();
      await page.getByRole("button", { name: "Save expense" }).click();
      await page
        .getByRole("button", { name: "Use shortcut Android coffee" })
        .click();
      await expect(page.getByLabel("Amount", { exact: true })).toHaveValue(
        "123.45",
      );
      await device.shell("input keyevent 4");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await nav("Activity");
      await page.getByRole("button", { name: "Calendar", exact: true }).click();
      await expect(page.locator(".calendar-grid")).toBeVisible();
      await device.screenshot({ path: out + "/05-calendar.png" });
      await nav("Overview");
    },
  );
  await check("Dark mode survives an Android process restart", async () => {
    await page
      .getByRole("button", { name: "Open settings", exact: true })
      .click();
    await page.getByRole("button", { name: "Switch to dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await device.shell(`am force-stop ${pkg}`);
    await launch();
    await expect(
      page.getByRole("heading", { name: "Hey Android QA" }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await device.screenshot({ path: out + "/03-dark.png" });
  });
  await check(
    "Native haptics plugin is registered and responds to the preview",
    async () => {
      await page
        .getByRole("button", { name: "Open settings", exact: true })
        .click();
      assert.equal(
        await page.evaluate(() =>
          window.Capacitor.isPluginAvailable("Haptics"),
        ),
        true,
      );
      await device.shell("logcat -c");
      await page.getByRole("button", { name: "Try a gentle pulse" }).click();
      await expect(page.getByRole("status")).toContainText(
        "Haptic preview sent",
      );
      await expect
        .poll(async () =>
          (await device.shell("logcat -d -s Capacitor")).toString(),
        )
        .toMatch(/pluginId: Haptics.*methodName: notification/);
      await device.screenshot({ path: out + "/06-haptics.png" });
    },
  );
  await check(
    "Native backup contains the saved transactions and opens Android sharing",
    async () => {
      await page
        .getByRole("button", { name: "Open settings", exact: true })
        .click();
      await page.getByRole("button", { name: "Export full backup" }).click();
      let files = "";
      await expect
        .poll(
          async () => {
            files = (await device.shell(`run-as ${pkg} ls cache`)).toString();
            return files;
          },
          { timeout: 20000 },
        )
        .toContain("gareeb-backup-");
      const filename = files
        .split(/\s+/)
        .find((x) => /^gareeb-backup-.*\.json$/.test(x));
      assert.ok(filename);
      const saved = JSON.parse(
        (await device.shell(`run-as ${pkg} cat cache/${filename}`)).toString(),
      );
      assert.equal(saved.transactions.length, 2);
      assert.equal(
        saved.transactions.find((t) => t.title === "Android coffee").amount,
        12345,
      );
      const activity = (
        await device.shell("dumpsys activity activities")
      ).toString();
      assert.match(activity, /ChooserActivity|ResolverActivity/);
      await expect
        .poll(
          async () => {
            await device.shell("uiautomator dump /sdcard/qa-share.xml");
            return (await device.shell("cat /sdcard/qa-share.xml")).toString();
          },
          { timeout: 25000 },
        )
        .toContain(filename);
      await device.screenshot({ path: out + "/04-share-sheet.png" });
      await device.shell("input keyevent 4");
    },
  );
  await check(
    "Shared group splits persist across a native restart without changing wallet totals",
    async () => {
      await nav("Plan");
      await page.getByRole("button", { name: "Together", exact: true }).click();
      await page
        .getByRole("button", { name: "New group", exact: true })
        .click();
      await page.getByLabel("Group name", { exact: true }).fill("Android trip");
      await page
        .getByLabel("Members (comma separated)", { exact: true })
        .fill("You, Aman, Priya");
      await page
        .getByRole("button", { name: "Save group", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page
        .getByRole("button", { name: "Add shared expense", exact: true })
        .click();
      await page.getByLabel("Shared expense title").fill("Dinner together");
      await page.getByLabel("Total shared amount").fill("100");
      await page
        .getByRole("button", { name: "Save shared expense", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page
        .getByRole("button", { name: "Record payment", exact: true })
        .first()
        .click();
      await page.getByLabel("Payment amount").fill("10");
      await page
        .getByRole("button", { name: "Confirm payment received" })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await device.shell("am force-stop " + pkg);
      await launch();
      await expect(page.locator(".balance-card h2")).toHaveText("₹9,876.55");
      await nav("Plan");
      await page.getByRole("button", { name: "Together", exact: true }).click();
      await page
        .locator(".group-card")
        .filter({ hasText: "Android trip" })
        .click();
      await expect(page.locator(".group-history")).toHaveCount(2);
      await expect(page.locator(".member-balances")).toContainText("23.33");
      await device.screenshot({ path: out + "/07-shared-group.png" });
    },
  );
  await check(
    "Private device reminders schedule and cancel through the native plugin",
    async () => {
      await nav("Plan");
      await page.getByRole("button", { name: "Bills", exact: true }).click();
      await page.getByRole("button", { name: "Add bill", exact: true }).click();
      await page.getByLabel("Bill or subscription").fill("Private test bill");
      await page.getByLabel("Amount", { exact: true }).fill("99");
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await page
        .getByLabel("Next due date")
        .fill(tomorrow.toISOString().slice(0, 10));
      await page
        .getByRole("button", { name: "Save bill", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await device.shell(
        "pm grant " + pkg + " android.permission.POST_NOTIFICATIONS",
      );
      await page
        .getByRole("button", { name: "Open settings", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Enable reminders", exact: true })
        .click();
      await expect(page.locator(".privacy-settings")).toContainText(
        "1 private bill reminders scheduled.",
      );
      const pending = await page.evaluate(() =>
        window.Capacitor.Plugins.LocalNotifications.getPending(),
      );
      assert.equal(pending.notifications.length, 1);
      assert.equal(
        pending.notifications[0].title,
        "A little reminder from Gareeb",
      );
      await page
        .getByRole("button", { name: "Disable reminders", exact: true })
        .click();
      await expect(page.locator(".privacy-settings")).toContainText(
        "Bill reminders disabled.",
      );
      assert.equal(
        (
          await page.evaluate(() =>
            window.Capacitor.Plugins.LocalNotifications.getPending(),
          )
        ).notifications.length,
        0,
      );
    },
  );
  await check(
    "Native privacy plugin detects screen-lock availability without enabling a lock",
    async () => {
      assert.equal(
        await page.evaluate(() =>
          window.Capacitor.isPluginAvailable("GareebPrivacy"),
        ),
        true,
      );
      const status = await page.evaluate(() =>
        window.Capacitor.Plugins.GareebPrivacy.status(),
      );
      assert.equal(status.enabled, false);
      assert.equal(typeof status.available, "boolean");
    },
  );
  await check(
    "Device credential lock blocks reopening, stays locked on cancel, and unlocks after verification",
    async () => {
      // This PIN exists only on the disposable CI emulator.
      await device.shell("locksettings set-pin 2468");
      async function enterTestPin() {
        let xml = "";
        await expect
          .poll(
            async () => {
              await device.shell("uiautomator dump /sdcard/qa-auth.xml");
              xml = (await device.shell("cat /sdcard/qa-auth.xml")).toString();
              return /class="android.widget.EditText"/.test(xml);
            },
            { timeout: 30000 },
          )
          .toBe(true);
        const node = xml.match(
          /<node\b[^>]*class="android.widget.EditText"[^>]*>/,
        )?.[0];
        const bounds = node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
        assert.ok(bounds, "Device credential input must be visible");
        await device.shell(
          `input tap ${Math.round((Number(bounds[1]) + Number(bounds[3])) / 2)} ${Math.round((Number(bounds[2]) + Number(bounds[4])) / 2)}`,
        );
        await device.shell("input text 2468");
        await device.shell("input keyevent 66");
      }
      await page.reload();
      await expect(page.locator(".app-shell")).toBeVisible({ timeout: 30000 });
      await page
        .getByRole("button", { name: "Open settings", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Enable lock", exact: true })
        .click();
      await enterTestPin();
      await expect(page.locator(".privacy-settings")).toContainText(
        "App lock enabled",
        { timeout: 20000 },
      );
      await device.shell("am force-stop " + pkg);
      await launch();
      await expect(
        page.getByRole("button", { name: "Unlock Gareeb", exact: true }),
      ).toBeVisible();
      await expect(page.locator(".app-shell")).toHaveCount(0);
      await page
        .getByRole("button", { name: "Unlock Gareeb", exact: true })
        .click();
      await expect
        .poll(
          async () => {
            await device.shell("uiautomator dump /sdcard/qa-auth.xml");
            return (await device.shell("cat /sdcard/qa-auth.xml")).toString();
          },
          { timeout: 30000 },
        )
        .toContain('class="android.widget.EditText"');
      // Android first consumes Back to hide the PIN keyboard. Continue only
      // while the system credential field is still present to cancel the prompt.
      for (let attempt = 0; attempt < 3; attempt++) {
        await device.shell("input keyevent 4");
        await device.shell("uiautomator dump /sdcard/qa-auth.xml");
        const xml = (await device.shell("cat /sdcard/qa-auth.xml")).toString();
        if (!xml.includes('class="android.widget.EditText"')) break;
      }
      await expect(
        page.getByRole("button", { name: "Unlock Gareeb", exact: true }),
      ).toBeEnabled({ timeout: 20000 });
      await expect(page.locator(".app-shell")).toHaveCount(0);
      await page
        .getByRole("button", { name: "Unlock Gareeb", exact: true })
        .click();
      await enterTestPin();
      await expect(page.locator(".app-shell")).toBeVisible({ timeout: 30000 });
      await expect(page.locator(".balance-card h2")).toHaveText("₹9,876.55");
      await nav("Overview");
      await page
        .getByRole("button", { name: "Add transaction", exact: true })
        .filter({ visible: true })
        .first()
        .click();
      await page.getByLabel("Amount", { exact: true }).fill("12.34");
      await page
        .getByLabel("What was it for?")
        .fill("Draft kept behind the lock");
      await device.shell("input keyevent 3");
      await expect(page.locator(".privacy-screen")).toBeVisible();
      await expect(page.locator(".app-shell")).toBeHidden();
      await device.shell(`am start -n ${pkg}/.MainActivity`);
      await page
        .getByRole("button", { name: "Unlock Gareeb", exact: true })
        .click();
      await enterTestPin();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 30000 });
      await expect(page.getByLabel("Amount", { exact: true })).toHaveValue(
        "12.34",
      );
      await expect(page.getByLabel("What was it for?")).toHaveValue(
        "Draft kept behind the lock",
      );
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page
        .getByRole("button", { name: "Open settings", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Disable lock", exact: true })
        .click();
      await enterTestPin();
      await expect
        .poll(
          async () =>
            (
              await page.evaluate(() =>
                window.Capacitor.Plugins.GareebPrivacy.status(),
              )
            ).enabled,
          { timeout: 20000 },
        )
        .toBe(false);
      await device.shell("locksettings clear --old 2468");
    },
  );
  await check(
    "V3 autopay queues expected charges, confirms once and survives restart",
    async () => {
      await nav("Plan");
      await page.getByRole("button", { name: "Bills", exact: true }).click();
      await page.getByRole("button", { name: "Add bill", exact: true }).click();
      await page.getByLabel("Bill or subscription").fill("Native autopay test");
      await page.getByLabel("Amount", { exact: true }).fill("50");
      await page.getByLabel("Paid automatically (Autopay)").check();
      await page
        .getByRole("button", { name: "Save bill", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page
        .locator(".expected-row")
        .filter({ hasText: "Native autopay test" })
        .getByRole("button", { name: "Review", exact: true })
        .click();
      await page.getByLabel("Actual payment amount").fill("49");
      await page
        .getByRole("button", { name: "Confirm paid", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await device.shell("am force-stop " + pkg);
      await launch();
      await expect(page.locator(".balance-card h2")).toHaveText("₹9,827.55");
      await nav("Plan");
      await page.getByRole("button", { name: "Bills", exact: true }).click();
      await expect(page.locator(".recurring-hub")).toContainText(
        "You’re all caught up",
      );
      await device.screenshot({ path: out + "/08-autopay.png" });
    },
  );
  await check(
    "Opaque light chrome and repeated sheet open-close retain usable scrolling",
    async () => {
      await page
        .getByRole("button", { name: "Open settings", exact: true })
        .click();
      if (
        await page
          .getByRole("button", { name: "Switch to light", exact: true })
          .count()
      )
        await page
          .getByRole("button", { name: "Switch to light", exact: true })
          .click();
      await nav("Overview");
      const chrome = await page
        .locator(".topbar")
        .evaluate((e) => ({
          color: getComputedStyle(e).backgroundColor,
          filter: getComputedStyle(e).backdropFilter,
        }));
      assert.equal(chrome.filter, "none");
      assert.ok(!chrome.color.includes("rgba"));
      await device.screenshot({ path: out + "/09-clean-light-header.png" });
      for (let i = 0; i < 3; i++) {
        await page
          .getByRole("button", { name: "Add transaction", exact: true })
          .filter({ visible: true })
          .first()
          .click();
        await expect(page.getByRole("dialog")).toBeVisible();
        if (i === 0) {
          // DOM visibility can precede the WebView compositor's first frame.
          // Capture the settled sheet, not the screen behind its entrance.
          await page.getByRole("dialog").evaluate(async (element) => {
            await Promise.allSettled(
              element.getAnimations({ subtree: true }).map((animation) => animation.finished),
            );
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          });
          await page.waitForTimeout(300);
          await expect(page.getByRole("dialog")).toBeVisible();
          await device.screenshot({ path: out + "/10-clean-entry.png" });
        }
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
      }
      assert.notEqual(
        await page.evaluate(() => document.body.style.overflow),
        "hidden",
      );
      await nav("Plan");
      await page
        .getByRole("button", { name: "Spend check", exact: true })
        .click();
      await page.getByLabel("Planned purchase amount").fill("1000");
      await expect(page.locator(".spend-result")).toBeVisible();
      await device.screenshot({ path: out + "/11-spending-check.png" });
    },
  );
  await check("No uncaught WebView JavaScript errors", async () =>
    assert.deepEqual(report.errors, []),
  );
  report.result = "passed";
} catch (error) {
  report.result = "failed";
  report.failure = error.stack;
  console.error(error);
  try {
    await device.screenshot({ path: out + "/failure.png" });
    await device.shell("uiautomator dump /sdcard/qa-failure.xml");
    await writeFile(
      out + "/failure.xml",
      (await device.shell("cat /sdcard/qa-failure.xml")).toString(),
    );
  } catch {}
  process.exitCode = 1;
} finally {
  await writeFile(out + "/report.json", JSON.stringify(report, null, 2));
  await writeFile(
    out + "/logcat.txt",
    (await device.shell("logcat -d -t 1200")).toString(),
  );
  await device.close();
}
