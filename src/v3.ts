import {
  allCategories,
  balances,
  day,
  nextDue,
  uid,
  type Bill,
  type State,
} from "./model";
import type { ExpenseGroup } from "./v2-data";

export type IncomeSchedule = {
  id: string;
  name: string;
  amount: number;
  date: string;
  cadence: Bill["cadence"];
  account: string;
  active: boolean;
  anchorDay?: number;
};
export type ExpectedPayment = {
  id: string;
  source: string;
  title: string;
  amount: number;
  date: string;
  account: string;
  category: string;
  kind: "income" | "expense";
  status: "expected" | "confirmed" | "skipped";
  transaction?: string;
};
export type PriceChange = { date: string; amount: number };

// Expected payments never affect balances until the user confirms the charge.
export function collectExpected(s: State, today = day()): State {
  const events = [...(s.expectedPayments || [])],
    known = new Set(events.map((e) => e.id));
  let changed = false;
  function collect<T extends Bill | IncomeSchedule>(
    rule: T,
    kind: "expense" | "income",
  ): T {
    if (!rule.active || (kind === "expense" && !(rule as Bill).autopay))
      return rule;
    let date = rule.date;
    const anchorDay = rule.anchorDay || Number(rule.date.slice(8));
    for (let i = 0; date <= today && i < 1000; i++) {
      const id = `${kind}:${rule.id}:${date}`;
      if (!known.has(id)) {
        if (events.length >= 20000)
          throw Error(
            "Your scheduled payment history is full. Export a backup before continuing.",
          );
        events.push({
          id,
          source: rule.id,
          title: rule.name,
          amount: rule.amount,
          date,
          account: rule.account,
          category: kind === "expense" ? (rule as Bill).category : "other",
          kind,
          status: "expected",
        });
        known.add(id);
      }
      date = nextDue(date, rule.cadence, anchorDay);
      changed = true;
    }
    return date === rule.date
      ? rule
      : { ...rule, date, anchorDay, remindOn: undefined };
  }
  const bills = s.bills.map((b) => collect(b, "expense"));
  const recurringIncome = (s.recurringIncome || []).map((r) =>
    collect(r, "income"),
  );
  return changed
    ? { ...s, bills, recurringIncome, expectedPayments: events }
    : s;
}
export function resolveExpected(
  s: State,
  id: string,
  confirmed: boolean,
  amount?: number,
): State {
  const e = s.expectedPayments?.find((e) => e.id === id);
  if (!e || e.status !== "expected")
    throw Error("This payment has already been reviewed.");
  const value = amount ?? e.amount;
  if (!Number.isSafeInteger(value) || value <= 0 || value > 1e12)
    throw Error("Enter a valid payment amount.");
  const transaction = confirmed ? uid() : undefined;
  return {
    ...s,
    expectedPayments: s.expectedPayments!.map((x) =>
      x.id === id
        ? {
            ...x,
            amount: value,
            status: confirmed ? "confirmed" : "skipped",
            transaction,
          }
        : x,
    ),
    transactions: confirmed
      ? [
          {
            id: transaction!,
            title: e.title,
            amount: value,
            kind: e.kind,
            date: e.date,
            account: e.account,
            category: e.category,
            note: "Confirmed scheduled payment",
            tags: "recurring",
            reviewed: true,
          },
          ...s.transactions,
        ]
      : s.transactions,
  };
}
export function weightedShares(
  amount: number,
  entries: { member: string; weight: number }[],
  percentage = false,
) {
  const total = entries.reduce((n, e) => n + e.weight, 0);
  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    !entries.length ||
    new Set(entries.map((e) => e.member)).size !== entries.length ||
    entries.some(
      (e) =>
        !Number.isSafeInteger(e.weight) || e.weight < 0 || e.weight > 1000000,
    ) ||
    total <= 0
  )
    throw Error("Enter valid shares for at least one person.");
  if (percentage && total !== 10000)
    throw Error("Percentages must add up to 100%.");
  // BigInt keeps allocation exact even for large totals and fractional weights.
  const ranked = entries.map((e, index) => {
    const product = BigInt(amount) * BigInt(e.weight);
    return {
      member: e.member,
      amount: Number(product / BigInt(total)),
      remainder: product % BigInt(total),
      index,
    };
  });
  let left = amount - ranked.reduce((n, e) => n + e.amount, 0);
  for (const e of [...ranked].sort((a, b) =>
    a.remainder === b.remainder
      ? a.index - b.index
      : a.remainder > b.remainder
        ? -1
        : 1,
  )) {
    if (!left) break;
    e.amount++;
    left--;
  }
  return ranked.map(({ member, amount }) => ({ member, amount }));
}
export function affordability(
  s: State,
  purchase: number,
  horizon = 30,
  today = day(),
) {
  const endDate = new Date(today + "T12:00:00");
  endDate.setDate(endDate.getDate() + horizon);
  const end = day(endDate);
  const balance = balances(s).reduce((n, a) => n + a.balance, 0);
  let commitments = (s.expectedPayments || [])
    .filter(
      (e) => e.kind === "expense" && e.status === "expected" && e.date <= end,
    )
    .reduce((n, e) => n + e.amount, 0);
  for (const b of s.bills.filter((b) => b.active)) {
    let date = b.date;
    for (let i = 0; date <= end && i < 6000; i++) {
      commitments += b.amount;
      date = nextDue(date, b.cadence, b.anchorDay || Number(b.date.slice(8)));
    }
  }
  const after = balance - commitments - s.settings.reserve - purchase;
  return {
    balance,
    commitments,
    reserve: s.settings.reserve,
    after,
    daily: Math.max(0, Math.floor(after / horizon)),
    end,
  };
}
export function recordOwnShare(
  s: State,
  group: ExpenseGroup,
  expenseId: string,
  member: string,
  account: string,
  category: string,
): State {
  const expense = group.expenses.find((e) => e.id === expenseId),
    share = expense?.shares.find((x) => x.member === member);
  if (!expense || !share?.amount)
    throw Error("Choose someone with a share in this expense.");
  if (expense.walletTransaction)
    throw Error("A wallet entry was already created for this expense.");
  const id = uid();
  return {
    ...s,
    transactions: [
      {
        id,
        kind: "expense",
        amount: share.amount,
        title: expense.title,
        account,
        category,
        date: expense.date,
        note: `My share in ${group.name}; excludes money lent to others.`,
        tags: "shared",
        reviewed: true,
        receipt: expense.receipt,
      },
      ...s.transactions,
    ],
    groups: (s.groups || []).map((g) =>
      g.id === group.id
        ? {
            ...g,
            expenses: g.expenses.map((e) =>
              e.id === expenseId ? { ...e, walletTransaction: id } : e,
            ),
          }
        : g,
    ),
  };
}
export function validateV3(s: State) {
  const str = (v: unknown, max = 200): v is string =>
    typeof v === "string" && v.trim().length > 0 && v.length <= max;
  const amount = (v: unknown): v is number =>
    Number.isSafeInteger(v) && Number(v) > 0 && Number(v) <= 1e12;
  const date = (v: unknown): v is string =>
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    v >= "2000-01-01" &&
    day(new Date(v + "T12:00:00")) === v;
  const account = (id: string) => s.accounts.some((a) => a.id === id);
  const category = (id: string) => allCategories(s).some((c) => c.id === id);
  const list = (v: unknown, max: number): v is { id: string }[] =>
    Array.isArray(v) &&
    v.length <= max &&
    v.every((e) => e && str(e.id)) &&
    new Set(v.map((e) => e.id)).size === v.length;
  if (
    s.recurringIncome !== undefined &&
    (!list(s.recurringIncome, 1000) ||
      s.recurringIncome.some(
        (r) =>
          !str(r.name) ||
          !amount(r.amount) ||
          !date(r.date) ||
          !account(r.account) ||
          !["weekly", "monthly", "yearly"].includes(r.cadence) ||
          typeof r.active !== "boolean",
      ))
  )
    throw Error("Invalid recurring income.");
  if (
    s.expectedPayments !== undefined &&
    (!list(s.expectedPayments, 20000) ||
      s.expectedPayments.some(
        (e) =>
          !str(e.title) ||
          !str(e.source) ||
          !amount(e.amount) ||
          !date(e.date) ||
          !account(e.account) ||
          !category(e.category) ||
          !["income", "expense"].includes(e.kind) ||
          !["expected", "confirmed", "skipped"].includes(e.status) ||
          (e.transaction !== undefined && !str(e.transaction, 100)),
      ))
  )
    throw Error("Invalid scheduled payment history.");
  for (const r of [...s.bills, ...(s.recurringIncome || [])])
    if (
      r.anchorDay !== undefined &&
      (!Number.isInteger(r.anchorDay) || r.anchorDay < 1 || r.anchorDay > 31)
    )
      throw Error("Invalid recurring day.");
  for (const b of s.bills) {
    if (
      (b.autopay !== undefined && typeof b.autopay !== "boolean") ||
      (b.trialEnd !== undefined && !date(b.trialEnd)) ||
      (b.priceHistory !== undefined &&
        (!Array.isArray(b.priceHistory) ||
          b.priceHistory.length > 1000 ||
          b.priceHistory.some((p) => !p || !date(p.date) || !amount(p.amount))))
    )
      throw Error("Invalid subscription details.");
  }
  for (const g of s.groups || [])
    for (const e of g.expenses) {
      if (
        (e.receipt !== undefined &&
          (typeof e.receipt !== "string" ||
            e.receipt.length > 3000000 ||
            !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(
              e.receipt,
            ))) ||
        (e.walletTransaction !== undefined && !str(e.walletTransaction, 100)) ||
        (e.splitMode !== undefined &&
          !["equal", "custom", "percentage", "weighted"].includes(e.splitMode))
      )
        throw Error("Invalid shared expense attachment.");
    }
}
