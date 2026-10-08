import { describe, expect, it, vi, afterEach } from "vitest";
import { emptyState, validateState, type Transaction } from "./model";
import {
  annualBillCost,
  calendarDays,
  pinShortcut,
  weeklySummary,
} from "./extras";
const entry = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: "t1",
  title: "Coffee",
  kind: "expense",
  amount: 10000,
  category: "food",
  account: "bank",
  date: "2026-10-09",
  note: "",
  tags: "",
  reviewed: true,
  ...overrides,
});
afterEach(() => vi.useRealTimers());
describe("everyday features", () => {
  it("groups leap-day entries while transfers stay out of spending", () => {
    const days = calendarDays(
      [
        entry({ date: "2024-02-29" }),
        entry({ date: "2024-02-29", kind: "income", amount: 50000 }),
        entry({
          date: "2024-02-29",
          kind: "transfer",
          amount: 20000,
          toAccount: "cash",
        }),
      ],
      "2024-02",
    );
    expect(days).toHaveLength(29);
    expect(days[28]).toMatchObject({ expense: 10000, income: 50000, count: 3 });
  });
  it("compares equal seven-day periods across month boundaries and excludes future records", () => {
    const w = weeklySummary(
      [
        entry({ date: "2026-09-22" }),
        entry({ date: "2026-09-28", amount: 5000 }),
        entry({ date: "2026-10-04", amount: 7000 }),
        entry({ date: "2026-10-05", amount: 900000 }),
        entry({ date: "2026-09-30", kind: "transfer", amount: 50000 }),
      ],
      new Date("2026-10-04T12:00:00"),
    );
    expect(w).toMatchObject({
      current: 12000,
      before: 10000,
      count: 2,
      quietDays: 5,
      days: 7,
    });
    expect(w.top?.amount).toBe(12000);
  });
  it("does not award quiet days before records began", () => {
    expect(weeklySummary([], new Date("2026-10-09T12:00:00"))).toMatchObject({
      days: 0,
      quietDays: 0,
    });
    expect(
      weeklySummary([entry()], new Date("2026-10-09T12:00:00")),
    ).toMatchObject({ days: 1, quietDays: 0 });
  });
  it("annualises active weekly, monthly and yearly bills", () => {
    const base = {
      id: "b",
      name: "Bill",
      date: "2026-10-09",
      category: "home",
      account: "bank",
      amount: 10000,
      active: true,
    };
    expect(
      annualBillCost([
        { ...base, cadence: "weekly" },
        { ...base, cadence: "monthly" },
        { ...base, cadence: "yearly" },
        { ...base, cadence: "monthly", active: false },
      ]),
    ).toBe(650000);
  });
  it("pins reusable details without copying receipts or changing the ledger", () => {
    const s = emptyState();
    const next = pinShortcut(
      s,
      entry({ receipt: "data:image/png;base64,YQ==" }),
    );
    expect(next.transactions).toEqual([]);
    expect(s.shortcuts).toBeUndefined();
    expect(next.shortcuts![0].receipt).toBeUndefined();
    expect(next.shortcuts![0].id).not.toBe("t1");
    expect(validateState(next)).toBe(next);
  });
  it("loads old backups and rejects malformed new preferences and dangling shortcuts", () => {
    const s = emptyState();
    expect(validateState(s)).toBe(s);
    expect(() =>
      validateState({ ...s, settings: { ...s.settings, haptics: "true" } }),
    ).toThrow();
    expect(() =>
      validateState({ ...s, shortcuts: [entry({ account: "missing" })] }),
    ).toThrow();
  });
  it("enforces the shortcut cap without changing saved records", () => {
    const s = {
      ...emptyState(),
      shortcuts: Array.from({ length: 24 }, (_, i) => entry({ id: String(i) })),
    };
    expect(() => pinShortcut(s, entry())).toThrow("24");
    expect(s.shortcuts).toHaveLength(24);
  });
});
