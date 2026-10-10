Gareeb v3.0 — clearer money, calmer screens.

Download **gareeb-android.apk** below. Update over builds 7 and later; the signing identity and existing records remain compatible.

## New in v3

- **Cleaner mobile UI:** solid header and bottom navigation, theme-aware Android status-bar icons, compact headings and cards, fewer decorative elements, and optional transaction details in an expandable section.
- **Rebuilt transaction sheets:** one transform/opacity animation path for opening, saving, closing and swipe dismissal. The keyboard-aware sheet stays within the visible viewport. Taps cannot pass through a closing sheet. Reduced motion and haptics remain available.
- **Autopay inbox:** enable Autopay on a bill to prepare due charges for review when Gareeb opens or resumes. Review the actual amount, confirm paid or mark it as not charged. Expected payments do not change wallet balances. This does not detect bank transactions or charge money.
- **Recurring income:** salary, allowance and regular payments, with confirmation before wallet balances change. Pause/resume and payment history are included.
- **Subscriptions:** optional free-trial ending dates with private local reminders, and price history when you edit the amount. Notification delivery depends on Android; open Gareeb periodically to refresh schedules.
- **Can I afford it?** Plan → Spend check estimates what a purchase leaves over the next 7, 14 or 30 days, subtracting upcoming bills, unconfirmed charges and your configured reserve. It uses all recorded wallet balances and excludes unconfirmed future income.
- **Stronger shared groups:** percentage and weighted splits with exact rounding, receipt attachments, per-person history, and a one-time option to record your own portion as a wallet expense. Do not use this if you already recorded that expense. Edits to the group do not retroactively edit the linked wallet record; edit it in Activity if needed. Shared settlement records still do not send money or change wallets.
- **Everyday shortcuts:** Today/Yesterday date buttons, newest/oldest/largest transaction sorting, one-tap filter reset, and a home-page prompt when payments need review.

## Privacy and updating

No signup, ads, analytics trackers or financial-data server. Groups remain local, with shareable summaries and full backup support. Live multi-user sync, receipt OCR and widgets remain follow-up work.

App lock protects the UI and hides screenshots/previews; it does not encrypt the underlying Preferences database. Optional encrypted backups remain available. Unconfirmed charges remain estimates until reviewed.

Build 6 or earlier used temporary signing keys. Export a full backup outside Gareeb and verify it exists before uninstalling those older builds. Builds 7 onward update in place.

This is a signed preview APK, not a Play Store release. Source, automated checks, APK checksum and build logs are available in this repository.
