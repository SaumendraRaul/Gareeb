import { useCallback, useEffect, useRef, useState } from "react";
import { App as NativeApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import {
  available,
  balances,
  cat,
  categories,
  categorySpend,
  day,
  demoState,
  emptyState,
  exportCSV,
  inMonth,
  money,
  month,
  parseCSV,
  payBill,
  shiftMonth,
  totals,
  validateState,
  type State,
  type Transaction,
} from "./model";
import { download, loadState, persist } from "./storage";
import { Empty, Field, Icon, Logo, Modal, Progress, Section } from "./ui";
import { Daily, Donut, Trend, IncomeSpark } from "./charts";
import { EditorForm, type Editor } from "./Forms";
import {
  QuickEntries,
  SpendCalendar,
  WeekReview,
  RecurringCosts,
  ExperienceSettings,
} from "./Features";
import { configureHaptics, feedback } from "./feedback";
type Tab = "home" | "activity" | "insights" | "plan" | "wallets" | "settings";
type Confirmation = {
  title: string;
  description: string;
  action: () => void;
  label?: string;
};
const nav: [Tab, string, string][] = [
  ["home", "House", "Overview"],
  ["activity", "ArrowLeftRight", "Activity"],
  ["insights", "ChartNoAxesCombined", "Insights"],
  ["plan", "Target", "Plan"],
  ["wallets", "Wallet", "Wallets"],
];
export default function App() {
  const [s, setS] = useState<State | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [bootError, setBootError] = useState("");
  const [tab, setTab] = useState<Tab>("home");
  const [selected, setSelected] = useState(month());
  const [editor, setEditor] = useState<Editor | null>(null);
  const [confirm, setConfirm] = useState<Confirmation | null>(null);
  const [notice, setNotice] = useState("");
  const [undo, setUndo] = useState<State | null>(null);
  const [hide, setHide] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState(false);
  const [dateFilter, setDateFilter] = useState("");
  const [activityView, setActivityView] = useState("list");
  const [planTab, setPlanTab] = useState("Budgets");
  const [showAlerts, setShowAlerts] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    transactions: Transaction[];
    filename: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    void loadState()
      .then((v) => {
        setS(v);
        setLoaded(true);
      })
      .catch(() => {
        setBootError(
          "Your saved data could not be read. Export the original data before starting over.",
        );
        setLoaded(true);
      });
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = s?.settings.theme || "light";
  }, [s?.settings.theme]);
  useEffect(() => {
    configureHaptics(s?.settings.haptics !== false);
    document.documentElement.dataset.motion = s?.settings.reducedMotion
      ? "reduced"
      : "full";
  }, [s?.settings.haptics, s?.settings.reducedMotion]);
  useEffect(() => {
    setDateFilter("");
  }, [selected]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => {
      setNotice("");
      setUndo(null);
    }, 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  const close = useCallback(() => {
    setEditor(null);
    setConfirm(null);
    setShowAlerts(false);
    setImportPreview(null);
  }, []);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = NativeApp.addListener("backButton", () => {
      if (editor || confirm || showAlerts || importPreview) close();
      else if (tab !== "home") setTab("home");
      else void NativeApp.minimizeApp();
    });
    return () => {
      void listener.then((l) => l.remove());
    };
  }, [editor, confirm, showAlerts, importPreview, tab, close]);
  async function save(next: State, message = "Saved", canUndo = true) {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    try {
      validateState(next);
      await persist(next);
      setUndo(canUndo ? s : null);
      setS(next);
      setNotice(message);
      void feedback("success");
      close();
    } catch (e) {
      setNotice("Could not save: " + (e as Error).message);
      configureHaptics(s?.settings.haptics !== false);
      void feedback("error");
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  function go(next: Tab) {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  const cash = (n: number, compact = false) =>
    hide ? "••••" : money(n, s?.settings.currency || "INR", compact);
  const add = (type: Editor["type"] = "transaction") =>
    setEditor({ type } as Editor);
  function deleteItem(id: string) {
    if (!s || !editor) return;
    const entity = editor.type;
    const keys = {
      transaction: "transactions",
      account: "accounts",
      bill: "bills",
      goal: "goals",
      budget: "budgets",
      split: "splits",
      rule: "rules",
    } as const;
    if (!(entity in keys)) return;
    const key = keys[entity as keyof typeof keys];
    if (
      entity === "account" &&
      (s.accounts.length === 1 ||
        s.transactions.some((t) => t.account === id || t.toAccount === id) ||
        s.bills.some((b) => b.account === id) ||
        (s.shortcuts || []).some((t) => t.account === id || t.toAccount === id))
    ) {
      setNotice(
        "Keep at least one wallet. Wallets used by transactions, bills or shortcuts cannot be deleted.",
      );
      return;
    }
    setEditor(null);
    setConfirm({
      title: `Delete this ${entity}?`,
      description:
        "This removes the record from this device. You can undo immediately afterwards.",
      label: "Delete",
      action: () =>
        void save(
          { ...s, [key]: s[key].filter((x) => x.id !== id) },
          `${entity[0].toUpperCase() + entity.slice(1)} deleted.`,
        ),
    });
  }
  async function importFile(file: File | undefined, backup = false) {
    if (!file || !s) return;
    try {
      if (file.size > 20e6) throw new Error("Choose a file under 20 MB.");
      const text = await file.text();
      if (backup) {
        const restored = validateState(JSON.parse(text));
        setConfirm({
          title: "Restore this backup?",
          description: `Replaces this device’s data with ${restored.transactions.length} transactions and ${restored.accounts.length} wallets. Export your current backup first if you need to keep it.`,
          label: "Restore backup",
          action: () => void save(restored, "Backup restored."),
        });
      } else {
        const transactions = parseCSV(text, s);
        setImportPreview({ transactions, filename: file.name });
      }
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
      if (backupRef.current) backupRef.current.value = "";
    }
  }
  async function exportFile(type: "csv" | "backup" | "template") {
    if (!s) return;
    try {
      if (type === "backup")
        await download(
          `gareeb-backup-${day()}.json`,
          JSON.stringify(s, null, 2),
        );
      else
        await download(
          type === "template"
            ? "gareeb-template.csv"
            : `gareeb-transactions-${day()}.csv`,
          exportCSV(
            type === "template"
              ? [
                  {
                    id: "template",
                    date: day(),
                    title: "Example coffee",
                    kind: "expense",
                    amount: 15000,
                    category: "food",
                    account: s.accounts[0].id,
                    note: "Delete this example row before importing",
                    tags: "",
                    reviewed: true,
                  },
                ]
              : s.transactions,
          ),
          "text/csv",
        );
      setNotice("Export ready. Keep your backup somewhere safe.");
    } catch (e) {
      setNotice("Export was not completed: " + (e as Error).message);
    }
  }
  if (!loaded)
    return (
      <div className="loading">
        <Logo />
        <span>Making room for clarity…</span>
      </div>
    );
  if (bootError)
    return (
      <div className="welcome">
        <Logo />
        <h1>Your data comes first.</h1>
        <p>{bootError}</p>
        <button
          className="primary"
          onClick={() =>
            void Preferences.get({ key: "gareeb.v1" }).then(({ value }) =>
              download("gareeb-recovery.json", value || ""),
            )
          }
        >
          Export original data
        </button>
        <button
          className="secondary"
          onClick={() => {
            setBootError("");
            setS(null);
          }}
        >
          Continue to setup
        </button>
      </div>
    );
  if (!s)
    return (
      <div className="welcome-wrap">
        <div className="welcome">
          <Logo />
          <div className="welcome-art">
            <span className="orbit orbit-one" />
            <span className="orbit orbit-two" />
            <span className="leaf-circle">
              <Icon name="Sprout" size={78} />
            </span>
            <span className="floating-coin coin-one">₹</span>
            <span className="floating-coin coin-two">✦</span>
            <span className="art-caption">
              <Icon name="TrendingUp" size={16} /> little steps. big
              possibilities.
            </span>
          </div>
          <span className="eyebrow">LESS MONEY STRESS. MORE LIFE.</span>
          <h1>
            A little mindful.
            <br />A lot more <em>free.</em>
          </h1>
          <p>
            Meet your money’s happy place. Spend with intention, make room for
            dreams, and enjoy the everyday.
          </p>
          <button
            className="primary wide"
            onClick={() => setEditor({ type: "onboarding" })}
          >
            Make yourself at home <Icon name="ArrowRight" />
          </button>
          <button
            className="text-button"
            onClick={() =>
              void save(demoState(), "You’re exploring sample data.", false)
            }
          >
            Take a look around with demo data{" "}
            <Icon name="ArrowUpRight" size={16} />
          </button>
          <div className="privacy-note">
            <Icon name="ShieldCheck" size={16} /> On your device. On your terms.
            No signup.
          </div>
        </div>
        {editor && (
          <Modal title="Hello, fresh start." onClose={close}>
            <EditorForm
              editor={editor}
              s={emptyState()}
              onSave={(next, message) => void save(next, message, false)}
            />
          </Modal>
        )}
        {notice && (
          <div className="toast" role="alert">
            {notice}
          </div>
        )}
      </div>
    );
  const ts = inMonth(s, selected);
  const sums = totals(ts);
  const prev = totals(inMonth(s, shiftMonth(selected, -1)));
  const funds = available(s);
  const due = s.bills
    .filter((b) => b.active)
    .sort((a, b) => a.date.localeCompare(b.date));
  const budgets = s.budgets.map((b) => ({
    ...b,
    spent: categorySpend(ts, b.category),
  }));
  const budgetTotal = budgets.reduce((n, b) => n + b.limit, 0);
  const budgetSpent = budgets.reduce((n, b) => n + b.spent, 0);
  const sorted = [...ts].sort((a, b) => b.date.localeCompare(a.date));
  const alerts = [
    ...due
      .filter(
        (b) =>
          b.date <=
          day(
            new Date(
              new Date().getFullYear(),
              new Date().getMonth(),
              new Date().getDate() + 7,
            ),
          ),
      )
      .map(
        (b) =>
          `${b.name}: ${cash(b.amount)} ${b.date < day() ? "overdue" : "due"} ${new Date(b.date + "T12:00:00").toLocaleDateString("en", { day: "numeric", month: "short" })}`,
      ),
    ...s.budgets
      .filter(
        (b) => categorySpend(inMonth(s, month()), b.category) >= b.limit * 0.8,
      )
      .map(
        (b) =>
          `${cat(b.category).name} is at ${Math.round((categorySpend(inMonth(s, month()), b.category) / b.limit) * 100)}% of its budget.`,
      ),
  ];
  const monthTitle = new Date(selected + "-01T12:00:00").toLocaleDateString(
    "en",
    { month: "long", year: "numeric" },
  );
  const monthPicker = (
    <div className="month-picker">
      <button
        aria-label="Previous month"
        onClick={() => setSelected(shiftMonth(selected, -1))}
      >
        <Icon name="ChevronLeft" size={16} />
      </button>
      <span>{monthTitle}</span>
      <button
        aria-label="Next month"
        disabled={selected >= month()}
        onClick={() => setSelected(shiftMonth(selected, 1))}
      >
        <Icon name="ChevronRight" size={16} />
      </button>
    </div>
  );
  const newButton = (label: string, type: Editor["type"]) => (
    <button className="text-button" onClick={() => add(type)}>
      <Icon name="Plus" size={16} />
      {label}
    </button>
  );
  const transactions = (list: Transaction[]) =>
    list.length ? (
      <div className="transactions">
        {list.map((t) => (
          <button
            key={t.id}
            className="transaction"
            onClick={() => setEditor({ type: "transaction", item: t })}
          >
            <span
              className="category-icon"
              style={{
                background:
                  t.kind === "income" ? "var(--mint)" : cat(t.category).tint,
                color:
                  t.kind === "income" ? "var(--green)" : cat(t.category).color,
              }}
            >
              <Icon
                name={
                  t.kind === "income"
                    ? "ArrowDownLeft"
                    : t.kind === "transfer"
                      ? "ArrowLeftRight"
                      : cat(t.category).icon
                }
              />
            </span>
            <span className="transaction-label">
              <strong>{t.title}</strong>
              <small>
                {t.kind === "transfer"
                  ? "Transfer"
                  : t.kind === "income"
                    ? "Income"
                    : cat(t.category).name}
                <span>·</span>
                {s.accounts.find((a) => a.id === t.account)?.name}
              </small>
            </span>
            <span className="transaction-value">
              <strong className={t.kind === "income" ? "positive" : ""}>
                {t.kind === "income" ? "+" : t.kind === "expense" ? "−" : ""}
                {cash(t.amount)}
              </strong>
              <small>
                {new Date(t.date + "T12:00:00").toLocaleDateString("en", {
                  day: "numeric",
                  month: "short",
                })}
                {!t.reviewed && (
                  <i className="unreviewed" title="Needs review" />
                )}
              </small>
            </span>
            <Icon name="ChevronRight" size={15} className="row-chevron" />
          </button>
        ))}
      </div>
    ) : (
      <Empty
        title="A clean slate"
        description="Add your first transaction and let your money story take shape."
        action={
          <button className="secondary" onClick={() => add()}>
            Add transaction
          </button>
        }
      />
    );
  return (
    <div
      className="app-shell"
      aria-busy={saving}
      onClickCapture={(e) => {
        const button = (e.target as Element).closest<HTMLButtonElement>(
          "button",
        );
        if (
          button &&
          !button.disabled &&
          (button.type !== "submit" || !button.form)
        )
          void feedback();
      }}
      onChangeCapture={(e) => {
        if (
          (e.target as HTMLInputElement).type === "checkbox" ||
          (e.target as Element).tagName === "SELECT"
        )
          void feedback();
      }}
    >
      <aside className="sidebar">
        <Logo />
        <span className="sidebar-caption">MAKE ROOM FOR MORE.</span>
        <nav aria-label="Main navigation">
          {nav.map(([id, icon, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => go(id)}
            >
              <Icon name={icon} />
              {label}
              {id === "home" && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Icon name="Sprout" size={30} />
            <h3>
              Small steps.
              <br />
              Brighter tomorrows.
            </h3>
            <p>A little attention goes a long way.</p>
          </div>
          <button
            className={`settings-nav ${tab === "settings" ? "active" : ""}`}
            onClick={() => go("settings")}
          >
            <Icon name="Settings" />
            Settings & data
          </button>
          <div className="local-status">
            <i />
            Stored on this device
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="mobile-logo">
            <Logo />
          </div>
          <div className="breadcrumb">
            Your space <Icon name="ChevronRight" size={13} />
            <span>
              {tab === "settings"
                ? "Settings"
                : nav.find((n) => n[0] === tab)?.[2]}
            </span>
          </div>
          <div className="top-actions">
            <span className="today-label">
              {new Date().toLocaleDateString("en", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            <button
              className="icon-button"
              onClick={() => setHide(!hide)}
              aria-label={hide ? "Show balances" : "Hide balances"}
            >
              <Icon name={hide ? "EyeOff" : "Eye"} />
            </button>
            <button
              className="icon-button notification-button"
              onClick={() => setShowAlerts(true)}
              aria-label="Notifications"
            >
              <Icon name="Bell" />
              {alerts.length > 0 && <i />}
            </button>
            <button
              className="avatar"
              onClick={() => go("settings")}
              aria-label="Open settings"
            >
              {s.settings.name.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        <main className="content" key={tab}>
          {s.demo && (
            <div className="demo-banner">
              <span>
                <Icon name="Sparkles" size={15} />
                You’re exploring demo data.
              </span>
              <button
                onClick={() =>
                  setConfirm({
                    title: "Make it yours?",
                    description:
                      "Clears the sample data and opens a fresh setup for your own finances.",
                    label: "Start fresh",
                    action: () => {
                      setConfirm(null);
                      setEditor({ type: "onboarding" });
                    },
                  })
                }
              >
                Start fresh <Icon name="ArrowRight" size={14} />
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {tab === "home"
                  ? "YOUR EVERYDAY, A LITTLE LIGHTER"
                  : tab === "activity"
                    ? "EVERY LITTLE THING, IN ONE PLACE"
                    : tab === "insights"
                      ? "THE STORY BEHIND THE NUMBERS"
                      : tab === "plan"
                        ? "GOOD THINGS TAKE A LITTLE PLANNING"
                        : tab === "wallets"
                          ? "A HOME FOR EVERY RUPEE"
                          : "MAKE YOURSELF AT HOME"}
              </span>
              <h1>
                {tab === "home" ? (
                  <>
                    Hey {s.settings.name}
                    <span className="greeting-spark">✳</span>
                  </>
                ) : tab === "activity" ? (
                  "Your money diary."
                ) : tab === "insights" ? (
                  "Find your money rhythm."
                ) : tab === "plan" ? (
                  "Make room for tomorrow."
                ) : tab === "wallets" ? (
                  "All your pockets."
                ) : (
                  "Just the way you like it."
                )}
              </h1>
              <p>
                {tab === "home"
                  ? "A little clarity for your money. A little space for you."
                  : tab === "activity"
                    ? "The big purchases. The little coffees. It all adds up."
                    : tab === "insights"
                      ? "Less guesswork. More of the bigger picture."
                      : tab === "plan"
                        ? "Thoughtful budgets, tiny milestones, and big dreams."
                        : tab === "wallets"
                          ? "Your accounts, together in one calm corner."
                          : "Your preferences, your data, your peace of mind."}
              </p>
            </div>
            <div className="heading-actions">
              {["home", "activity", "insights"].includes(tab) && monthPicker}
              {tab === "home" || tab === "activity" ? (
                <button className="primary desktop-add" onClick={() => add()}>
                  <Icon name="Plus" size={18} />
                  Add transaction
                </button>
              ) : null}
            </div>
          </div>
          {tab === "home" && (
            <>
              <div className="overview-grid">
                <section className="balance-card">
                  <div className="balance-top">
                    <span>
                      <i />
                      THE BIG PICTURE
                    </span>
                    <Icon name="Wallet" size={22} />
                  </div>
                  <p>
                    Total balance <span className="asof">· today</span>
                  </p>
                  <h2
                    key={String(funds.total) + hide}
                    className="balance-amount"
                  >
                    {cash(funds.total)}
                  </h2>
                  <div className="balance-bottom">
                    <div>
                      <span>After bills & reserve</span>
                      <strong>
                        {cash(funds.spendable)}
                        <Icon name="ArrowUpRight" size={17} />
                      </strong>
                    </div>
                    <button
                      aria-label="View wallets"
                      onClick={() => go("wallets")}
                    >
                      <Icon name="ArrowRight" />
                    </button>
                  </div>
                  <div className="balance-art" />
                </section>
                <div className="stat-card">
                  <span className="stat-icon income">
                    <Icon name="ArrowDownLeft" />
                  </span>
                  <span>Money in</span>
                  <strong>{cash(sums.income)}</strong>
                  <small>
                    {sums.income
                      ? "A little fuel for your plans"
                      : "Your next chapter starts here"}
                  </small>
                  <IncomeSpark s={s} selected={selected} />
                </div>
                <div className="stat-card">
                  <span className="stat-icon expense">
                    <Icon name="ArrowUpRight" />
                  </span>
                  <span>Money out</span>
                  <strong>{cash(sums.expense)}</strong>
                  <small
                    className={
                      prev.expense && sums.expense < prev.expense
                        ? "positive"
                        : ""
                    }
                  >
                    {prev.expense
                      ? `${Math.round((Math.abs(sums.expense - prev.expense) / prev.expense) * 100)}% ${sums.expense <= prev.expense ? "less" : "more"} than last month`
                      : "Your spending this month"}
                  </small>
                  <span className="stat-footnote">
                    {selected === month() ? "Month so far" : "Full month"}
                    {selected === month() && prev.expense
                      ? " vs previous full month"
                      : ""}
                  </span>
                </div>
              </div>
              <QuickEntries
                s={s}
                cash={cash}
                onAdd={() => add()}
                onUse={(t) =>
                  setEditor({
                    type: "transaction",
                    draft: {
                      ...t,
                      id: crypto.randomUUID(),
                      date: day(),
                      receipt: undefined,
                    },
                  })
                }
                onRemove={(id) =>
                  void save(
                    {
                      ...s,
                      shortcuts: (s.shortcuts || []).filter((t) => t.id !== id),
                    },
                    "Shortcut removed.",
                  )
                }
              />
              <div className="insight-strip">
                <span className="insight-icon">
                  <Icon name="Sparkles" size={21} />
                </span>
                <div>
                  <strong>
                    {sums.income > sums.expense
                      ? "A little breathing room."
                      : "A moment to check in."}
                  </strong>
                  <span>
                    {sums.income ? (
                      <>
                        You’ve kept{" "}
                        <b>{Math.round((sums.net / sums.income) * 100)}%</b> of
                        this month’s income after recorded expenses.
                      </>
                    ) : (
                      "Track income and expenses to see your monthly savings rate."
                    )}
                  </span>
                </div>
                <button
                  onClick={() => go("insights")}
                  aria-label="Explore insights"
                >
                  <Icon name="ArrowUpRight" />
                </button>
              </div>
              <div className="dashboard-columns">
                <Section
                  title="Your money in motion"
                  sub="The past six months, at a glance."
                  action={<span className="pill">Cash flow</span>}
                >
                  <Trend s={s} selected={selected} />
                </Section>
                <Section
                  title="Where it all goes"
                  sub={monthTitle}
                  action={
                    <button
                      className="icon-button"
                      onClick={() => go("insights")}
                      aria-label="See spending details"
                    >
                      <Icon name="ArrowUpRight" size={18} />
                    </button>
                  }
                >
                  <Donut
                    ts={ts}
                    currency={s.settings.currency}
                    hideAmounts={hide}
                  />
                </Section>
              </div>
              <div className="dashboard-columns lower">
                <Section
                  title="The latest little things"
                  sub="Your recent transactions."
                  action={
                    <button
                      className="text-button"
                      onClick={() => go("activity")}
                    >
                      View all <Icon name="ArrowRight" size={14} />
                    </button>
                  }
                >
                  {transactions(sorted.slice(0, 5))}
                </Section>
                <Section
                  title="Dreams in progress"
                  sub="A little closer, every day."
                  action={newButton("New goal", "goal")}
                >
                  {s.goals.slice(0, 2).map((g) => (
                    <button
                      className="mini-goal"
                      key={g.id}
                      onClick={() => {
                        setPlanTab("Goals");
                        go("plan");
                      }}
                    >
                      <div className="mini-goal-header">
                        <span className="goal-emoji">{g.emoji}</span>
                        <div>
                          <strong>{g.name}</strong>
                          <small>
                            {cash(g.saved)} <span>of {cash(g.target)}</span>
                          </small>
                        </div>
                        <span className="goal-percent">
                          {Math.round((g.saved / g.target) * 100)}%
                        </span>
                      </div>
                      <Progress value={(g.saved / g.target) * 100} />
                    </button>
                  ))}
                  {!s.goals.length && (
                    <Empty
                      title="What’s your next little dream?"
                      description="Start a savings goal for something that matters."
                    />
                  )}
                  <div className="goal-note">
                    <Icon name="Leaf" size={17} />
                    <span>Progress, at your own pace.</span>
                  </div>
                </Section>
              </div>
              <div className="dashboard-columns lower">
                <Section
                  title="Your spending boundaries"
                  sub="A little structure. A lot of freedom."
                  action={
                    <button
                      className="text-button"
                      onClick={() => {
                        setPlanTab("Budgets");
                        go("plan");
                      }}
                    >
                      All budgets <Icon name="ArrowRight" size={14} />
                    </button>
                  }
                >
                  {budgets.slice(0, 3).map((b) => (
                    <div className="mini-budget" key={b.id}>
                      <div>
                        <span>
                          <i
                            className="dot"
                            style={{ background: cat(b.category).color }}
                          />
                          {cat(b.category).name}
                        </span>
                        <span>
                          <b>{cash(b.spent)}</b> / {cash(b.limit)}
                        </span>
                      </div>
                      <Progress
                        value={(b.spent / b.limit) * 100}
                        color={
                          b.spent > b.limit
                            ? "var(--red)"
                            : cat(b.category).color
                        }
                      />
                    </div>
                  ))}
                  {!budgets.length && (
                    <Empty
                      title="Give your money a plan"
                      description="Choose a category and set a comfortable monthly limit."
                      action={newButton("Create budget", "budget")}
                    />
                  )}
                </Section>
                <Section
                  title="Coming up"
                  sub="One less thing on your mind."
                  action={
                    <button
                      className="text-button"
                      onClick={() => {
                        setPlanTab("Bills");
                        go("plan");
                      }}
                    >
                      All bills <Icon name="ArrowRight" size={14} />
                    </button>
                  }
                >
                  {due.slice(0, 3).map((b) => (
                    <button
                      className="upcoming-row"
                      key={b.id}
                      onClick={() => setEditor({ type: "bill", item: b })}
                    >
                      <span className="date-tile">
                        <small>
                          {new Date(b.date + "T12:00:00").toLocaleDateString(
                            "en",
                            { month: "short" },
                          )}
                        </small>
                        <b>{Number(b.date.slice(8))}</b>
                      </span>
                      <span>
                        <strong>{b.name}</strong>
                        <small>
                          {b.cadence} ·{" "}
                          {b.date < day() ? "Overdue" : "Upcoming"}
                        </small>
                      </span>
                      <b>{cash(b.amount)}</b>
                    </button>
                  ))}
                  {!due.length && (
                    <Empty
                      title="Nothing on the calendar"
                      description="Add bills and subscriptions to keep renewals in view."
                      action={newButton("Add bill", "bill")}
                    />
                  )}
                </Section>
              </div>
            </>
          )}
          {tab === "activity" && (
            <>
              <div
                className="activity-view segmented"
                aria-label="Activity view"
              >
                {["list", "calendar"].map((view) => (
                  <button
                    key={view}
                    className={activityView === view ? "selected" : ""}
                    aria-pressed={activityView === view}
                    onClick={() => {
                      setActivityView(view);
                      setDateFilter("");
                    }}
                  >
                    <Icon
                      name={view === "list" ? "Menu" : "CalendarDays"}
                      size={17}
                    />
                    {view === "list" ? "Timeline" : "Calendar"}
                  </button>
                ))}
              </div>
              {activityView === "calendar" && (
                <SpendCalendar
                  s={s}
                  selected={selected}
                  selectedDay={dateFilter}
                  cash={cash}
                  onSelect={setDateFilter}
                />
              )}
              <div className="activity-stats">
                <span>
                  Income <b className="positive">+{cash(sums.income)}</b>
                </span>
                <span>
                  Expenses <b>−{cash(sums.expense)}</b>
                </span>
                <span>
                  Net flow <b>{cash(sums.net)}</b>
                </span>
              </div>
              <Section
                title={
                  dateFilter
                    ? `Transactions on ${new Date(dateFilter + "T12:00:00").toLocaleDateString("en", { day: "numeric", month: "short" })}`
                    : "Every transaction"
                }
                sub={`${ts.length} entries in ${monthTitle}`}
                action={
                  <button
                    className="text-button"
                    onClick={() => void exportFile("csv")}
                  >
                    <Icon name="Download" size={16} />
                    Export all
                  </button>
                }
              >
                <div className="filters">
                  <label className="search-box">
                    <Icon name="Search" size={18} />
                    <input
                      aria-label="Search transactions"
                      placeholder="Search merchants, notes, tags…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <select
                    aria-label="Transaction type"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    <option value="all">All types</option>
                    <option value="expense">Expenses</option>
                    <option value="income">Income</option>
                    <option value="transfer">Transfers</option>
                  </select>
                  <select
                    aria-label="Filter category"
                    value={catFilter}
                    onChange={(e) => setCatFilter(e.target.value)}
                  >
                    <option value="all">All categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter wallet"
                    value={accountFilter}
                    onChange={(e) => setAccountFilter(e.target.value)}
                  >
                    <option value="all">All wallets</option>
                    {s.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-footer">
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={reviewFilter}
                      onChange={(e) => setReviewFilter(e.target.checked)}
                    />
                    Needs review only
                  </label>
                  <button
                    className="text-button"
                    onClick={() =>
                      void save(
                        {
                          ...s,
                          transactions: s.transactions.map((t) =>
                            ts.some((x) => x.id === t.id)
                              ? { ...t, reviewed: true }
                              : t,
                          ),
                        },
                        "This month is reviewed.",
                      )
                    }
                  >
                    <Icon name="CheckCheck" size={16} />
                    Review month
                  </button>
                </div>
                {transactions(
                  sorted.filter(
                    (t) =>
                      (!dateFilter || t.date === dateFilter) &&
                      (typeFilter === "all" || t.kind === typeFilter) &&
                      (catFilter === "all" || t.category === catFilter) &&
                      (accountFilter === "all" ||
                        t.account === accountFilter ||
                        t.toAccount === accountFilter) &&
                      (!reviewFilter || !t.reviewed) &&
                      `${t.title} ${t.note} ${t.tags}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  ),
                )}
              </Section>
              <p className="quiet-note">
                Transfers move money between wallets and are excluded from
                income and expense totals.
              </p>
            </>
          )}
          {tab === "insights" && (
            <>
              <WeekReview s={s} cash={cash} />
              <div className="metric-grid">
                <div className="mini-metric">
                  <span>Saved this month</span>
                  <strong>{cash(sums.net)}</strong>
                  <small>Income minus expenses</small>
                </div>
                <div className="mini-metric">
                  <span>Daily spending average</span>
                  <strong>
                    {cash(
                      Math.round(
                        sums.expense /
                          (selected === month()
                            ? new Date().getDate()
                            : new Date(
                                Number(selected.slice(0, 4)),
                                Number(selected.slice(5)),
                                0,
                              ).getDate()),
                      ),
                    )}
                  </strong>
                  <small>
                    {selected === month()
                      ? "Across elapsed days"
                      : "Across the full month"}
                  </small>
                </div>
                <div className="mini-metric">
                  <span>Largest expense</span>
                  <strong>
                    {cash(
                      Math.max(
                        0,
                        ...ts
                          .filter((t) => t.kind === "expense")
                          .map((t) => t.amount),
                      ),
                    )}
                  </strong>
                  <small>
                    {[...ts]
                      .filter((t) => t.kind === "expense")
                      .sort((a, b) => b.amount - a.amount)[0]?.title ||
                      "No expenses yet"}
                  </small>
                </div>
              </div>
              <div className="dashboard-columns">
                <Section
                  title="The bigger picture"
                  sub="Income and expenses over six months"
                >
                  <Trend s={s} selected={selected} />
                </Section>
                <Section
                  title="Your spending mix"
                  sub="Every category has a story"
                >
                  <Donut
                    ts={ts}
                    currency={s.settings.currency}
                    large
                    hideAmounts={hide}
                  />
                </Section>
              </div>
              <Section
                title="Your daily rhythm"
                sub="Small purchases become visible patterns"
              >
                <Daily
                  ts={ts}
                  selected={selected}
                  currency={s.settings.currency}
                />
              </Section>
              <div className="dashboard-columns">
                <Section
                  title="Category deep dive"
                  sub="Tap a category to explore its transactions"
                >
                  {categories
                    .map((c) => ({ c, total: categorySpend(ts, c.id) }))
                    .filter((x) => x.total)
                    .sort((a, b) => b.total - a.total)
                    .map(({ c, total }) => (
                      <button
                        key={c.id}
                        className="category-detail"
                        onClick={() => {
                          setCatFilter(c.id);
                          setTypeFilter("expense");
                          setSearch("");
                          setAccountFilter("all");
                          setReviewFilter(false);
                          go("activity");
                        }}
                      >
                        <span
                          className="category-icon"
                          style={{ color: c.color, background: c.tint }}
                        >
                          <Icon name={c.icon} />
                        </span>
                        <span>
                          <b>{c.name}</b>
                          <Progress
                            value={(total / sums.expense) * 100}
                            color={c.color}
                          />
                        </span>
                        <strong>{cash(total)}</strong>
                        <Icon name="ChevronRight" size={15} />
                      </button>
                    ))}
                  {!sums.expense && (
                    <Empty
                      title="Patterns are on their way"
                      description="Your recorded expenses will appear here."
                    />
                  )}
                </Section>
                <Section
                  title="A little perspective"
                  sub="Simple observations from your records"
                >
                  <div className="insight-note">
                    <Icon name="Leaf" />
                    <div>
                      <h3>
                        {sums.income
                          ? `${Math.round((sums.net / sums.income) * 100)}% of income retained`
                          : "Your savings rate"}
                      </h3>
                      <p>
                        {sums.income
                          ? "This is income left after recorded expenses. Transfers between your wallets don’t change it."
                          : "Record an income transaction to see how much you’re keeping."}
                      </p>
                    </div>
                  </div>
                  <div className="insight-note">
                    <Icon name="Repeat2" />
                    <div>
                      <h3>
                        {cash(
                          Math.round(
                            s.bills
                              .filter((b) => b.active)
                              .reduce(
                                (n, b) =>
                                  n +
                                  b.amount *
                                    (b.cadence === "yearly"
                                      ? 1 / 12
                                      : b.cadence === "weekly"
                                        ? 52 / 12
                                        : 1),
                                0,
                              ),
                          ),
                        )}{" "}
                        in monthly commitments
                      </h3>
                      <p>
                        Your active bills, converted to a monthly estimate.
                        Yearly bills ÷ 12; weekly bills × 52 ÷ 12.
                      </p>
                    </div>
                  </div>
                  <div className="insight-note">
                    <Icon name="CircleHelp" />
                    <div>
                      <h3>Room to spend, explained</h3>
                      <p>
                        Today’s combined wallet balance minus active bills due
                        through month-end and your reserve. It uses one next
                        payment per bill; it isn’t a full cash-flow forecast.
                      </p>
                    </div>
                  </div>
                </Section>
              </div>
            </>
          )}
          {tab === "plan" && (
            <>
              <div className="plan-toolbar">
                <div className="segmented plan-tabs">
                  {["Budgets", "Goals", "Bills", "Together"].map((t) => (
                    <button
                      key={t}
                      className={planTab === t ? "selected" : ""}
                      onClick={() => setPlanTab(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {planTab === "Budgets" && monthPicker}
              </div>
              {planTab === "Budgets" && (
                <>
                  <div className="plan-summary">
                    <span className="round-icon">
                      <Icon name="Wallet" size={26} />
                    </span>
                    <div>
                      <span>YOUR MONTHLY BOUNDARIES</span>
                      <h2>
                        {cash(Math.max(0, budgetTotal - budgetSpent))}{" "}
                        <small>left in budgeted categories</small>
                      </h2>
                      <p>
                        {cash(budgetSpent)} spent of {cash(budgetTotal)}{" "}
                        allocated
                      </p>
                    </div>
                    {newButton("New budget", "budget")}
                  </div>
                  <div className="card-grid">
                    {budgets.map((b) => (
                      <section className="budget-card" key={b.id}>
                        <div className="card-top">
                          <span
                            className="category-icon"
                            style={{
                              color: cat(b.category).color,
                              background: cat(b.category).tint,
                            }}
                          >
                            <Icon name={cat(b.category).icon} />
                          </span>
                          <button
                            className="icon-button"
                            aria-label={`Edit ${cat(b.category).name} budget`}
                            onClick={() =>
                              setEditor({ type: "budget", item: b })
                            }
                          >
                            <Icon name="Pencil" size={17} />
                          </button>
                        </div>
                        <h3>{cat(b.category).name}</h3>
                        <div className="budget-amount">
                          <strong>{cash(b.spent)}</strong>
                          <span>of {cash(b.limit)}</span>
                        </div>
                        <Progress
                          value={(b.spent / b.limit) * 100}
                          color={
                            b.spent > b.limit
                              ? "var(--red)"
                              : cat(b.category).color
                          }
                        />
                        <div
                          className={`budget-status ${b.spent > b.limit ? "negative" : ""}`}
                        >
                          <span>
                            {cash(Math.abs(b.limit - b.spent))}{" "}
                            {b.spent > b.limit
                              ? "over budget"
                              : "left to spend"}
                          </span>
                          <b>{Math.round((b.spent / b.limit) * 100)}%</b>
                        </div>
                      </section>
                    ))}
                    <button className="add-card" onClick={() => add("budget")}>
                      <span>
                        <Icon name="Plus" />
                      </span>
                      <strong>A little more intention</strong>
                      <small>Add a category budget</small>
                    </button>
                  </div>
                  <div className="insight-strip">
                    <span className="insight-icon">
                      <Icon name="CircleHelp" />
                    </span>
                    <div>
                      <strong>Your plan, at a glance</strong>
                      <span>
                        {cash(budgetTotal)} allocated from{" "}
                        {cash(s.settings.monthlyIncome)} planned income.{" "}
                        {cash(s.settings.monthlyIncome - budgetTotal)}{" "}
                        unallocated. Limits repeat monthly.
                      </span>
                    </div>
                  </div>
                </>
              )}
              {planTab === "Goals" && (
                <>
                  <div className="section-inline">
                    <h2>Your someday starts today.</h2>
                    {newButton("New goal", "goal")}
                  </div>
                  <div className="card-grid goal-grid">
                    {s.goals.map((g) => (
                      <section className="goal-card" key={g.id}>
                        <div className="goal-art">
                          <span>{g.emoji}</span>
                          <i />
                          <i />
                          <button
                            className="icon-button"
                            aria-label={`Edit ${g.name}`}
                            onClick={() => setEditor({ type: "goal", item: g })}
                          >
                            <Icon name="Pencil" size={17} />
                          </button>
                        </div>
                        <div className="goal-body">
                          <span className="eyebrow">
                            {g.saved >= g.target
                              ? "YOU MADE IT ✦"
                              : "ONE LITTLE STEP AT A TIME"}
                          </span>
                          <h3>{g.name}</h3>
                          <div className="goal-values">
                            <strong>{cash(g.saved)}</strong>
                            <span>of {cash(g.target)}</span>
                          </div>
                          <Progress value={(g.saved / g.target) * 100} />
                          <div className="goal-meta">
                            <span>
                              {Math.round((g.saved / g.target) * 100)}% there
                            </span>
                            <span>
                              By{" "}
                              {new Date(
                                g.date + "T12:00:00",
                              ).toLocaleDateString("en", {
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                          <button
                            className="secondary wide"
                            onClick={() =>
                              setEditor({ type: "contribution", item: g })
                            }
                          >
                            <Icon name="Plus" size={17} />
                            Add savings
                          </button>
                        </div>
                      </section>
                    ))}
                    <button className="add-card" onClick={() => add("goal")}>
                      <span>
                        <Icon name="Sprout" size={30} />
                      </span>
                      <strong>What are you dreaming of?</strong>
                      <small>Give your next goal a home</small>
                    </button>
                  </div>
                  <p className="quiet-note">
                    Savings goals track progress separately from wallets.
                    Contributions don’t move money or change balances.
                  </p>
                </>
              )}
              {planTab === "Bills" && (
                <Section
                  title="No more “oh, that’s today.”"
                  sub="Your bill and subscription calendar"
                  action={newButton("Add bill", "bill")}
                >
                  <div className="bill-total">
                    <span>Monthly equivalent</span>
                    <strong>
                      {cash(
                        Math.round(
                          s.bills
                            .filter((b) => b.active)
                            .reduce(
                              (n, b) =>
                                n +
                                b.amount *
                                  (b.cadence === "yearly"
                                    ? 1 / 12
                                    : b.cadence === "weekly"
                                      ? 52 / 12
                                      : 1),
                              0,
                            ),
                        ),
                      )}
                    </strong>
                    <small>
                      Across {s.bills.filter((b) => b.active).length} active
                      recurring payments
                    </small>
                  </div>
                  <RecurringCosts s={s} cash={cash} />
                  {[...s.bills]
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((b) => (
                      <div
                        className={`bill-row ${!b.active ? "paused" : ""}`}
                        key={b.id}
                      >
                        <span
                          className="category-icon"
                          style={{
                            color: cat(b.category).color,
                            background: cat(b.category).tint,
                          }}
                        >
                          <Icon name={cat(b.category).icon} />
                        </span>
                        <div className="bill-info">
                          <strong>{b.name}</strong>
                          <small>
                            {b.cadence} ·{" "}
                            {b.active
                              ? (b.date < day() ? "Overdue · " : "Due ") +
                                new Date(
                                  b.date + "T12:00:00",
                                ).toLocaleDateString("en", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "Paused"}
                          </small>
                        </div>
                        <strong>{cash(b.amount)}</strong>
                        <div className="bill-actions">
                          <button
                            className="secondary small"
                            disabled={!b.active}
                            onClick={() =>
                              setConfirm({
                                title: `Mark ${b.name} paid?`,
                                description: `Records a ${cash(b.amount)} expense today and advances its due date by one ${b.cadence === "monthly" ? "month" : b.cadence === "weekly" ? "week" : "year"}.`,
                                label: "Record payment",
                                action: () =>
                                  void save(
                                    payBill(s, b.id),
                                    "Payment recorded. Next due date updated.",
                                  ),
                              })
                            }
                          >
                            Mark paid
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Edit ${b.name}`}
                            onClick={() => setEditor({ type: "bill", item: b })}
                          >
                            <Icon name="Pencil" size={16} />
                          </button>
                          <button
                            className="text-button"
                            onClick={() =>
                              void save(
                                {
                                  ...s,
                                  bills: s.bills.map((x) =>
                                    x.id === b.id
                                      ? { ...x, active: !x.active }
                                      : x,
                                  ),
                                },
                                b.active ? "Bill paused." : "Bill resumed.",
                              )
                            }
                          >
                            {b.active ? "Pause" : "Resume"}
                          </button>
                        </div>
                      </div>
                    ))}
                  {!s.bills.length && (
                    <Empty
                      title="A calmer calendar"
                      description="Keep rent, subscriptions, and recurring bills in view."
                    />
                  )}
                  <p className="quiet-note">
                    Reminders appear in the app. No automatic charges,
                    cancellations, or background notifications.
                  </p>
                </Section>
              )}
              {planTab === "Together" && (
                <Section
                  title="Keep the little things even."
                  sub="Your personal shared-expense notebook"
                  action={newButton("Add IOU", "split")}
                >
                  <div className="activity-stats">
                    <span>
                      Owed to you
                      <b className="positive">
                        {cash(
                          s.splits
                            .filter((x) => !x.settled && x.direction === "owed")
                            .reduce((n, x) => n + x.amount, 0),
                        )}
                      </b>
                    </span>
                    <span>
                      You owe
                      <b>
                        {cash(
                          s.splits
                            .filter((x) => !x.settled && x.direction === "owe")
                            .reduce((n, x) => n + x.amount, 0),
                        )}
                      </b>
                    </span>
                  </div>
                  {s.splits.map((x) => (
                    <div
                      className={`split-row ${x.settled ? "paused" : ""}`}
                      key={x.id}
                    >
                      <button
                        className="person-avatar"
                        onClick={() => setEditor({ type: "split", item: x })}
                        aria-label={`Edit ${x.name} IOU`}
                      >
                        {x.name.slice(0, 1)}
                      </button>
                      <div>
                        <strong>{x.name}</strong>
                        <small>
                          {x.title} ·{" "}
                          {x.settled
                            ? "Settled"
                            : x.direction === "owed"
                              ? "Owes you"
                              : "You owe"}
                        </small>
                      </div>
                      <b className={x.direction === "owed" ? "positive" : ""}>
                        {cash(x.amount)}
                      </b>
                      <button
                        className="secondary small"
                        onClick={() =>
                          void save(
                            {
                              ...s,
                              splits: s.splits.map((y) =>
                                y.id === x.id
                                  ? { ...y, settled: !y.settled }
                                  : y,
                              ),
                            },
                            x.settled
                              ? "IOU reopened."
                              : "Marked settled. Record the money movement separately if needed.",
                          )
                        }
                      >
                        {x.settled ? "Reopen" : "Settle"}
                      </button>
                    </div>
                  ))}
                  {!s.splits.length && (
                    <Empty
                      title="Good friends. Clear tabs."
                      description="Track what’s owed after shared meals, trips, and everything in between."
                    />
                  )}
                  <p className="quiet-note">
                    Local tracking only. Settling an IOU does not move money,
                    notify anyone, or create a transaction.
                  </p>
                </Section>
              )}
            </>
          )}
          {tab === "wallets" && (
            <>
              <div className="plan-summary">
                <span className="round-icon">
                  <Icon name="Wallet" size={28} />
                </span>
                <div>
                  <span>ALL WALLETS COMBINED</span>
                  <h2>{cash(funds.total)}</h2>
                  <p>Opening balances + recorded money movements</p>
                </div>
                {newButton("Add wallet", "account")}
              </div>
              <div className="card-grid">
                {balances(s).map((a) => (
                  <section
                    className="wallet-card"
                    style={{ "--wallet-color": a.color } as React.CSSProperties}
                    key={a.id}
                  >
                    <div className="wallet-card-top">
                      <Icon
                        name={
                          a.type === "Cash"
                            ? "Banknote"
                            : a.type === "Credit"
                              ? "CreditCard"
                              : a.type === "Savings"
                                ? "Sprout"
                                : "Wallet"
                        }
                        size={26}
                      />
                      <button
                        className="icon-button"
                        aria-label={`Edit ${a.name}`}
                        onClick={() => setEditor({ type: "account", item: a })}
                      >
                        <Icon name="Pencil" size={17} />
                      </button>
                    </div>
                    <span>{a.type} wallet</span>
                    <h3>{a.name}</h3>
                    <strong>{cash(a.balance)}</strong>
                    <button
                      className="wallet-bottom"
                      onClick={() => {
                        setAccountFilter(a.id);
                        setTypeFilter("all");
                        setCatFilter("all");
                        setSearch("");
                        setReviewFilter(false);
                        go("activity");
                      }}
                    >
                      View transactions <Icon name="ArrowUpRight" size={17} />
                    </button>
                  </section>
                ))}
                <button className="add-card" onClick={() => add("account")}>
                  <span>
                    <Icon name="Plus" />
                  </span>
                  <strong>Another pocket?</strong>
                  <small>Add a bank, cash or credit wallet</small>
                </button>
              </div>
              <div className="insight-strip">
                <span className="insight-icon">
                  <Icon name="ArrowLeftRight" />
                </span>
                <div>
                  <strong>Moving money between your pockets?</strong>
                  <span>
                    Use a transfer to keep your income and spending totals
                    accurate.
                  </span>
                </div>
                <button
                  className="secondary"
                  onClick={() =>
                    setEditor({ type: "transaction", item: undefined })
                  }
                >
                  Add entry
                </button>
              </div>
              <p className="quiet-note">
                Wallet balances are manually tracked in {s.settings.currency}.
                There is no live bank connection or exchange-rate conversion.
              </p>
            </>
          )}
          {tab === "settings" && (
            <div className="settings-grid">
              <Section
                title="A space that feels like you"
                sub="The everyday essentials"
              >
                <form
                  className="editor-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void save(
                      {
                        ...s,
                        settings: {
                          ...s.settings,
                          name: String(f.get("name")).trim() || "friend",
                          monthlyIncome: Math.round(
                            Number(f.get("income")) * 100,
                          ),
                          reserve: Math.round(Number(f.get("reserve")) * 100),
                        },
                      },
                      "Preferences saved.",
                    );
                  }}
                >
                  <Field label="Your name">
                    <input
                      name="name"
                      maxLength={60}
                      defaultValue={s.settings.name}
                      required
                    />
                  </Field>
                  <Field label="Monthly planned income">
                    <input
                      name="income"
                      type="number"
                      min="0"
                      max="10000000000"
                      step="0.01"
                      defaultValue={s.settings.monthlyIncome / 100}
                      required
                    />
                  </Field>
                  <Field
                    label="Protected reserve"
                    hint="This amount is held back when calculating room to spend. It doesn’t move money."
                  >
                    <input
                      name="reserve"
                      type="number"
                      min="0"
                      max="10000000000"
                      step="0.01"
                      defaultValue={s.settings.reserve / 100}
                      required
                    />
                  </Field>
                  <div className="preference-row">
                    <span>Currency</span>
                    <b>{s.settings.currency}</b>
                  </div>
                  <p className="form-help">
                    Currency is set during setup. A fresh start is required to
                    change it so recorded amounts aren’t silently relabelled.
                  </p>
                  <div className="preference-row">
                    <span>
                      <Icon
                        name={s.settings.theme === "dark" ? "Moon" : "Sun"}
                        size={18}
                      />{" "}
                      Appearance
                    </span>
                    <button
                      type="button"
                      className="secondary small"
                      onClick={() =>
                        void save(
                          {
                            ...s,
                            settings: {
                              ...s.settings,
                              theme:
                                s.settings.theme === "light" ? "dark" : "light",
                            },
                          },
                          "Appearance updated.",
                          false,
                        )
                      }
                    >
                      {s.settings.theme === "light"
                        ? "Switch to dark"
                        : "Switch to light"}
                    </button>
                  </div>
                  <ExperienceSettings
                    s={s}
                    onSave={(next, message) => void save(next, message, false)}
                    onNotice={setNotice}
                  />
                  <button className="primary" type="submit">
                    Save preferences
                  </button>
                </form>
              </Section>
              <div>
                <Section
                  title="Your data belongs to you"
                  sub="Take it with you, whenever you want"
                >
                  <div className="data-actions">
                    <button onClick={() => void exportFile("backup")}>
                      <Icon name="Download" />
                      <span>
                        <strong>Export full backup</strong>
                        <small>All wallets, entries, receipts, and plans</small>
                      </span>
                      <Icon name="ChevronRight" size={17} />
                    </button>
                    <button onClick={() => backupRef.current?.click()}>
                      <Icon name="Upload" />
                      <span>
                        <strong>Restore a backup</strong>
                        <small>Replace data from a Gareeb JSON file</small>
                      </span>
                      <Icon name="ChevronRight" size={17} />
                    </button>
                    <button onClick={() => void exportFile("csv")}>
                      <Icon name="Download" />
                      <span>
                        <strong>Export transactions</strong>
                        <small>Spreadsheet-friendly CSV</small>
                      </span>
                      <Icon name="ChevronRight" size={17} />
                    </button>
                    <button onClick={() => fileRef.current?.click()}>
                      <Icon name="Upload" />
                      <span>
                        <strong>Import transactions</strong>
                        <small>Preview a CSV · duplicates skipped</small>
                      </span>
                      <Icon name="ChevronRight" size={17} />
                    </button>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => void exportFile("template")}
                  >
                    Download CSV template{" "}
                    <Icon name="ArrowDownLeft" size={15} />
                  </button>
                  <p className="form-help">
                    Use category IDs such as food and wallet IDs:{" "}
                    {s.accounts.map((a) => `${a.name} = ${a.id}`).join("; ")}.
                  </p>
                </Section>
                <Section
                  title="Little shortcuts"
                  sub="Merchant categorisation rules"
                  action={newButton("Add rule", "rule")}
                >
                  {s.rules.map((r) => (
                    <button
                      className="rule-row"
                      key={r.id}
                      onClick={() => setEditor({ type: "rule", item: r })}
                    >
                      <span>“{r.match}”</span>
                      <Icon name="ArrowRight" size={16} />
                      <b>{cat(r.category).name}</b>
                      <Icon name="Pencil" size={15} />
                    </button>
                  ))}
                  {!s.rules.length && (
                    <p className="muted">
                      Teach Gareeb where your regular purchases belong.
                    </p>
                  )}
                </Section>
              </div>
              <Section
                title="Private by design"
                sub="A quieter kind of money app"
              >
                <div className="privacy-box">
                  <Icon name="ShieldCheck" size={36} />
                  <p>
                    Your financial records stay on this device. Gareeb has no
                    analytics trackers, ads, bank connection, or account signup.
                    Use your device lock to protect access.
                  </p>
                  <p>
                    Data is stored in app preferences on Android and browser
                    storage on the web. Export regular backups: uninstalling the
                    app or clearing storage can remove it. Backups are
                    unencrypted, so keep them private.
                  </p>
                </div>
              </Section>
              <Section
                title="A fresh page"
                sub="For when you’re ready to begin again"
              >
                <p className="muted">
                  Export a backup before replacing your data.
                </p>
                <button
                  className="secondary"
                  onClick={() =>
                    setConfirm({
                      title: "Replace with a demo?",
                      description:
                        "This replaces your current records with sample data. Export a backup first to keep your records.",
                      label: "Load sample data",
                      action: () => void save(demoState(), "Demo loaded."),
                    })
                  }
                >
                  Explore sample data
                </button>
                <button
                  className="danger-button"
                  onClick={() =>
                    setConfirm({
                      title: "Start from a blank page?",
                      description:
                        "This clears this device’s data after you complete a new setup. Export a backup first.",
                      label: "Start fresh",
                      action: () => {
                        setConfirm(null);
                        setEditor({ type: "onboarding" });
                      },
                    })
                  }
                >
                  <Icon name="RotateCcw" size={17} />
                  Reset & start fresh
                </button>
              </Section>
            </div>
          )}
          <footer className="page-footer">
            <span>
              <Icon name="Sprout" size={15} /> A little mindful. A lot more
              free.
            </span>
            <span>Gareeb · v1.1</span>
          </footer>
        </main>
      </div>
      <button
        className="mobile-fab"
        aria-label="Add transaction"
        onClick={() => add()}
      >
        <Icon name="Plus" size={27} />
      </button>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {nav.map(([id, icon, label]) => (
          <button
            key={id}
            onClick={() => go(id)}
            className={tab === id ? "active" : ""}
          >
            <Icon name={icon} size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <input
        ref={fileRef}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => void importFile(e.target.files?.[0])}
      />
      <input
        ref={backupRef}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept=".json,application/json"
        onChange={(e) => void importFile(e.target.files?.[0], true)}
      />
      {editor && (
        <Modal
          title={
            editor.type === "onboarding"
              ? "Hello, fresh start."
              : editor.type === "contribution"
                ? "A little closer."
                : `${editor.item ? "Edit" : "New"} ${editor.type === "split" ? "shared expense" : editor.type === "account" ? "wallet" : editor.type}`
          }
          onClose={close}
        >
          {editor.type === "transaction" && editor.item && (
            <button
              className="secondary duplicate-button"
              onClick={() =>
                setEditor({
                  type: "transaction",
                  draft: {
                    ...editor.item!,
                    id: crypto.randomUUID(),
                    date: day(),
                    receipt: undefined,
                  },
                })
              }
            >
              <Icon name="Repeat2" size={16} />
              Duplicate for today
            </button>
          )}
          <EditorForm
            key={
              editor.type === "transaction"
                ? editor.item?.id || editor.draft?.id || "new"
                : editor.type
            }
            editor={editor}
            s={s}
            onSave={(next, message) => void save(next, message)}
            onDelete={deleteItem}
          />
        </Modal>
      )}
      {confirm && (
        <Modal title={confirm.title} onClose={close}>
          <p className="confirmation-copy">{confirm.description}</p>
          <div className="form-footer">
            <button className="secondary" onClick={close}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={saving}
              onClick={confirm.action}
            >
              {confirm.label || "Continue"}
            </button>
          </div>
        </Modal>
      )}
      {showAlerts && (
        <Modal title="A little heads-up." onClose={close}>
          {alerts.length ? (
            <div className="alerts">
              {alerts.map((a, i) => (
                <div key={i}>
                  <Icon name="Bell" size={20} />
                  <p>{a}</p>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="All quiet over here"
              description="Bills due within seven days and budgets at 80% or more appear here."
            />
          )}
          <button
            className="secondary wide"
            onClick={() => {
              close();
              setPlanTab("Bills");
              go("plan");
            }}
          >
            Open your plan <Icon name="ArrowRight" size={17} />
          </button>
        </Modal>
      )}
      {importPreview && (
        <Modal title="A quick look before importing." onClose={close}>
          <p className="confirmation-copy">
            {importPreview.transactions.length} new transactions from{" "}
            {importPreview.filename}. Exact duplicates were skipped. Nothing is
            saved yet.
          </p>
          <div className="import-list">
            {importPreview.transactions.slice(0, 10).map((t) => (
              <div key={t.id}>
                <span>
                  {t.date} · {t.title}
                </span>
                <b>{cash(t.amount)}</b>
              </div>
            ))}
          </div>
          <div className="form-footer">
            <button className="secondary" onClick={close}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={!importPreview.transactions.length || saving}
              onClick={() =>
                void save(
                  {
                    ...s,
                    transactions: [
                      ...importPreview.transactions,
                      ...s.transactions,
                    ],
                  },
                  `Imported ${importPreview.transactions.length} transactions.`,
                )
              }
            >
              Import transactions
            </button>
          </div>
        </Modal>
      )}
      {notice && (
        <div className="toast" role="status">
          <Icon name="CircleCheck" size={20} />
          <span>{notice}</span>
          {undo && (
            <button
              disabled={saving}
              onClick={() => void save(undo, "Change undone.", false)}
            >
              Undo
            </button>
          )}
          <button
            className="toast-close"
            onClick={() => {
              setNotice("");
              setUndo(null);
            }}
            aria-label="Dismiss notification"
          >
            <Icon name="X" size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
