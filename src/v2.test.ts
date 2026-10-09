import { describe, it, expect } from "vitest";
import {
  emptyState,
  validateState,
  type State,
  type Transaction,
} from "./model";
import {
  groupBalances,
  settlementsFor,
  splitEvenly,
  recordSettlement,
  budgetWindow,
  parseQuickEntry,
  monthlyStory,
} from "./v2";
import { encryptBackup, decryptBackup } from "./backup-crypto";
import { upcomingReminders } from "./reminders";
import type { ExpenseGroup } from "./v2-data";
function group(): ExpenseGroup {
  return {
    id: "trip",
    name: "Trip",
    emoji: "🌴",
    budget: 100000,
    archived: false,
    members: [
      { id: "a", name: "You" },
      { id: "b", name: "Aman" },
      { id: "c", name: "Priya" },
    ],
    expenses: [],
    settlements: [],
  };
}
function transaction(s: State, date: string, amount: number): Transaction {
  return {
    id: crypto.randomUUID(),
    kind: "expense",
    title: "Lunch",
    category: "food",
    account: s.accounts[0].id,
    amount,
    date,
    note: "",
    tags: "",
    reviewed: true,
  };
}
describe("shared money integrity", () => {
  it("allocates odd pennies exactly and deterministically", () => {
    expect(splitEvenly(100, ["a", "b", "c"]).map((x) => x.amount)).toEqual([
      34, 33, 33,
    ]);
    expect(splitEvenly(1, ["a", "b", "c"]).map((x) => x.amount)).toEqual([
      1, 0, 0,
    ]);
  });
  it("rejects an empty or repeated participant selection", () => {
    expect(() => splitEvenly(5, [])).toThrow();
    expect(() => splitEvenly(5, ["a", "a"])).toThrow();
  });
  it("balances different payers and custom shares to zero", () => {
    const g = group();
    g.expenses = [
      {
        id: "e1",
        title: "Dinner",
        amount: 100,
        payer: "a",
        shares: splitEvenly(100, ["a", "b", "c"]),
        date: "2026-10-01",
      },
      {
        id: "e2",
        title: "Taxi",
        amount: 80,
        payer: "b",
        shares: [
          { member: "a", amount: 20 },
          { member: "c", amount: 60 },
        ],
        date: "2026-10-02",
      },
    ];
    expect(groupBalances(g).map((m) => m.net)).toEqual([46, 47, -93]);
    expect(settlementsFor(g)).toEqual([
      { from: "c", to: "a", amount: 46 },
      { from: "c", to: "b", amount: 47 },
    ]);
  });
  it("records partial settlement and rejects overpayments", () => {
    const g = group();
    g.expenses = [
      {
        id: "e",
        title: "Hotel",
        amount: 300,
        payer: "a",
        shares: splitEvenly(300, ["a", "b", "c"]),
        date: "2026-10-01",
      },
    ];
    const next = recordSettlement(g, "b", "a", 40);
    expect(groupBalances(next).map((m) => m.net)).toEqual([160, -60, -100]);
    expect(() => recordSettlement(next, "b", "a", 61)).toThrow();
    expect(() => recordSettlement(next, "a", "b", 1)).toThrow();
    expect(g.settlements).toHaveLength(0);
  });
  it("all proposed settlements close the ledger without losing pennies", () => {
    for (let n = 1; n < 100; n++) {
      let g = group();
      g.expenses = [
        {
          id: "e",
          title: "Dinner",
          amount: n,
          payer: "a",
          shares: splitEvenly(n, ["a", "b", "c"]),
          date: "2026-10-01",
        },
      ];
      for (const p of settlementsFor(g))
        g = recordSettlement(g, p.from, p.to, p.amount);
      expect(groupBalances(g).every((m) => m.net === 0)).toBe(true);
    }
  });
  it("rejects malformed group backups and preserves valid groups", () => {
    const s = emptyState();
    s.groups = [group()];
    expect(validateState(JSON.parse(JSON.stringify(s))).groups).toHaveLength(1);
    s.groups[0].expenses = [
      {
        id: "e",
        title: "Bad split",
        amount: 100,
        payer: "a",
        shares: [{ member: "b", amount: 99 }],
        date: "2026-10-01",
      },
    ];
    expect(() => validateState(s)).toThrow("shares");
    s.groups[0].expenses[0].shares = [{ member: "missing", amount: 100 }];
    expect(() => validateState(s)).toThrow();
  });
});
describe("budget schedules", () => {
  it("carries only recorded unused budget from its starting period", () => {
    const s = emptyState(),
      b = {
        id: "b",
        category: "food",
        limit: 10000,
        rollover: true,
        startDate: "2026-08-01",
      };
    s.transactions = [
      transaction(s, "2026-08-02", 6000),
      transaction(s, "2026-09-05", 11000),
      transaction(s, "2026-10-01", 1000),
    ];
    expect(budgetWindow(s, b, "2026-10-10")).toMatchObject({
      carry: 3000,
      limit: 13000,
      spent: 1000,
    });
    expect(budgetWindow(s, b, "2026-07-01")).toMatchObject({
      active: false,
      limit: 0,
      spent: 0,
    });
  });
  it("absorbs overspending without negative future budgets", () => {
    const s = emptyState();
    s.transactions = [transaction(s, "2026-09-02", 40000)];
    expect(
      budgetWindow(
        s,
        {
          id: "b",
          category: "food",
          limit: 10000,
          rollover: true,
          startDate: "2026-09-01",
        },
        "2026-10-10",
      ).limit,
    ).toBe(10000);
  });
  it("uses Monday through Sunday across year boundaries", () => {
    const s = emptyState();
    s.transactions = [
      transaction(s, "2025-12-28", 100),
      transaction(s, "2025-12-29", 200),
      transaction(s, "2026-01-04", 300),
      transaction(s, "2026-01-05", 400),
    ];
    expect(
      budgetWindow(
        s,
        { id: "b", category: "food", limit: 1000, period: "weekly" },
        "2026-01-01",
      ),
    ).toMatchObject({ start: "2025-12-29", end: "2026-01-05", spent: 500 });
  });
  it("keeps legacy monthly budgets compatible", () => {
    const s = emptyState();
    s.budgets = [{ id: "b", category: "food", limit: 1000 }];
    expect(validateState(s)).toBe(s);
    expect(budgetWindow(s, s.budgets[0], "2026-10-15").limit).toBe(1000);
  });
});
describe("quick entry and categories", () => {
  it("extracts an expense, previous date, cash wallet and category for review", () => {
    const s = emptyState();
    s.accounts.push({
      id: "cash",
      name: "Pocket cash",
      type: "Cash",
      opening: 0,
      color: "#112233",
    });
    expect(
      parseQuickEntry("₹180 lunch yesterday cash", s, "2026-01-01"),
    ).toMatchObject({
      amount: 18000,
      date: "2025-12-31",
      account: "cash",
      category: "food",
      title: "lunch",
    });
    expect(s.transactions).toHaveLength(0);
  });
  it("reads Indian comma notation without truncating amounts", () => {
    expect(
      parseQuickEntry("₹1,20,000 received salary", emptyState()).amount,
    ).toBe(12000000);
    expect(() => parseQuickEntry("₹1,2,0 lunch", emptyState())).toThrow();
  });
  it("rejects currency mismatches and ambiguous missing amounts", () => {
    expect(() => parseQuickEntry("$25 lunch", emptyState())).toThrow(
      "currency",
    );
    expect(() =>
      parseQuickEntry("call 12345 about lunch", emptyState()),
    ).toThrow();
    expect(() =>
      parseQuickEntry("180 lunch 2099-01-01", emptyState()),
    ).toThrow();
  });
  it("validates new categories in transactions and rejects unsafe definitions", () => {
    const s = emptyState();
    s.customCategories = [
      {
        id: "custom-pets",
        name: "Pets",
        icon: "Dog",
        color: "#224466",
        tint: "#eeeeee",
      },
    ];
    s.transactions = [
      { ...transaction(s, "2026-10-01", 1000), category: "custom-pets" },
    ];
    expect(validateState(s)).toBe(s);
    expect(monthlyStory(s, "2026-10").changes[0].name).toBe("Pets");
    s.customCategories[0].color = "url(bad)";
    expect(() => validateState(s)).toThrow();
  });
});
describe("encrypted backup safety", () => {
  it("roundtrips complete v2 data and produces fresh ciphertext", async () => {
    const s = emptyState();
    s.groups = [group()];
    const a = await encryptBackup(s, "a very private passphrase"),
      b = await encryptBackup(s, "a very private passphrase");
    expect(a).not.toEqual(b);
    expect(a).not.toContain('"members"');
    expect(
      await decryptBackup(JSON.parse(a), "a very private passphrase"),
    ).toEqual(s);
  });
  it("rejects wrong keys and modified ciphertext without returning records", async () => {
    const value = JSON.parse(
      await encryptBackup(emptyState(), "correct passphrase"),
    );
    await expect(decryptBackup(value, "wrong passphrase")).rejects.toThrow(
      "Could not unlock",
    );
    value.data = (value.data[0] === "A" ? "B" : "A") + value.data.slice(1);
    await expect(decryptBackup(value, "correct passphrase")).rejects.toThrow();
  });
  it("rejects weak passwords and malformed envelopes", async () => {
    await expect(encryptBackup(emptyState(), "short")).rejects.toThrow();
    await expect(
      decryptBackup({ format: "gareeb-encrypted", version: 2 }, "password"),
    ).rejects.toThrow();
  });
});
describe("private reminders", () => {
  it("only schedules active bills, hides amounts, and uses inexact delivery", () => {
    const s = emptyState();
    s.bills = [
      {
        id: "rent",
        name: "Secret rent",
        amount: 999999,
        date: "2026-10-15",
        cadence: "monthly",
        category: "home",
        account: s.accounts[0].id,
        active: true,
      },
      {
        id: "paused",
        name: "Paused",
        amount: 100,
        date: "2026-10-12",
        cadence: "monthly",
        category: "home",
        account: s.accounts[0].id,
        active: false,
      },
    ];
    const r = upcomingReminders(s, new Date("2026-10-10T12:00:00"));
    expect(r).toHaveLength(1);
    expect(r[0].body).not.toContain("Secret");
    expect(r[0].isExactNotification).toBe(false);
    expect(r[0].schedule.at.getDate()).toBe(15);
  });
});
