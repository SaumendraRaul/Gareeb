# gareeb

**A little mindful. A lot more free.**

A mobile-first, offline expense tracker and money planner. Original ivory, forest-green, and soft-lime design. Android APK built by GitHub Actions, with a browser version for development.

## Get the Android app

Open [Releases](https://github.com/SaumendraRaul/Gareeb/releases) and download **gareeb-android.apk** from the newest Android build. Android 7.0+ is supported. This is a development-signed preview, not a Play Store release. APK and checksum also appear under the [Actions workflow](https://github.com/SaumendraRaul/Gareeb/actions/workflows/android.yml) artifacts.

Every push to `main` or manual workflow dispatch runs the tests and builds an APK. Published builds use the durable signing identity stored in the repository's encrypted `GAREEB_SIGNING_KEY` and `GAREEB_SIGNING_PASSWORD` Actions secrets. The workflow checks its certificate fingerprint and fails instead of silently generating a different key. Pull-request builds use a disposable debug identity and must not replace published installations.

**One-time migration from builds 4–6:** those previews used temporary signing keys that were not retained. In your existing app, use Settings → Export full backup and save the JSON outside the app (for example in Downloads or Drive). Verify that the file was saved before uninstalling. Install build 7 or later, complete the initial setup, then use Settings → Restore a backup and select your saved JSON. Do not uninstall before saving the backup. Later builds signed with the durable identity can update the installation normally.

## Included

- Expense, income, and transfers with integer minor-unit arithmetic.
- Searchable diary, category/account/type/review filters, notes and tags.
- Compressed receipt attachments and merchant-category rules.
- Multiple bank, savings, cash, or credit wallets, including negative opening balances.
- Cash-flow charts, daily spending, category breakdown, savings rate, largest expense, and comparisons.
- Monthly and weekly category budgets with optional positive rollover.
- Savings goals, progress, and contributions.
- Recurring bills, private opt-in Android reminders, snooze, skip, pause/resume, and mark-paid transactions.
- Shared trip/household groups, exact equal/custom splits, partial payments, group budgets, shareable summaries and archives; earlier one-to-one IOUs are retained.
- Dark mode, hide balances, accessible dialogs, responsive navigation, Android back handling.
- CSV import preview, duplicate suppression, CSV export, full backup and restore, undo.
- Clear demo mode and empty-state onboarding.
- Reusable transaction shortcuts (up to 24) and duplicate-for-today, with review before saving.
- Interactive monthly spending calendar with daily transaction filtering.
- Seven-day spending recap, merchant totals, and days without recorded expenses.
- Annual and monthly-equivalent recurring bill costs.
- Native Android haptics for taps, successful saves, and errors, with an off switch and preview.
- Animated page transitions, tactile navigation, swipe-dismiss sheets, and reduced-motion controls that honour the system setting.

- Local natural-language quick entry with review before saving and recent merchant shortcuts.
- Custom categories, icons, colours and subcategory labels.
- Monthly money stories with category changes and transaction drill-down.
- Android biometric/device-credential app lock and protected previews.
- Optional passphrase-encrypted backup export and restoration.

## Privacy and limits

No accounts, ads, analytics trackers, bank sync, external fonts, or financial-data backend. Android records are saved with Capacitor Preferences; web records use browser storage. On-device records are **not application-encrypted**. Optional app lock protects access through Android authentication and hides screenshots/previews. Optional encrypted backup files use AES-256-GCM and PBKDF2-SHA256 with 310,000 iterations; plain JSON backups are still available. App lock and backup encryption are independent. Clearing app/browser storage or uninstalling can remove records. Web receipt-heavy usage may hit browser storage limits; save failures are reported without claiming success.

Bill reminders use opt-in local Android notifications, not a push server. They schedule the next occurrence of up to 64 active bills; open the app periodically to refresh future occurrences. Android may delay delivery. No OCR or automatic SMS ingestion. Shared groups are local records, not multi-user sync; summaries can be exported for sharing. Goals and IOUs do not move wallet balances. Currency is selected for the whole ledger during setup; no foreign-exchange conversion. See [feature research](docs/FEATURE-RESEARCH.md) for the ten-app comparison and scope.

## Develop

Requires Node 22+.

```sh
npm ci
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

For a local Android build, install Java 21 and Android SDK platform 36/build-tools 36.0.0:

```sh
npm run android:sync
cd android
./gradlew assembleDebug
```

On Windows use `gradlew.bat`. The APK is `android/app/build/outputs/apk/debug/app-debug.apk`.

Regenerate launcher art with `node scripts/icons.mjs`. Fonts are bundled DM Sans and Manrope (SIL Open Font License); icons are Lucide (ISC). Core stack: React, TypeScript, Vite, Capacitor.

## CSV format

Export a template in Settings. Required columns: `date,title,type,amount`. Optional: `category,account,toAccount,note,tags`. Dates use `YYYY-MM-DD`, type is `expense`, `income`, or `transfer`, and amount is a positive decimal in the ledger currency. Categories and wallets use internal IDs shown in Settings. Transfers require a different destination wallet. Exact duplicate detection uses date, title, type, amount, account and destination. Receipts are included in JSON backups only.

## Checks

`npm test` checks calculations, transfers, recurrence, backup validation, CSV parsing, duplicate suppression, and formula escaping. Browser tests exercise setup, transactions, edits, deletion/undo, persistence, budgets, goals, bills, imports, transfers, themes and mobile layout. GitHub Actions blocks APK publication unless these pass.

## V2 checks

V2 tests cover exact shared splits, partial and excessive settlements, rollover periods, custom-category backup validation, currency-aware quick entry, encrypted backup tampering, and reminder privacy. Browser checks exercise the full shared-expense, category, encryption and storage-failure flows. Native checks include updating from build 8, group persistence, notification scheduling/cancellation, and device-credential lock/unlock.
