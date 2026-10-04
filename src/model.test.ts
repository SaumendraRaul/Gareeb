import { describe, it, expect } from "vitest";
import {
  available,
  balances,
  cents,
  day,
  demoState,
  emptyState,
  exportCSV,
  nextDue,
  parseCSV,
  payBill,
  totals,
  validateState,
  type Transaction,
} from "./model";
const t = (extra: Partial<Transaction> = {}): Transaction => ({
  id: crypto.randomUUID(),
  date: day(),
  kind: "expense",
  amount: 1000,
  title: "Coffee",
  category: "food",
  account: "bank",
  note: "",
  tags: "",
  reviewed: true,
  ...extra,
});
describe("money accuracy", () => {
  it("uses integer minor units and rejects invalid monetary input", () => {
    expect(cents("123.45")).toBe(12345);
    expect(cents("0.01")).toBe(1);
    for (const v of ["-1", "0", "1.001", "NaN", "Infinity", "1e4"])
      expect(() => cents(v)).toThrow();
  });
  it("keeps transfers out of income and expense totals", () => {
    expect(
      totals([
        t(),
        t({ kind: "income", amount: 5000 }),
        t({ kind: "transfer", amount: 2000, toAccount: "cash" }),
      ]),
    ).toEqual({ income: 5000, expense: 1000, net: 4000 });
  });
  it("balances both sides of a transfer without changing net worth", () => {
    const s = emptyState();
    s.accounts[0].opening = 10000;
    s.transactions = [t({ kind: "transfer", amount: 2500, toAccount: "cash" })];
    expect(balances(s).map((a) => a.balance)).toEqual([7500, 2500]);
    expect(available(s).total).toBe(10000);
  });
  it("supports negative credit balances", () => {
    const s = emptyState();
    s.accounts[0].opening = -10000;
    s.transactions = [t(), t({ kind: "income", amount: 2000 })];
    expect(balances(s)[0].balance).toBe(-9000);
  });
  it("protects reserve and upcoming bills", () => {
    const s = emptyState();
    s.accounts[0].opening = 10000;
    s.settings.reserve = 3000;
    s.bills = [
      {
        id: "bill",
        name: "Rent",
        amount: 4000,
        date: day(),
        cadence: "monthly",
        category: "home",
        account: "bank",
        active: true,
      },
    ];
    expect(available(s).spendable).toBe(3000);
  });
});
describe("bill calendar", () => {
  it("clamps January 31 to February and handles leap years", () => {
    expect(nextDue("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(nextDue("2024-01-31", "monthly")).toBe("2024-02-29");
    expect(nextDue("2024-02-29", "yearly")).toBe("2025-02-28");
  });
  it("advances weekly across year boundaries", () =>
    expect(nextDue("2026-12-29", "weekly")).toBe("2027-01-05"));
  it("records payment and advances due date exactly once per action", () => {
    const s = emptyState();
    s.bills = [
      {
        id: "bill",
        name: "Rent",
        amount: 4000,
        date: "2026-10-01",
        cadence: "monthly",
        category: "home",
        account: "bank",
        active: true,
      },
    ];
    const next = payBill(s, "bill");
    expect(next.transactions).toHaveLength(1);
    expect(next.transactions[0].amount).toBe(4000);
    expect(next.bills[0].date).toBe("2026-11-01");
    expect(s.transactions).toHaveLength(0);
  });
});
describe("backup and import boundaries", () => {
  it("validates fresh and populated states", () => {
    expect(validateState(emptyState()).version).toBe(1);
    expect(validateState(demoState()).demo).toBe(true);
  });
  it("rejects broken account references, NaN amounts and bad dates", () => {
    for (const tx of [
      t({ account: "missing" }),
      t({ amount: NaN }),
      t({ date: "2026-02-30" }),
      t({ amount: -1 }),
      t({ kind: "transfer", toAccount: "bank" }),
      t({ receipt: "javascript:alert(1)" }),
    ])
      expect(() =>
        validateState({ ...emptyState(), transactions: [tx] }),
      ).toThrow();
  });
  it("rejects invalid goal totals and duplicate budget categories", () => {
    const s = emptyState();
    s.goals = [
      {
        id: "g",
        name: "test",
        saved: -10,
        target: 100,
        date: "2027-01-01",
        emoji: "🌱",
      },
    ];
    expect(() => validateState(s)).toThrow();
    s.goals = [];
    s.budgets = [
      { id: "a", category: "food", limit: 1000 },
      { id: "b", category: "food", limit: 2000 },
    ];
    expect(() => validateState(s)).toThrow();
  });
  it("round trips CSV commas, quotes, newlines, and money", () => {
    const tx = t({
      title: 'Coffee, "large"',
      note: "Line one\nLine two",
      amount: 12345,
    });
    const result = parseCSV(exportCSV([tx]), emptyState());
    expect(result[0]).toMatchObject({
      title: tx.title,
      note: tx.note,
      amount: 12345,
    });
  });
  it("deduplicates existing and repeated CSV entries", () => {
    const s = emptyState();
    const tx = t();
    expect(parseCSV(exportCSV([tx, tx]), s)).toHaveLength(1);
    s.transactions = [tx];
    expect(parseCSV(exportCSV([tx]), s)).toHaveLength(0);
  });
  it("rejects a malformed CSV without partial import", () => {
    expect(() =>
      parseCSV(
        "date,title,type,amount\n2026-02-30,Coffee,expense,10",
        emptyState(),
      ),
    ).toThrow();
    expect(() =>
      parseCSV(
        'date,title,type,amount\n2026-10-05,"Coffee,expense,10',
        emptyState(),
      ),
    ).toThrow();
  });
  it("neutralises spreadsheet formula cells", () =>
    expect(exportCSV([t({ title: '=HYPERLINK("bad")' })])).toContain(
      "'=HYPERLINK",
    ));
});
