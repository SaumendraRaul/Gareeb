import {
  validateV3,
  type IncomeSchedule,
  type ExpectedPayment,
  type PriceChange,
} from "./v3";
import { validateV2, type ExpenseGroup, type CustomCategory } from "./v2-data";
export type Kind = "expense" | "income" | "transfer";
export type Transaction = {
  id: string;
  kind: Kind;
  amount: number;
  title: string;
  category: string;
  account: string;
  toAccount?: string;
  date: string;
  note: string;
  tags: string;
  reviewed: boolean;
  receipt?: string;
};
export type Account = {
  id: string;
  name: string;
  type: "Bank" | "Cash" | "Credit" | "Savings";
  opening: number;
  color: string;
};
export type Budget = {
  id: string;
  category: string;
  limit: number;
  period?: "monthly" | "weekly";
  rollover?: boolean;
  startDate?: string;
};
export type Goal = {
  id: string;
  name: string;
  target: number;
  saved: number;
  date: string;
  emoji: string;
};
export type Bill = {
  id: string;
  name: string;
  amount: number;
  date: string;
  cadence: "monthly" | "yearly" | "weekly";
  category: string;
  account: string;
  active: boolean;
  remindOn?: string;
  autopay?: boolean;
  anchorDay?: number;
  trialEnd?: string;
  priceHistory?: PriceChange[];
};
export type Split = {
  id: string;
  name: string;
  title: string;
  amount: number;
  direction: "owed" | "owe";
  settled: boolean;
};
export type Rule = { id: string; match: string; category: string };
export type State = {
  version: 1;
  demo: boolean;
  settings: {
    name: string;
    currency: string;
    theme: "light" | "dark";
    monthlyIncome: number;
    reserve: number;
    haptics?: boolean;
    reducedMotion?: boolean;
    humour?: boolean;
    reminders?: boolean;
  };
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  goals: Goal[];
  bills: Bill[];
  splits: Split[];
  rules: Rule[];
  shortcuts?: Transaction[];
  customCategories?: CustomCategory[];
  groups?: ExpenseGroup[];
  recurringIncome?: IncomeSchedule[];
  expectedPayments?: ExpectedPayment[];
};
export const categories = [
  {
    id: "food",
    name: "Food & drinks",
    icon: "Utensils",
    color: "#db8658",
    tint: "#f9eade",
  },
  {
    id: "groceries",
    name: "Groceries",
    icon: "ShoppingBasket",
    color: "#7c9b60",
    tint: "#edf2e2",
  },
  {
    id: "shopping",
    name: "Shopping",
    icon: "ShoppingBag",
    color: "#a48bbb",
    tint: "#f0eaf5",
  },
  {
    id: "transport",
    name: "Transport",
    icon: "TramFront",
    color: "#6395a7",
    tint: "#e6f0f4",
  },
  {
    id: "home",
    name: "Home & bills",
    icon: "House",
    color: "#c3a45c",
    tint: "#f6f0df",
  },
  {
    id: "fun",
    name: "Entertainment",
    icon: "Clapperboard",
    color: "#b67e96",
    tint: "#f7eaf0",
  },
  {
    id: "health",
    name: "Health",
    icon: "HeartPulse",
    color: "#73a491",
    tint: "#e5f2eb",
  },
  {
    id: "education",
    name: "Learning",
    icon: "BookOpen",
    color: "#788bb5",
    tint: "#e9edf7",
  },
  {
    id: "other",
    name: "Other",
    icon: "Shapes",
    color: "#98958c",
    tint: "#eeede8",
  },
];
export const uid = () => crypto.randomUUID();
export const day = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const month = (date = new Date()) => day(date).slice(0, 7);
export const money = (cents: number, currency = "INR", compact = false) =>
  new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 ? 2 : 0,
    ...(compact
      ? { notation: "compact" as const, maximumFractionDigits: 1 }
      : {}),
  }).format(cents / 100);
