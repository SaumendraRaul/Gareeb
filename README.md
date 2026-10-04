# gareeb.

**A little mindful. A lot more free.**

A mobile-first, offline expense tracker and money planner. Original ivory, forest-green, and soft-lime design. Android APK built by GitHub Actions, with a browser version for development.

## Get the Android app

Open [Releases](https://github.com/SaumendraRaul/Gareeb/releases) and download **gareeb-android.apk** from the newest Android build. Android 7.0+ is supported. This is a development-signed preview, not a Play Store release. APK and checksum also appear under the [Actions workflow](https://github.com/SaumendraRaul/Gareeb/actions/workflows/android.yml) artifacts.

Every push to `main` or manual workflow dispatch runs the tests and builds an APK. No repository secrets are needed for preview builds. The workflow caches the debug signing key for updates; cache eviction changes that key, so export a backup before uninstalling a prior version. A production release needs a private, stable release keystore stored in GitHub secrets and a separate signing configuration.

## Included

- Expense, income, and transfers with integer minor-unit arithmetic.
- Searchable diary, category/account/type/review filters, notes and tags.
- Compressed receipt attachments and merchant-category rules.
- Multiple bank, savings, cash, or credit wallets, including negative opening balances.
- Cash-flow charts, daily spending, category breakdown, savings rate, largest expense, and comparisons.
- Monthly budgets and allocation against planned income.
- Savings goals, progress, and contributions.
- Recurring bills and subscriptions, in-app reminders, pause/resume, and mark-paid transactions.
- Local shared-expense/IOU notebook with settlement tracking.
- Dark mode, hide balances, accessible dialogs, responsive navigation, Android back handling.
- CSV import preview, duplicate suppression, CSV export, full backup and restore, undo.
- Clear demo mode and empty-state onboarding.

## Privacy and limits

No accounts, ads, analytics trackers, bank sync, external fonts, or financial-data backend. Android records are saved with Capacitor Preferences; web records use browser storage. Data and backups are **not application-encrypted**. Protect access with the device lock and keep backups private. Clearing app/browser storage or uninstalling can remove records. Web receipt-heavy usage may hit browser storage limits; save failures are reported without claiming success.

Bills remind inside the app, not via background push. No OCR or automatic SMS ingestion. Shared expenses are local records, not multi-user sync. Goals and IOUs do not move wallet balances. Currency is selected for the whole ledger during setup; no foreign-exchange conversion. See [feature research](docs/FEATURE-RESEARCH.md) for the ten-app comparison and scope.

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
