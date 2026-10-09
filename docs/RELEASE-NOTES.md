Gareeb v2.0 — good times, clear tabs.

Download **gareeb-android.apk** below. Android 7 or later. Build 7 and newer update in place with the same signing identity; your records stay compatible.

## New in v2

- **Together groups:** trips, households and shared meals with 2–30 members, exact equal splits, custom amounts, different payers, partial settlement history, editable expenses, group budgets, archiving and shareable text summaries. Group records stay on this device and are included in full backups. They do not automatically change wallet balances or send money.
- **Quick entry:** describe a simple expense such as “180 lunch yesterday cash” and review the prefilled entry. Recent merchants make repeat purchases quicker. Parsing runs locally; it is not a general-purpose AI or bank-message importer.
- **Weekly and monthly budgets:** optional positive rollover from a chosen starting period, with overspending absorbed before future carry. Editing a limit recalculates that budget's history.
- **Custom categories:** icons, colours and subcategory labels used throughout entry, filtering, charts, rules and budgets. Subcategories keep independent totals.
- **Where did it go?** A monthly money story with category changes and drill-down to the transactions behind them. Current partial months are clearly distinguished from the previous full month.
- **Private Android bill reminders:** opt-in local notifications around 9 AM for the next occurrence of up to 64 active bills. No bill names or amounts appear in notification text. Android can delay delivery. Open the app periodically to refresh future occurrences; editing, paying, snoozing or skipping a bill refreshes its schedule. No automatic charges or cancellations.
- **Device app lock:** fingerprint, face or device credential verification using Android's authentication screen. Requires a device screen lock. Enabled lock hides screenshots and recent-app previews. Lock preference is device-specific and is not restored from a backup.
- **Encrypted backups:** optional passphrase-protected exports using AES-256-GCM with PBKDF2-SHA256 (310,000 iterations). Keep the passphrase separately; it cannot be recovered. Plain JSON backups remain available. App-lock protection does not encrypt the underlying on-device Preferences database.
- Optional gentle Gareeb humour. Existing haptics, reduced motion, dark mode, receipts, CSV imports, calendars and shortcuts remain available.

## Updating older builds

Build 6 or earlier used temporary signing keys. Export a full backup and save the JSON outside Gareeb, verify it exists, then uninstall the old app. Install this APK, finish initial setup and restore the backup. Never uninstall before saving your backup.

This is a preview APK, not a Play Store release. The published APK uses the durable signing identity introduced in build 7. Source, tests, checksum and build logs are available in this repository.

No signup, financial-data server, bank sync, multi-user collaboration, cloud sync, receipt OCR, automatic SMS access or currency conversion. Groups are a local ledger that you can share as a summary. Home-screen widgets, receipt scanning and optional sync remain follow-up work.
