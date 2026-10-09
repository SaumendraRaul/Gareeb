import {
  allCategories,
  cents,
  day,
  month,
  shiftMonth,
  totals,
  inMonth,
  uid,
  type Budget,
  type State,
  type Transaction,
} from "./model";
import type { ExpenseGroup, GroupExpense } from "./v2-data";
export function splitEvenly(amount: number, members: string[]) {
  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    !members.length ||
    new Set(members).size !== members.length
  )
    throw Error("Choose people and a positive amount.");
  const base = Math.floor(amount / members.length),
    remainder = amount % members.length;
  return members.map((member, i) => ({
    member,
    amount: base + (i < remainder ? 1 : 0),
  }));
}
export function groupBalances(g: ExpenseGroup) {
  const net = Object.fromEntries(g.members.map((m) => [m.id, 0]));
  for (const e of g.expenses) {
    net[e.payer] += e.amount;
    for (const share of e.shares) net[share.member] -= share.amount;
  }
  for (const p of g.settlements) {
    net[p.from] += p.amount;
    net[p.to] -= p.amount;
  }
  return g.members.map((m) => ({ ...m, net: net[m.id] }));
}
export function settlementsFor(g: ExpenseGroup) {
  const balances = groupBalances(g),
    debts = balances
      .filter((m) => m.net < 0)
      .map((m) => ({ ...m, left: -m.net })),
    credits = balances
      .filter((m) => m.net > 0)
      .map((m) => ({ ...m, left: m.net }));
  const result: { from: string; to: string; amount: number }[] = [];
  for (const d of debts)
    for (const c of credits) {
      const amount = Math.min(d.left, c.left);
      if (amount) {
        result.push({ from: d.id, to: c.id, amount });
        d.left -= amount;
        c.left -= amount;
      }
    }
  return result;
}
export function recordSettlement(
  g: ExpenseGroup,
  from: string,
  to: string,
  amount: number,
  date = day(),
) {
  const balances = groupBalances(g),
    debtor = balances.find((m) => m.id === from),
    creditor = balances.find((m) => m.id === to);
  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    !debtor ||
    !creditor ||
    from === to ||
    amount > Math.min(-debtor.net, creditor.net)
  )
    throw Error("Payment exceeds the outstanding balance.");
  return {
    ...g,
    settlements: [...g.settlements, { id: uid(), from, to, amount, date }],
  };
}
export function upsertGroupExpense(g: ExpenseGroup, e: GroupExpense) {
  return {
    ...g,
    expenses: g.expenses.some((x) => x.id === e.id)
      ? g.expenses.map((x) => (x.id === e.id ? e : x))
      : [...g.expenses, e],
  };
}
function startOfPeriod(date: string, weekly: boolean) {
  if (!weekly) return date.slice(0, 7) + "-01";
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return day(d);
}
function nextPeriod(date: string, weekly: boolean) {
  if (!weekly) return shiftMonth(date.slice(0, 7), 1) + "-01";
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + 7);
  return day(d);
}
export function budgetWindow(s: State, b: Budget, date = day()) {
  const weekly = b.period === "weekly",
    start = startOfPeriod(date, weekly),
    end = nextPeriod(start, weekly);
  const spending = new Map<string, number>();
  for (const t of s.transactions)
    if (t.kind === "expense" && t.category === b.category) {
      const p = startOfPeriod(t.date, weekly);
      spending.set(p, (spending.get(p) || 0) + t.amount);
    }
  const spentBetween = (a: string, _z: string) => spending.get(a) || 0;
  let carry = 0;
  if (b.rollover && b.startDate) {
    let cursor = startOfPeriod(b.startDate, weekly);
    for (let i = 0; cursor < start && i < 6000; i++) {
      const next = nextPeriod(cursor, weekly);
      carry = Math.max(0, carry + b.limit - spentBetween(cursor, next));
      cursor = next;
    }
  }
  const active = !b.startDate || start >= startOfPeriod(b.startDate, weekly);
  return {
    start,
    end,
    spent: active ? spentBetween(start, end) : 0,
    carry,
    limit: active ? b.limit + carry : 0,
    baseLimit: b.limit,
    active,
  };
}
export function parseQuickEntry(
  raw: string,
  s: State,
  today = day(),
): Transaction {
  const text = raw.trim();
  // Explicit currency amount or a leading amount; never guess from phone/account numbers.
  const match =
    text.match(
      /(?:₹|rs\.?|inr|usd|eur|gbp|aed|\$|€|£)\s*([\d,]+(?:\.\d{1,2})?)(?![\d.,a-zA-Z])/i,
    ) || text.match(/^([\d,]+(?:\.\d{1,2})?)(?![\d.,a-zA-Z])\s+/);
  if (!match)
    throw Error(
      "Start with an amount, for example “180 lunch yesterday cash”.",
    );
  const token = match[1].split(".")[0];
  if (
    token.includes(",") &&
    !/^\d{1,3}(,\d{3})+$/.test(token) &&
    !/^\d{1,2}(,\d{2})*,\d{3}$/.test(token)
  )
    throw Error("Check the commas in your amount.");
  const currencyToken = match[0]
    .slice(0, match[0].indexOf(match[1]))
    .trim()
    .toUpperCase();
  const currencies: Record<string, string> = {
    "₹": "INR",
    RS: "INR",
    "RS.": "INR",
    INR: "INR",
    $: "USD",
    USD: "USD",
    "€": "EUR",
    EUR: "EUR",
    "£": "GBP",
    GBP: "GBP",
    AED: "AED",
  };
  if (currencyToken && currencies[currencyToken] !== s.settings.currency)
    throw Error(
      `Your wallets use ${s.settings.currency}. Enter the amount in that currency.`,
    );
  const amount = cents(match[1].replaceAll(",", ""));
  const explicit = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  let date = today;
  if (explicit) date = explicit[1];
  else if (/\byesterday\b/i.test(text)) {
    const d = new Date(today + "T12:00:00");
    d.setDate(d.getDate() - 1);
    date = day(d);
  }
  if (
    date > today ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    day(new Date(date + "T12:00:00")) !== date
  )
    throw Error("Use a valid date today or earlier.");
  const kind = /\b(salary|received|income|refund)\b/i.test(text)
    ? "income"
    : "expense";
  const account =
    s.accounts.find((a) => text.toLowerCase().includes(a.name.toLowerCase())) ||
    (/\bcash\b/i.test(text)
      ? s.accounts.find((a) => a.type === "Cash")
      : undefined) ||
    s.accounts[0];
  const words = text.toLowerCase();
  const category =
    s.rules.find((r) => words.includes(r.match.toLowerCase()))?.category ||
    allCategories(s).find((c) => words.includes(c.name.toLowerCase()))?.id ||
    (/lunch|dinner|coffee|chai|breakfast|swiggy|zomato/.test(words)
      ? "food"
      : /uber|train|taxi|bus|fuel|metro/.test(words)
        ? "transport"
        : /grocery|groceries|vegetables/.test(words)
          ? "groceries"
          : /rent|electricity|internet/.test(words)
            ? "home"
            : "other");
  let title = text
    .replace(match[0], "")
    .replace(/\b(today|yesterday|via|using)\b/gi, "")
    .replace(explicit?.[0] || /\bnever-match-this\b/, "")
    .trim();
  for (const a of s.accounts)
    title = title
      .replace(
        new RegExp(a.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"),
        "",
      )
      .trim();
  title = title
    .replace(/\bcash\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[,\s]+|[,\s]+$/g, "");
  if (!title) title = kind === "income" ? "Income" : "Expense";
  return {
    id: uid(),
    kind,
    amount,
    title: title.slice(0, 200),
    category,
    account: account.id,
    date,
    note: "",
    tags: "",
    reviewed: true,
  };
}
export function monthlyStory(s: State, m: string) {
  const now = inMonth(s, m),
    prev = inMonth(s, shiftMonth(m, -1)),
    sum = totals(now),
    old = totals(prev);
  const changes = allCategories(s)
    .map((c) => {
      const spend = (ts: Transaction[]) =>
        ts
          .filter((t) => t.kind === "expense" && t.category === c.id)
          .reduce((n, t) => n + t.amount, 0);
      return {
        ...c,
        current: spend(now),
        previous: spend(prev),
        delta: spend(now) - spend(prev),
      };
    })
    .filter((c) => c.current || c.previous)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return {
    sum,
    old,
    changes,
    count: now.filter((t) => t.kind === "expense").length,
    hasPrevious: prev.length > 0,
    partial: m === month(),
  };
}