export function cents(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim()))
    throw new Error("Enter an amount with up to 2 decimal places.");
  const n = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(n) || n <= 0 || n > 1e12)
    throw new Error("Enter an amount between 0.01 and 10 billion.");
  return n;
}
export const allCategories = (s?: Pick<State, "customCategories">) => [
  ...categories,
  ...(s?.customCategories || []),
];
export const cat = (id: string, s?: Pick<State, "customCategories">) =>
  allCategories(s).find((c) => c.id === id) || categories[8];
export function shiftMonth(m: string, delta: number) {
  const [y, n] = m.split("-").map(Number);
  return month(new Date(y, n - 1 + delta, 1));
}
export function nextDue(
  date: string,
  cadence: Bill["cadence"],
  anchorDay?: number,
) {
  const [y, m, d] = date.split("-").map(Number);
  if (cadence === "weekly") return day(new Date(y, m - 1, d + 7));
  const dest = new Date(
    y + (cadence === "yearly" ? 1 : 0),
    m - 1 + (cadence === "monthly" ? 1 : 0),
    1,
  );
  return day(
    new Date(
      dest.getFullYear(),
      dest.getMonth(),
      Math.min(
        anchorDay || d,
        new Date(dest.getFullYear(), dest.getMonth() + 1, 0).getDate(),
      ),
    ),
  );
}
export const inMonth = (s: State, m: string) =>
  s.transactions.filter((t) => t.date.startsWith(m));
