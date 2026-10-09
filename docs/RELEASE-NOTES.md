Gareeb is a private, offline expense and money-planning app with a mobile-first ivory-and-emerald interface.

New in v1.1.2: a custom folded-pocket and gold-coin emblem, a calmer lowercase wordmark, and matching launcher, themed Android icon, favicon, and launch-screen artwork. The mobile header is more compact and the logo adapts to light and dark themes. The name and your data stay the same. Build 7 or newer can be updated in place; the older-build migration instructions below still apply.

Download **gareeb-android.apk** below on your Android phone (Android 7 or later). Allow installation from your browser when Android asks, then open Gareeb. Start fresh or explore the labelled sample data.

Includes expense/income/transfers, multiple wallets, category budgets, savings goals, recurring bills, IOUs, cash-flow and category analytics, transaction search and filters, receipt attachments, merchant rules, dark mode, CSV import/export and full JSON backups. No signup or API keys required.

New in v1.1: reusable transaction shortcuts, duplicate-for-today, an interactive spending calendar, a seven-day spending recap, and annual recurring-cost summaries. Every shortcut opens a reviewable form before adding a transaction.

The interface now includes smoother page and sheet transitions, tactile navigation, swipe-to-dismiss sheets, and native Android haptics for taps and save/error feedback. Settings includes a haptics switch, a preview pulse, and a reduced-motion option; the system reduced-motion preference is also honoured. Haptic strength depends on your phone's hardware and system settings.

Existing records and backups remain compatible. A separate Android 15 emulator workflow checks installation, updates, persistence, native haptic calls, and backup sharing, retaining its report and screenshots.

**Updating from build 6 or earlier:** the older signing keys were temporary, so Android cannot install this release over those versions. First use Settings → Export full backup and save the JSON outside Gareeb. Verify that the file exists before uninstalling the old app. Install this APK, finish the initial setup, then use Settings → Restore a backup. Never uninstall before saving your backup.

This is a **preview APK**, not a Play Store production release. From build 7, the signing identity is stored in encrypted repository secrets and verified on every published build so future updates use the same certificate.

Data stays on the device. There is no live bank sync, cloud sync, automatic subscription cancellation, OCR, or background push reminder service. Bills and IOU settlements are manually recorded. Goals track savings progress separately from wallets. All wallets use the currency selected during setup.

The SHA-256 checksum is included with this release. The workflow runs calculation tests, mobile and desktop browser checks, and the Android build before publishing.
