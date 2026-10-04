# Feature research and scope

Reviewed on 5 October 2026. This is a selection of ten prominent consumer expense/budget apps, not a claim of an objective ranking. Sources are their official product pages. Gareeb uses original branding and UI; it does not copy their code or assets.

| Reference | Useful product pattern | Gareeb implementation |
| --- | --- | --- |
| [YNAB](https://www.ynab.com/features) | Intentional planning, targets, spending reports | Category allocation against planned income; savings targets and progress; charts |
| [Monarch](https://www.monarch.com/) | Unified accounts, transaction review, recurring expenses | Multiple manual wallets, reviewed/unreviewed entries, bill calendar |
| [Copilot Money](https://www.copilot.money/) | Clear visual analytics and transaction categorisation | Focused dashboard, cash-flow/category/daily views, merchant rules |
| [Rocket Money](https://www.rocketmoney.com/) | Subscription visibility | Recurring bill list, monthly equivalent, pause/resume, mark paid |
| [Quicken Simplifi](https://www.quicken.com/products/simplifi/) | Spending plans and financial visibility | Monthly category budgets, income allocation, wallet summary |
| [PocketGuard](https://pocketguard.com/) | Leftover money and category insights | Balance after upcoming bills and a protected reserve; explicit calculation explanation |
| [Goodbudget](https://goodbudget.com/) | Envelope-style category limits | Repeating monthly category envelopes and overspend indicators |
| [Wallet by BudgetBakers](https://budgetbakers.com/en/) | Wallet organisation and reports | Account types, transfers, histories, CSV import/export |
| [Spendee](https://www.spendee.com/) | Approachable mobile budgeting and shared-money visibility | Mobile navigation, colourful categories, local IOU notebook |
| [Money Manager by Realbyte](https://www.realbyteapps.com/) | Detailed daily records and budget/account tracking | Date-based entries, notes, tags, receipt images, monthly filters |

Additional features: deliberate sample mode, fresh onboarding, dark mode, hiding headline balances, safe-area layout, local font assets, accessible dialogs and keyboard controls, edit/delete with undo, validated full backups, import preview and exact duplicate suppression, native Android file sharing and back-button handling.

## Deliberate boundaries

No fake bank connection or credential collection. Live banking, SMS parsing, receipt OCR, cross-device sharing, automatic bill negotiation/cancellation, investment pricing, and cloud AI are not implemented. These require additional integrations or an independently designed service. The UI makes local/manual features explicit.

Financial values are integer minor units. Transfers are excluded from spending and income. The “after bills & reserve” amount uses current combined wallet balances minus the next active payment of each bill due by month-end and a user reserve. It is not a predictive cash-flow engine. Goals and IOUs do not affect account balances; users record real money movements separately.

The app is a single-currency ledger. INR is the default; USD, EUR, GBP and AED can be chosen at setup. Currency changes require a fresh ledger to avoid silently converting or relabelling historical entries.
