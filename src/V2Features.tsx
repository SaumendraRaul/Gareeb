import { useState, type FormEvent } from "react";
import {
  allCategories,
  cat,
  categorySpend,
  day,
  cents,
  uid,
  type State,
  type Transaction,
  type Budget,
} from "./model";
import { budgetWindow, monthlyStory, parseQuickEntry } from "./v2";
import { categoryIcons, type CustomCategory } from "./v2-data";
import { Field, Icon, Modal, Progress } from "./ui";
type Save = (s: State, message: string) => Promise<boolean>;

export function QuickCapture({
  s,
  onDraft,
}: {
  s: State;
  onDraft: (t: Transaction) => void;
}) {
  const [text, setText] = useState(""),
    [error, setError] = useState("");
  function review(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      onDraft(parseQuickEntry(text, s));
      setText("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const recent = [
    ...new Map(
      [...s.transactions]
        .filter((t) => t.kind === "expense")
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((t) => [t.title.toLowerCase(), t]),
    ).values(),
  ].slice(0, 4);
  return (
    <section className="quick-capture" aria-label="Quick entry">
      <div className="v2-section-heading">
        <span>
          <Icon name="Sparkles" />A thought. A tap. Tracked.
        </span>
        <small>V2</small>
      </div>
      <form onSubmit={review}>
        <input
          aria-label="Describe an expense"
          value={text}
          maxLength={300}
          onChange={(e) => setText(e.target.value)}
          placeholder="180 lunch yesterday cash"
        />
        <button aria-label="Review quick entry" className="quick-submit">
          <Icon name="ArrowUpRight" />
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p>
        Reads simple amounts, dates and wallet names on your device. Always
        review before saving.
      </p>
      {recent.length > 0 && (
        <div className="recent-merchants">
          {recent.map((t) => (
            <button
              key={t.id}
              onClick={() =>
                onDraft({ ...t, id: uid(), date: day(), receipt: undefined })
              }
            >
              <Icon name={cat(t.category, s).icon} size={14} />
              {t.title}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
export function MoneyStory({
  s,
  selected,
  cash,
  onExplore,
}: {
  s: State;
  selected: string;
  cash: (n: number) => string;
  onExplore: (category: string) => void;
}) {
  const story = monthlyStory(s, selected),
    [expanded, setExpanded] = useState(false);
  return (
    <section className="money-story">
      <div className="v2-eyebrow">YOUR MONEY STORY · {selected}</div>
      <div className="v2-section-heading">
        <h2>Where did it go?</h2>
        <span className="story-spark">✦</span>
      </div>
      <p>
        {story.count
          ? `${story.count} recorded expenses. A little more perspective.`
          : "Your story begins with your first recorded expense."}
      </p>
      <div className="story-numbers">
        <span>
          Money in<strong>{cash(story.sum.income)}</strong>
        </span>
        <span>
          Money out<strong>{cash(story.sum.expense)}</strong>
        </span>
        <span>
          Net flow<strong>{cash(story.sum.net)}</strong>
        </span>
      </div>
      {story.hasPrevious ? (
        <p className="story-comparison">
          {cash(Math.abs(story.sum.expense - story.old.expense))}{" "}
          {story.sum.expense >= story.old.expense ? "more" : "less"} spent than{" "}
          {story.partial ? "the full previous month" : "the previous month"}.{" "}
          {story.partial ? "This month is still in progress." : ""}
        </p>
      ) : (
        <p className="form-help">
          A comparison will appear when you have records in the previous month.
        </p>
      )}
      <button className="text-button" onClick={() => setExpanded(!expanded)}>
        {expanded ? "Hide breakdown" : "Explore the changes"}
        <Icon name={expanded ? "ChevronUp" : "ArrowRight"} size={17} />
      </button>
      {expanded && (
        <div className="story-changes">
          {story.changes.map((c) => (
            <button key={c.id} onClick={() => onExplore(c.id)}>
              <span
                className="category-icon"
                style={{ background: c.tint, color: c.color }}
              >
                <Icon name={c.icon} />
              </span>
              <span>
                <b>{c.name}</b>
                <small>
                  {cash(c.current)} this month
                  {story.hasPrevious ? ` · ${cash(c.previous)} previously` : ""}
                </small>
              </span>
              <strong>
                {story.hasPrevious
                  ? `${c.delta >= 0 ? "+" : "−"}${cash(Math.abs(c.delta))}`
                  : cash(c.current)}
              </strong>
              <Icon name="ChevronRight" size={16} />
            </button>
          ))}
        </div>
      )}
      {s.settings.humour && story.count > 0 && (
        <p className="story-humour">Gareeb by name. Improving by habit.</p>
      )}
    </section>
  );
}
export function SmartBudgets({
  s,
  selected,
  cash,
  onEdit,
  onNew,
}: {
  s: State;
  selected: string;
  cash: (n: number) => string;
  onEdit: (b: Budget) => void;
  onNew: () => void;
}) {
  const [date, setDate] = useState(day());
  const list = s.budgets.map((b) => ({
    ...b,
    window: budgetWindow(
      s,
      b,
      b.period === "weekly"
        ? date
        : selected === day().slice(0, 7)
          ? day()
          : selected + "-01",
    ),
  }));
  return (
    <>
      <div className="v2-section-heading">
        <div>
          <h2>Room for what matters.</h2>
          <p className="form-help">
            Monthly budgets follow the month above. Weekly budgets use the date
            below.
          </p>
        </div>
        <button className="primary" onClick={onNew}>
          <Icon name="Plus" />
          New budget
        </button>
      </div>
      {s.budgets.some((b) => b.period === "weekly") && (
        <Field label="Week containing">
          <input
            type="date"
            value={date}
            min="2000-01-01"
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </Field>
      )}
      <div className="card-grid">
        {list.map((b) => {
          const w = b.window,
            c = cat(b.category, s);
          return (
            <section className="budget-card" key={b.id}>
              <div className="card-top">
                <span
                  className="category-icon"
                  style={{ color: c.color, background: c.tint }}
                >
                  <Icon name={c.icon} />
                </span>
                <button
                  className="icon-button"
                  aria-label={`Edit ${c.name} budget`}
                  onClick={() => onEdit(s.budgets.find((x) => x.id === b.id)!)}
                >
                  <Icon name="Pencil" size={17} />
                </button>
              </div>
              <div className="budget-period">
                {b.period === "weekly" ? "WEEKLY" : "MONTHLY"}{" "}
                {b.rollover ? "· ROLLOVER" : ""}
              </div>
              <h3>{c.name}</h3>
              <div className="budget-amount">
                <strong>{cash(w.spent)}</strong>
                <span>of {cash(w.limit)}</span>
              </div>
              <Progress
                value={w.limit ? (w.spent / w.limit) * 100 : 0}
                color={w.spent > w.limit ? "var(--red)" : c.color}
              />
              <div className="budget-status">
                <span>
                  {w.active
                    ? `${cash(Math.abs(w.limit - w.spent))} ${w.spent > w.limit ? "over budget" : "left to spend"}`
                    : "Budget has not started yet"}
                </span>
              </div>
              <p className="form-help">
                {w.start} → {w.end} (exclusive)
                {w.carry > 0
                  ? ` · Includes ${cash(w.carry)} carried forward`
                  : ""}
              </p>
            </section>
          );
        })}
        <button className="add-card" onClick={onNew}>
          <Icon name="Plus" />
          <strong>A little more intention</strong>
          <small>Add a category budget</small>
        </button>
      </div>
      <p className="quiet-note">
        Rollover carries unused money forward from your chosen start date.
        Overspending uses up that carry; a new period never starts below its
        base limit. Editing a limit recalculates its history.
      </p>
    </>
  );
}
export function CategorySettings({ s, onSave }: { s: State; onSave: Save }) {
  const [editor, setEditor] = useState<CustomCategory | null | undefined>(
      undefined,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const f = new FormData(e.currentTarget),
        name = String(f.get("name")).trim();
      if (
        allCategories(s).some(
          (c) =>
            c.id !== editor?.id && c.name.toLowerCase() === name.toLowerCase(),
        )
      )
        throw Error("Choose a unique category name.");
      const c: CustomCategory = {
        id: editor?.id || "custom-" + uid(),
        name,
        icon: String(f.get("icon")),
        color: String(f.get("color")),
        tint: "#edf2e8",
        ...(f.get("parent") ? { parent: String(f.get("parent")) } : {}),
      };
      const ok = await onSave(
        {
          ...s,
          customCategories: editor
            ? (s.customCategories || []).map((x) =>
                x.id === editor.id ? c : x,
              )
            : [...(s.customCategories || []), c],
        },
        "Category saved.",
      );
      if (ok) setEditor(undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(c: CustomCategory) {
    setError("");
    const used =
      [
        ...s.transactions,
        ...(s.shortcuts || []),
        ...s.bills,
        ...s.rules,
        ...s.budgets,
      ].some((x) => x.category === c.id) ||
      (s.customCategories || []).some((x) => x.parent === c.id);
    if (used) {
      setError(
        "This category has records or subcategories. Keep it to preserve your history.",
      );
      return;
    }
    setBusy(true);
    try {
      if (
        await onSave(
          {
            ...s,
            customCategories: (s.customCategories || []).filter(
              (x) => x.id !== c.id,
            ),
          },
          "Unused category removed.",
        )
      )
        setEditor(undefined);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="v2-panel">
      <div className="v2-section-heading">
        <div>
          <h3>Your categories</h3>
          <p className="form-help">Make room for your own kind of spending.</p>
        </div>
        <button
          className="secondary"
          onClick={() => {
            setError("");
            setEditor(null);
          }}
        >
          <Icon name="Plus" />
          New category
        </button>
      </div>
      <div className="category-chips">
        {(s.customCategories || []).map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setError("");
              setEditor(c);
            }}
          >
            <Icon name={c.icon} size={16} />
            {c.parent ? `${cat(c.parent, s).name} / ` : ""}
            {c.name}
          </button>
        ))}
      </div>
      {!(s.customCategories || []).length && (
        <p className="form-help">
          Add pets, hobbies, work expenses, or something entirely you.
        </p>
      )}
      {editor !== undefined && (
        <Modal
          title={editor ? "Edit category" : "Create a category"}
          onClose={() => {
            if (!busy) setEditor(undefined);
          }}
        >
          <form className="v2-form" onSubmit={submit}>
            <Field label="Category name">
              <input
                name="name"
                defaultValue={editor?.name}
                maxLength={40}
                required
              />
            </Field>
            <div className="form-grid">
              <Field label="Category icon">
                <select name="icon" defaultValue={editor?.icon || "Shapes"}>
                  {categoryIcons.map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </select>
              </Field>
              <Field label="Category colour">
                <input
                  type="color"
                  name="color"
                  defaultValue={editor?.color || "#72987b"}
                />
              </Field>
            </div>
            <Field label="Parent category (optional)">
              <select name="parent" defaultValue={editor?.parent || ""}>
                <option value="">Standalone category</option>
                {(s.customCategories || [])
                  .filter((c) => !c.parent && c.id !== editor?.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <p className="form-help">
              Subcategories organise labels; each category keeps its own budget
              and totals.
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary full-width" disabled={busy}>
              Save category
            </button>
            {editor && (
              <button
                className="text-button negative"
                type="button"
                disabled={busy}
                onClick={() => void remove(editor)}
              >
                Delete unused category
              </button>
            )}
          </form>
        </Modal>
      )}
    </section>
  );
}