export function totals(ts: Transaction[]) {
  const income = ts
    .filter((t) => t.kind === "income")
    .reduce((a, t) => a + t.amount, 0);
  const expense = ts
    .filter((t) => t.kind === "expense")
    .reduce((a, t) => a + t.amount, 0);
  return { income, expense, net: income - expense };
}
export function balances(s: State) {
  return s.accounts.map((a) => ({
    ...a,
    balance:
      a.opening +
      s.transactions.reduce(
        (n, t) =>
          n +
          (t.account === a.id
            ? t.kind === "income"
              ? t.amount
              : -t.amount
            : 0) +
          (t.kind === "transfer" && t.toAccount === a.id ? t.amount : 0),
        0,
      ),
  }));
}
export function categorySpend(ts: Transaction[], id: string) {
  return ts
    .filter((t) => t.kind === "expense" && t.category === id)
    .reduce((n, t) => n + t.amount, 0);
}
export function available(s: State) {
  const total = balances(s).reduce((n, a) => n + a.balance, 0);
  const upcoming =
    s.bills
      .filter((b) => b.active && b.date <= month() + "-31")
      .reduce((n, b) => n + b.amount, 0) +
    (s.expectedPayments || [])
      .filter((e) => e.kind === "expense" && e.status === "expected")
      .reduce((n, e) => n + e.amount, 0);
  return {
    total,
    upcoming,
    spendable: Math.max(0, total - upcoming - s.settings.reserve),
  };
}
export function payBill(s: State, id: string): State {
  const b = s.bills.find((b) => b.id === id);
  if (!b || !b.active) throw new Error("This bill is not active.");
  return {
    ...s,
    transactions: [
      {
        id: uid(),
        kind: "expense",
        amount: b.amount,
        title: b.name,
        category: b.category,
        account: b.account,
        date: day(),
        note: `Bill due ${b.date}`,
        tags: "bill",
        reviewed: true,
      },
      ...s.transactions,
    ],
    bills: s.bills.map((x) =>
      x.id === id
        ? {
            ...x,
            date: nextDue(x.date, x.cadence, x.anchorDay),
            anchorDay: x.anchorDay || Number(x.date.slice(8)),
            remindOn: undefined,
          }
        : x,
    ),
  };
}
export function emptyState(
  name = "friend",
  currency = "INR",
  income = 0,
): State {
  return {
    version: 1,
    demo: false,
    settings: {
      name,
      currency,
      theme: "light",
      monthlyIncome: income,
      reserve: 0,
    },
    accounts: [
      {
        id: "bank",
        name: "Main account",
        type: "Bank",
        opening: 0,
        color: "#194d3d",
      },
      { id: "cash", name: "Cash", type: "Cash", opening: 0, color: "#b68854" },
    ],
    transactions: [],
    budgets: [],
    goals: [],
    bills: [],
    splits: [],
    rules: [],
  };
}
export function demoState(): State {
  const s = emptyState("friend");
  s.demo = true;
  s.settings.monthlyIncome = 7500000;
  s.settings.reserve = 1200000;
  s.accounts = [
    {
      id: "bank",
      name: "Everyday account",
      type: "Bank",
      opening: 2150000,
      color: "#194d3d",
    },
    {
      id: "cash",
      name: "Pocket cash",
      type: "Cash",
      opening: 350000,
      color: "#b68854",
    },
    {
      id: "savings",
      name: "Rainy day fund",
      type: "Savings",
      opening: 4800000,
      color: "#788bb5",
    },
  ];
  const samples: [string, number, string][] = [
    ["Blue Tokai", 280, "food"],
    ["Fresh produce", 640, "groceries"],
    ["Metro recharge", 300, "transport"],
    ["Sunday lunch", 850, "food"],
    ["Uniqlo", 2490, "shopping"],
    ["Spotify", 119, "fun"],
    ["Electricity", 1840, "home"],
    ["Weekend groceries", 1250, "groceries"],
    ["Pharmacy", 420, "health"],
    ["Auto ride", 180, "transport"],
    ["Skillshare", 699, "education"],
    ["Coffee & a croissant", 390, "food"],
  ];
  for (let offset = 0; offset < 6; offset++) {
    const m = shiftMonth(month(), -offset);
    const maxDay = offset === 0 ? new Date().getDate() : 28;
    s.transactions.push({
      id: uid(),
      title: "Monthly salary",
      kind: "income",
      amount: 7500000,
      category: "other",
      account: "bank",
      date: m + "-01",
      note: "",
      tags: "salary",
      reviewed: true,
    });
    for (let i = 0; i < 20; i++) {
      const sample = samples[i % samples.length];
      s.transactions.push({
        id: uid(),
        title: sample[0],
        kind: "expense",
        amount: Math.round(sample[1] * (1 + offset * 0.08)) * 100,
        category: sample[2],
        account: i % 5 === 0 ? "cash" : "bank",
        date: `${m}-${String(1 + (i % maxDay)).padStart(2, "0")}`,
        note: "",
        tags: i % 4 === 0 ? "weekend" : "",
        reviewed: i % 4 !== 0,
      });
    }
    s.transactions.push({
      id: uid(),
      title: "Apartment rent",
      kind: "expense",
      amount: 1800000,
      category: "home",
      account: "bank",
      date: m + "-01",
      note: "",
      tags: "essential",
      reviewed: true,
    });
  }
  s.budgets = [
    ["food", 6500],
    ["groceries", 6000],
    ["shopping", 5000],
    ["transport", 2500],
    ["home", 22000],
    ["fun", 1800],
  ].map(([category, limit]) => ({
    id: uid(),
    category: String(category),
    limit: Number(limit) * 100,
  }));
  s.goals = [
    {
      id: uid(),
      name: "Somewhere by the sea",
      target: 6000000,
      saved: 2400000,
      date: shiftMonth(month(), 6) + "-01",
      emoji: "🏝️",
    },
    {
      id: uid(),
      name: "A little peace of mind",
      target: 15000000,
      saved: 4800000,
      date: shiftMonth(month(), 12) + "-01",
      emoji: "🌱",
    },
  ];
  s.bills = [
    {
      id: uid(),
      name: "Netflix",
      amount: 19900,
      date: month() + "-12",
      cadence: "monthly",
      category: "fun",
      account: "bank",
      active: true,
    },
    {
      id: uid(),
      name: "Internet",
      amount: 89900,
      date: month() + "-18",
      cadence: "monthly",
      category: "home",
      account: "bank",
      active: true,
    },
    {
      id: uid(),
      name: "Spotify",
      amount: 11900,
      date: month() + "-22",
      cadence: "monthly",
      category: "fun",
      account: "bank",
      active: true,
    },
  ];
  s.splits = [
    {
      id: uid(),
      name: "Aarav",
      title: "Weekend dinner",
      amount: 85000,
      direction: "owed",
      settled: false,
    },
    {
      id: uid(),
      name: "Meera",
      title: "Movie night",
      amount: 32000,
      direction: "owe",
      settled: false,
    },
  ];
  s.rules = [
    { id: uid(), match: "coffee", category: "food" },
    { id: uid(), match: "uber", category: "transport" },
  ];
  return s;
}
export function validateState(input: unknown): State {
  if (!input || typeof input !== "object")
    throw new Error("Not a Gareeb backup.");
  const s = input as State;
  const str = (x: unknown, max = 200) =>
    typeof x === "string" && x.length <= max;
  const num = (x: unknown) =>
    typeof x === "number" && Number.isSafeInteger(x) && Math.abs(x) <= 1e12;
  const pos = (x: unknown) => num(x) && Number(x) > 0;
  const date = (x: unknown) =>
    typeof x === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(x) &&
    day(new Date(x + "T12:00:00")) === x;
  const category = (x: unknown) => allCategories(s).some((c) => c.id === x);
  if (
    s.version !== 1 ||
    typeof s.demo !== "boolean" ||
    !s.settings ||
    !str(s.settings.name, 60) ||
    !["INR", "USD", "EUR", "GBP", "AED"].includes(s.settings.currency) ||
    !["light", "dark"].includes(s.settings.theme) ||
    !num(s.settings.monthlyIncome) ||
    s.settings.monthlyIncome < 0 ||
    !num(s.settings.reserve) ||
    s.settings.reserve < 0 ||
    (s.settings.haptics !== undefined &&
      typeof s.settings.haptics !== "boolean") ||
    (s.settings.reducedMotion !== undefined &&
      typeof s.settings.reducedMotion !== "boolean")
  )
    throw new Error("Invalid backup settings.");
  for (const key of [
    "accounts",
    "transactions",
    "budgets",
    "goals",
    "bills",
    "splits",
    "rules",
  ] as const) {
    if (
      !Array.isArray(s[key]) ||
      s[key].length > 50000 ||
      s[key].some((x) => !x || !str(x.id, 100)) ||
      new Set(s[key].map((x) => x.id)).size !== s[key].length
    )
      throw new Error(`Invalid ${key} in backup.`);
  }
  const account = (x: unknown) => s.accounts.some((a) => a.id === x);
  validateV2(s);
  validateV3(s);
  if (
    s.shortcuts !== undefined &&
    (!Array.isArray(s.shortcuts) ||
      s.shortcuts.length > 24 ||
      s.shortcuts.some((t) => !t || !str(t.id, 100)) ||
      new Set(s.shortcuts.map((t) => t.id)).size !== s.shortcuts.length)
  )
    throw new Error("Invalid shortcuts in backup.");
  if (
    !s.accounts.length ||
    s.accounts.some(
      (a) =>
        !str(a.name, 60) ||
        !["Bank", "Cash", "Credit", "Savings"].includes(a.type) ||
        !num(a.opening) ||
        !/^#[a-f0-9]{6}$/i.test(a.color),
    )
  )
    throw new Error("Invalid accounts.");
  if (
    [...s.transactions, ...(s.shortcuts || [])].some(
      (t) =>
        !["expense", "income", "transfer"].includes(t.kind) ||
        !pos(t.amount) ||
        !str(t.title) ||
        !t.title.trim() ||
        !category(t.category) ||
        !account(t.account) ||
        !date(t.date) ||
        !str(t.note, 2000) ||
        !str(t.tags, 200) ||
        typeof t.reviewed !== "boolean" ||
        (t.kind === "transfer" &&
          (!account(t.toAccount) || t.toAccount === t.account)) ||
        (t.receipt !== undefined &&
          (!str(t.receipt, 3000000) ||
            !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(
              t.receipt,
            ))),
    )
  )
    throw new Error("Invalid transactions.");
  if (
    s.budgets.some((b) => !category(b.category) || !pos(b.limit)) ||
    new Set(s.budgets.map((b) => b.category)).size !== s.budgets.length
  )
    throw new Error("Invalid budgets.");
  if (
    s.goals.some(
      (g) =>
        !str(g.name) ||
        !pos(g.target) ||
        !num(g.saved) ||
        g.saved < 0 ||
        !date(g.date) ||
        !str(g.emoji, 20),
    )
  )
    throw new Error("Invalid goals.");
  if (
    s.bills.some(
      (b) =>
        !str(b.name) ||
        !pos(b.amount) ||
        !date(b.date) ||
        (b.remindOn !== undefined && !date(b.remindOn)) ||
        !["weekly", "monthly", "yearly"].includes(b.cadence) ||
        !category(b.category) ||
        !account(b.account) ||
        typeof b.active !== "boolean",
    )
  )
    throw new Error("Invalid bills.");
  if (
    s.splits.some(
      (x) =>
        !str(x.name) ||
        !str(x.title) ||
        !pos(x.amount) ||
        !["owe", "owed"].includes(x.direction) ||
        typeof x.settled !== "boolean",
    )
  )
    throw new Error("Invalid shared expenses.");
  if (
    s.rules.some(
      (r) => !str(r.match, 80) || !r.match.trim() || !category(r.category),
    )
  )
    throw new Error("Invalid rules.");
  return s;
}
export function exportCSV(ts: Transaction[]) {
  const cell = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^(?=\s*[=+@-]|[\t\r\n])/, "'")
      .replaceAll('"', '""') +
    '"';
  return [
    "date,title,type,amount,category,account,toAccount,note,tags",
    ...ts.map((t) =>
      [
        t.date,
        t.title,
        t.kind,
        (t.amount / 100).toFixed(2),
        t.category,
        t.account,
        t.toAccount || "",
        t.note,
        t.tags,
      ]
        .map(cell)
        .join(","),
    ),
  ].join("\r\n");
}
export function parseCSV(text: string, s: State): Transaction[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" && !quoted) {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("Unclosed quote in CSV.");
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const headers =
    rows.shift()?.map((h) =>
      h
        .replace(/^\uFEFF/, "")
        .trim()
        .toLowerCase(),
    ) || [];
  if (!["date", "title", "type", "amount"].every((h) => headers.includes(h)))
    throw new Error(
      "CSV needs date, title, type, and amount columns. Download the template first.",
    );
  const out = rows
    .filter((r) => r.some(Boolean))
    .map((r, i) => {
      const get = (k: string) => r[headers.indexOf(k)] || "";
      const t: Transaction = {
        id: uid(),
        date: get("date"),
        title: get("title"),
        kind: get("type") as Kind,
        amount: cents(get("amount")),
        category: get("category") || "other",
        account: get("account") || s.accounts[0].id,
        toAccount: get("toaccount") || undefined,
        note: get("note"),
        tags: get("tags"),
        reviewed: false,
      };
      try {
        validateState({ ...s, transactions: [t] });
        if (t.date > day()) throw new Error("Future-dated import");
      } catch {
        throw new Error(
          `Check row ${i + 2}: use valid dates, types, category IDs and wallet IDs.`,
        );
      }
      return t;
    });
  const key = (t: Transaction) =>
    [t.date, t.title, t.kind, t.amount, t.account, t.toAccount || ""].join("|");
  const known = new Set(s.transactions.map(key));
  return out.filter((t) => {
    if (known.has(key(t))) return false;
    known.add(key(t));
    return true;
  });
}
