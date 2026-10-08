import { day, type State, type Transaction, type Bill } from "./model";

export function calendarDays(transactions: Transaction[], selected: string) {
  const [year, month] = selected.split("-").map(Number);
  const count = new Date(year, month, 0).getDate();
  const result = Array.from({ length: count }, (_, i) => ({
    date: `${selected}-${String(i + 1).padStart(2, "0")}`,
    expense: 0,
    income: 0,
    count: 0,
  }));
  const lookup = new Map(result.map((d) => [d.date, d]));
  for (const t of transactions) {
    const d = lookup.get(t.date);
    if (!d) continue;
    d.count++;
    if (t.kind === "expense") d.expense += t.amount;
    if (t.kind === "income") d.income += t.amount;
  }
  return result;
}
export function weeklySummary(transactions: Transaction[], now = new Date()) {
  const dateAt = (offset: number) =>
    day(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset));
  const end = dateAt(0),
    start = dateAt(-6),
    previous = dateAt(-13);
  let current = 0,
    before = 0,
    count = 0;
  const merchants = new Map<string, { title: string; amount: number }>();
  const spendingDays = new Set<string>();
  for (const t of transactions) {
    if (t.kind !== "expense" || t.date > end || t.date < previous) continue;
    if (t.date < start) {
      before += t.amount;
      continue;
    }
    current += t.amount;
    count++;
    spendingDays.add(t.date);
    const key = t.title.toLocaleLowerCase().trim();
    const merchant = merchants.get(key) || { title: t.title, amount: 0 };
    merchant.amount += t.amount;
    merchants.set(key, merchant);
  }
  const first = transactions
    .filter((t) => t.date <= end)
    .map((t) => t.date)
    .sort()[0];
  const observed = Array.from({ length: 7 }, (_, i) => dateAt(-i)).filter(
    (d) => first && d >= first,
  );
  return {
    current,
    before,
    count,
    start,
    end,
    days: observed.length,
    quietDays: observed.filter((d) => !spendingDays.has(d)).length,
    top: [...merchants.values()].sort((a, b) => b.amount - a.amount)[0],
  };
}
export function annualBillCost(bills: Bill[]) {
  return bills
    .filter((b) => b.active)
    .reduce(
      (sum, b) =>
        sum +
        b.amount *
          (b.cadence === "weekly" ? 52 : b.cadence === "monthly" ? 12 : 1),
      0,
    );
}
export function pinShortcut(s: State, transaction: Transaction): State {
  if ((s.shortcuts || []).length >= 24)
    throw new Error(
      "Your 24 shortcuts are full. Remove one from Overview first.",
    );
  const { receipt: _receipt, ...shortcut } = transaction;
  return {
    ...s,
    shortcuts: [
      ...(s.shortcuts || []),
      { ...shortcut, id: crypto.randomUUID() },
    ],
  };
}
