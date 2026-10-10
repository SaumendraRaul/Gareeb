import type { State } from "./model";
export type CustomCategory = {
  id: string;
  name: string;
  icon: string;
  color: string;
  tint: string;
  parent?: string;
};
export type GroupMember = { id: string; name: string };
export type GroupExpense = {
  id: string;
  title: string;
  amount: number;
  payer: string;
  shares: { member: string; amount: number }[];
  splitMode?: "equal" | "custom" | "percentage" | "weighted";
  receipt?: string;
  walletTransaction?: string;
  date: string;
};
export type Settlement = {
  id: string;
  from: string;
  to: string;
  amount: number;
  date: string;
};
export type ExpenseGroup = {
  id: string;
  name: string;
  emoji: string;
  members: GroupMember[];
  expenses: GroupExpense[];
  settlements: Settlement[];
  budget: number;
  archived: boolean;
};
export const categoryIcons = [
  "Shapes",
  "Utensils",
  "ShoppingBasket",
  "ShoppingBag",
  "TramFront",
  "House",
  "Clapperboard",
  "HeartPulse",
  "BookOpen",
  "Wallet",
  "Sprout",
  "Plane",
  "Coffee",
  "Gift",
  "Dog",
  "Dumbbell",
];
export function validateV2(s: State) {
  const text = (v: unknown, max = 100): v is string =>
    typeof v === "string" && v.trim().length > 0 && v.length <= max;
  const amount = (v: unknown, zero = false): v is number =>
    Number.isSafeInteger(v) && Number(v) >= (zero ? 0 : 1) && Number(v) <= 1e12;
  const date = (v: unknown): v is string => {
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const d = new Date(v + "T12:00:00"),
      [y, m, n] = v.split("-").map(Number);
    return d.getFullYear() === y && d.getMonth() + 1 === m && d.getDate() === n;
  };
  const list = (v: unknown, max: number): v is { id: string }[] =>
    Array.isArray(v) &&
    v.length <= max &&
    v.every((x) => x && text(x.id)) &&
    new Set(v.map((x) => x.id)).size === v.length;
  if (s.customCategories !== undefined) {
    if (
      !list(s.customCategories, 100) ||
      s.customCategories.some(
        (c) =>
          !c.id.startsWith("custom-") ||
          !text(c.name, 40) ||
          !categoryIcons.includes(c.icon) ||
          !/^#[a-f\d]{6}$/i.test(c.color) ||
          !/^#[a-f\d]{6}$/i.test(c.tint),
      )
    )
      throw Error("Invalid custom categories.");
    if (
      new Set(s.customCategories.map((c) => c.name.trim().toLowerCase()))
        .size !== s.customCategories.length
    )
      throw Error("Category names must be unique.");
    if (
      s.customCategories.some(
        (c) =>
          c.parent &&
          (c.parent === c.id ||
            !s.customCategories!.some((p) => p.id === c.parent && !p.parent)),
      )
    )
      throw Error("Invalid parent category.");
  }
  if (s.groups !== undefined) {
    if (!list(s.groups, 100)) throw Error("Invalid expense groups.");
    for (const g of s.groups) {
      if (
        !text(g.name, 60) ||
        !text(g.emoji, 8) ||
        !amount(g.budget, true) ||
        typeof g.archived !== "boolean" ||
        !list(g.members, 30) ||
        g.members.length < 2 ||
        g.members.some((m) => !text(m.name, 40)) ||
        new Set(g.members.map((m) => m.name.trim().toLowerCase())).size !==
          g.members.length ||
        !list(g.expenses, 5000) ||
        !list(g.settlements, 10000)
      )
        throw Error("Invalid group details.");
      const member = (id: string) => g.members.some((m) => m.id === id);
      for (const e of g.expenses)
        if (
          !text(e.title, 100) ||
          !amount(e.amount) ||
          !member(e.payer) ||
          !date(e.date) ||
          !Array.isArray(e.shares) ||
          !e.shares.length ||
          e.shares.length > g.members.length ||
          new Set(e.shares.map((x) => x.member)).size !== e.shares.length ||
          e.shares.some((x) => !member(x.member) || !amount(x.amount, true)) ||
          e.shares.reduce((n, x) => n + x.amount, 0) !== e.amount
        )
          throw Error("Expense shares must add up exactly to the total.");
      for (const p of g.settlements)
        if (
          !member(p.from) ||
          !member(p.to) ||
          p.from === p.to ||
          !amount(p.amount) ||
          !date(p.date)
        )
          throw Error("Invalid group settlement.");
    }
  }
  for (const b of s.budgets)
    if (
      (b.period !== undefined && !["monthly", "weekly"].includes(b.period)) ||
      (b.rollover !== undefined && typeof b.rollover !== "boolean") ||
      (b.startDate !== undefined &&
        (!date(b.startDate) || b.startDate < "2000-01-01"))
    )
      throw Error("Invalid budget schedule.");
  for (const key of ["humour", "reminders"] as const)
    if (s.settings[key] !== undefined && typeof s.settings[key] !== "boolean")
      throw Error("Invalid v2 preferences.");
}
