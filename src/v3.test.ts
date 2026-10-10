import { describe, it, expect } from "vitest";
import {
  emptyState,
  validateState,
  balances,
  available,
  type State,
} from "./model";
import {
  collectExpected,
  resolveExpected,
  weightedShares,
  affordability,
  recordOwnShare,
} from "./v3";
import { upcomingReminders } from "./reminders";
import type { ExpenseGroup } from "./v2-data";
function state(): State {
  const s = emptyState();
  s.accounts[0].opening = 100000;
  s.bills = [
    {
      id: "net",
      name: "Subscription",
      amount: 10000,
      date: "2026-10-01",
      cadence: "monthly",
      category: "fun",
      account: "bank",
      active: true,
      autopay: true,
    },
  ];
  return s;
}
describe("expected payments", () => {
  it("catches missed renewals once without deducting wallets", () => {
    const s = collectExpected(state(), "2026-12-15");
    expect(s.expectedPayments).toHaveLength(3);
    expect(s.bills[0].date).toBe("2027-01-01");
    expect(balances(s)[0].balance).toBe(100000);
    expect(s.transactions).toHaveLength(0);
    expect(collectExpected(s, "2026-12-15")).toBe(s);
    expect(validateState(s)).toBe(s);
  });
  it("confirms a corrected actual amount exactly once", () => {
    const s = collectExpected(state(), "2026-10-01"),
      id = s.expectedPayments![0].id;
    const next = resolveExpected(s, id, true, 12000);
    expect(balances(next)[0].balance).toBe(88000);
    expect(next.transactions[0].amount).toBe(12000);
    expect(() => resolveExpected(next, id, true)).toThrow();
    expect(validateState(next)).toBe(next);
  });
  it("does not invent a charge when a payment fails or a schedule is paused", () => {
    const s = collectExpected(state(), "2026-10-01"),
      next = resolveExpected(s, s.expectedPayments![0].id, false);
    expect(next.transactions).toHaveLength(0);
    expect(next.expectedPayments![0].status).toBe("skipped");
    const paused = state();
    paused.bills[0].active = false;
    expect(collectExpected(paused, "2026-12-01")).toBe(paused);
  });
  it("keeps manual bills manual and includes pending charges in available funds", () => {
    const s = state();
    s.bills[0].autopay = false;
    expect(collectExpected(s, "2026-10-01")).toBe(s);
    const n = collectExpected(state(), "2026-10-01");
    expect(available(n).upcoming).toBeGreaterThanOrEqual(10000);
  });
  it("tracks income separately until confirmed", () => {
    const s = emptyState();
    s.recurringIncome = [
      {
        id: "salary",
        name: "Salary",
        amount: 600000,
        date: "2026-10-01",
        cadence: "monthly",
        account: "bank",
        active: true,
      },
    ];
    const n = collectExpected(s, "2026-10-01");
    expect(balances(n)[0].balance).toBe(0);
    const done = resolveExpected(n, n.expectedPayments![0].id, true);
    expect(balances(done)[0].balance).toBe(600000);
    expect(validateState(done)).toBe(done);
  });
  it("validates restored schedule references and history", () => {
    const s = collectExpected(state(), "2026-10-01");
    expect(() =>
      validateState({
        ...s,
        expectedPayments: [{ ...s.expectedPayments![0], account: "missing" }],
      }),
    ).toThrow();
    expect(() =>
      validateState({
        ...s,
        bills: [{ ...s.bills[0], trialEnd: "2026-02-31" }],
      }),
    ).toThrow();
  });
  it("preserves confirmed occurrence IDs through undo and backup restoration", () => {
    const s = collectExpected(state(), "2026-10-01");
    const restored = validateState(
      JSON.parse(
        JSON.stringify(resolveExpected(s, s.expectedPayments![0].id, true)),
      ),
    );
    expect(collectExpected(restored, "2026-10-31")).toBe(restored);
    expect(restored.transactions).toHaveLength(1);
  });
});
describe("share allocation and planning", () => {
  it("allocates weighted rounding with exact pennies and deterministic ties", () => {
    expect(
      weightedShares(101, [
        { member: "a", weight: 3 },
        { member: "b", weight: 1 },
      ]),
    ).toEqual([
      { member: "a", amount: 76 },
      { member: "b", amount: 25 },
    ]);
    expect(
      weightedShares(2, [
        { member: "a", weight: 1 },
        { member: "b", weight: 1 },
        { member: "c", weight: 1 },
      ]).map((x) => x.amount),
    ).toEqual([1, 1, 0]);
  });
  it("requires exactly 100 percent and handles large totals without floating point loss", () => {
    expect(() =>
      weightedShares(100, [{ member: "a", weight: 9999 }], true),
    ).toThrow();
    const shares = weightedShares(
      999999999999,
      [
        { member: "a", weight: 3333 },
        { member: "b", weight: 6667 },
      ],
      true,
    );
    expect(shares.reduce((n, x) => n + x.amount, 0)).toBe(999999999999);
    expect(() => weightedShares(1, [{ member: "a", weight: 0 }])).toThrow();
  });
  it("reserves every weekly occurrence, pending charges and savings without counting expected salary", () => {
    let s = state();
    s.bills[0].cadence = "weekly";
    s.settings.reserve = 5000;
    s = collectExpected(s, "2026-10-01");
    const result = affordability(s, 10000, 30, "2026-10-01");
    expect(result.commitments).toBe(50000);
    expect(result.after).toBe(35000);
    expect(result.daily).toBe(1166);
  });
  it("records own share once and leaves the group balances intact", () => {
    const s = emptyState();
    const g: ExpenseGroup = {
      id: "g",
      name: "Trip",
      emoji: "🌴",
      members: [
        { id: "a", name: "You" },
        { id: "b", name: "Friend" },
      ],
      expenses: [
        {
          id: "e",
          title: "Meal",
          amount: 100,
          payer: "b",
          shares: [
            { member: "a", amount: 25 },
            { member: "b", amount: 75 },
          ],
          date: "2026-10-01",
        },
      ],
      settlements: [],
      budget: 0,
      archived: false,
    };
    s.groups = [g];
    const n = recordOwnShare(s, g, "e", "a", "bank", "food");
    expect(n.transactions[0].amount).toBe(25);
    expect(n.groups![0].expenses[0].shares).toEqual(g.expenses[0].shares);
    expect(() =>
      recordOwnShare(n, n.groups![0], "e", "a", "bank", "food"),
    ).toThrow();
    expect(validateState(n)).toBe(n);
  });
  it("includes private trial reminders with no subscription names or amounts", () => {
    const s = state();
    s.bills[0].trialEnd = "2026-10-02";
    const reminders = upcomingReminders(s, new Date("2026-10-01T08:00:00"));
    expect(reminders).toHaveLength(2);
    expect(new Set(reminders.map((n) => n.id)).size).toBe(2);
    expect(JSON.stringify(reminders.map((n) => n.body))).not.toContain(
      "Subscription",
    );
    expect(reminders.some((n) => n.body.includes("free trial"))).toBe(true);
  });
});

it("keeps monthly renewals anchored after short months", () => {
  let s = state();
  s.bills[0].date = "2026-01-31";
  s = collectExpected(s, "2026-02-28");
  expect(s.bills[0].date).toBe("2026-03-31");
  expect(s.expectedPayments!.map((e) => e.date)).toEqual([
    "2026-01-31",
    "2026-02-28",
  ]);
  expect(validateState(s)).toBe(s);
});
