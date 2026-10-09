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
  const view = await device.webView({ pkg });
  page = await view.page();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (e) => report.errors.push(e.message));
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
  if (previous)
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
        await expect(page.locator(".page-footer")).toContainText("v1.1");
        await expect(
          page.getByRole("region", { name: "Transaction shortcuts" }),
        ).toBeVisible();
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
    await expect(page.locator(".page-footer")).toContainText("v1.1");
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
        page.getByRole("button", { name: /Android coffee/ }),
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
        .getByRole("button", { name: /Android coffee/ })
        .first()
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
