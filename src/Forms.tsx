import { useState, type FormEvent } from "react";
import {
  categories,
  cents,
  day,
  uid,
  emptyState,
  type State,
  type Transaction,
  type Kind,
  type Account,
  type Bill,
  type Goal,
  type Budget,
  type Split,
  type Rule,
} from "./model";
import { Field, Icon } from "./ui";
export type Editor =
  | { type: "transaction"; item?: Transaction }
  | { type: "account"; item?: Account }
  | { type: "bill"; item?: Bill }
  | { type: "goal"; item?: Goal }
  | { type: "budget"; item?: Budget }
  | { type: "split"; item?: Split }
  | { type: "rule"; item?: Rule }
  | { type: "contribution"; item: Goal }
  | { type: "onboarding" };
export function EditorForm({
  editor,
  s,
  onSave,
  onDelete,
}: {
  editor: Editor;
  s: State;
  onSave: (s: State, message: string) => void;
  onDelete?: (id: string) => void;
}) {
  const item = "item" in editor ? editor.item : undefined;
  const [kind, setKind] = useState<Kind>(
    editor.type === "transaction" ? editor.item?.kind || "expense" : "expense",
  );
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(
    editor.type === "transaction" ? editor.item?.receipt : undefined,
  );
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState(
    "category" in (item || {}) ? (item as Transaction).category : "food",
  );
  const accounts = (
    <>
      {s.accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </>
  );
  const categoryField = (
    <Field label="Category">
      <select
        name="category"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </Field>
  );
  const amount = (
    label: string,
    name: string,
    value?: number,
    allowZero = false,
  ) => (
    <Field label={label}>
      <input
        name={name}
        inputMode="decimal"
        type="number"
        min={allowZero ? "0" : "0.01"}
        step="0.01"
        max="10000000000"
        placeholder="0.00"
        defaultValue={value === undefined ? "" : value / 100}
        required
      />
    </Field>
  );
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    try {
      const f = new FormData(e.currentTarget);
      const get = (k: string) => String(f.get(k) || "").trim();
      const cash = (k: string) => cents(get(k));
      const nonnegative = (k: string) => (Number(get(k)) === 0 ? 0 : cash(k));
      const id = item?.id || uid();
      let next = { ...s };
      let message = "Saved. A little more organised.";
      switch (editor.type) {
        case "transaction": {
          const t: Transaction = {
            id,
            kind,
            amount: cash("amount"),
            title: get("title"),
            category,
            account: get("account"),
            toAccount: kind === "transfer" ? get("toAccount") : undefined,
            date: get("date"),
            note: get("note"),
            tags: get("tags"),
            reviewed: true,
            ...(receipt ? { receipt } : {}),
          };
          if (kind === "transfer" && t.account === t.toAccount)
            throw new Error("Choose two different wallets for a transfer.");
          if (t.date > day())
            throw new Error(
              "Use Bills for future payments. Transactions must be dated today or earlier.",
            );
          next.transactions = item
            ? s.transactions.map((x) => (x.id === id ? t : x))
            : [t, ...s.transactions];
          message = item
            ? "Transaction updated."
            : "Transaction added. Nicely tracked.";
          break;
        }
        case "account": {
          const opening = Number(get("opening"));
          if (!Number.isFinite(opening) || Math.abs(opening) > 1e10)
            throw new Error("Enter a valid opening balance.");
          const a: Account = {
            id,
            name: get("name"),
            type: get("type") as Account["type"],
            opening: Math.round(opening * 100),
            color: get("color"),
          };
          next.accounts = item
            ? s.accounts.map((x) => (x.id === id ? a : x))
            : [...s.accounts, a];
          break;
        }
        case "budget": {
          if (s.budgets.some((b) => b.category === category && b.id !== id))
            throw new Error(
              "This category already has a budget. Edit that budget instead.",
            );
          const b: Budget = { id, category, limit: cash("limit") };
          next.budgets = item
            ? s.budgets.map((x) => (x.id === id ? b : x))
            : [...s.budgets, b];
          break;
        }
        case "goal": {
          const g: Goal = {
            id,
            name: get("name"),
            target: cash("target"),
            saved: nonnegative("saved"),
            date: get("date"),
            emoji: get("emoji"),
          };
          next.goals = item
            ? s.goals.map((x) => (x.id === id ? g : x))
            : [...s.goals, g];
          break;
        }
        case "contribution":
          next.goals = s.goals.map((g) =>
            g.id === id ? { ...g, saved: g.saved + cash("amount") } : g,
          );
          message = "One step closer to your goal.";
          break;
        case "bill": {
          const b: Bill = {
            id,
            name: get("name"),
            amount: cash("amount"),
            date: get("date"),
            cadence: get("cadence") as Bill["cadence"],
            category,
            account: get("account"),
            active: editor.item?.active ?? true,
          };
          next.bills = item
            ? s.bills.map((x) => (x.id === id ? b : x))
            : [...s.bills, b];
          break;
        }
        case "split": {
          const split: Split = {
            id,
            name: get("name"),
            title: get("title"),
            amount: cash("amount"),
            direction: get("direction") as Split["direction"],
            settled: editor.item?.settled ?? false,
          };
          next.splits = item
            ? s.splits.map((x) => (x.id === id ? split : x))
            : [...s.splits, split];
          break;
        }
        case "rule": {
          const rule: Rule = {
            id,
            match: get("match").toLowerCase(),
            category,
          };
          next.rules = item
            ? s.rules.map((x) => (x.id === id ? rule : x))
            : [...s.rules, rule];
          break;
        }
        case "onboarding":
          next = emptyState(
            get("name") || "friend",
            get("currency"),
            nonnegative("income"),
          );
          next.accounts[0].opening = nonnegative("opening");
          message = "Your fresh start is ready.";
          break;
      }
      onSave(next, message);
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function attach(file?: File) {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 10e6
    ) {
      setError("Choose a JPG, PNG or WebP under 10 MB.");
      return;
    }
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas
        .getContext("2d")!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      setReceipt(canvas.toDataURL("image/jpeg", 0.75));
      bitmap.close();
    } catch {
      setError("Could not read this image. Try a different receipt.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="editor-form">
      {editor.type === "transaction" && (
        <>
          <div className="segmented">
            {(["expense", "income", "transfer"] as Kind[]).map((k) => (
              <button
                type="button"
                className={kind === k ? "selected" : ""}
                key={k}
                onClick={() => setKind(k)}
              >
                {k[0].toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
          <div className="amount-entry">
            <span>{s.settings.currency}</span>
            <input
              name="amount"
              aria-label="Amount"
              inputMode="decimal"
              type="number"
              min="0.01"
              max="10000000000"
              step="0.01"
              placeholder="0.00"
              defaultValue={editor.item ? editor.item.amount / 100 : ""}
              required
            />
          </div>
          <Field
            label={
              kind === "transfer" ? "Transfer description" : "What was it for?"
            }
          >
            <input
              name="title"
              maxLength={200}
              placeholder={
                kind === "expense"
                  ? "Coffee, groceries, a little treat…"
                  : kind === "income"
                    ? "Salary, freelance work…"
                    : "Move money between wallets"
              }
              defaultValue={editor.item?.title}
              required
              onBlur={(e) => {
                if (!item) {
                  const rule = s.rules.find((r) =>
                    e.target.value
                      .toLowerCase()
                      .includes(r.match.toLowerCase()),
                  );
                  if (rule) setCategory(rule.category);
                }
              }}
            />
          </Field>
          <div className="form-grid">
            {kind !== "transfer" && categoryField}
            <Field label={kind === "transfer" ? "From wallet" : "Wallet"}>
              <select
                name="account"
                defaultValue={editor.item?.account || s.accounts[0].id}
              >
                {accounts}
              </select>
            </Field>
            {kind === "transfer" && (
              <Field label="To wallet">
                <select
                  name="toAccount"
                  defaultValue={editor.item?.toAccount || s.accounts[1]?.id}
                >
                  {accounts}
                </select>
              </Field>
            )}
            <Field label="Date">
              <input
                name="date"
                type="date"
                max={day()}
                defaultValue={editor.item?.date || day()}
                required
              />
            </Field>
            <Field label="Tags (optional)">
              <input
                name="tags"
                maxLength={200}
                placeholder="weekend, essential"
                defaultValue={editor.item?.tags}
              />
            </Field>
          </div>
          <Field label="Note (optional)">
            <textarea
              name="note"
              maxLength={2000}
              placeholder="The little details"
              defaultValue={editor.item?.note}
            />
          </Field>
          <div className="receipt-area">
            {receipt ? (
              <>
                <img src={receipt} alt="Attached receipt" />
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setReceipt(undefined)}
                >
                  Remove receipt
                </button>
              </>
            ) : (
              <label className="file-button">
                <Icon name="Paperclip" />{" "}
                {busy ? "Preparing receipt…" : "Attach a receipt"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => void attach(e.target.files?.[0])}
                />
              </label>
            )}
          </div>
        </>
      )}
      {editor.type === "account" && (
        <>
          <Field label="Wallet name">
            <input
              name="name"
              maxLength={60}
              defaultValue={editor.item?.name}
              placeholder="Everyday account"
              required
            />
          </Field>
          <div className="form-grid">
            <Field label="Wallet type">
              <select name="type" defaultValue={editor.item?.type}>
                {["Bank", "Cash", "Credit", "Savings"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Colour">
              <input
                name="color"
                type="color"
                defaultValue={editor.item?.color || "#194d3d"}
              />
            </Field>
          </div>
          <Field
            label="Opening balance"
            hint="Before the transactions recorded here. Use a negative balance for credit card debt."
          >
            <input
              name="opening"
              type="number"
              step="0.01"
              defaultValue={(editor.item?.opening || 0) / 100}
              required
            />
          </Field>
        </>
      )}
      {editor.type === "budget" && (
        <>
          {categoryField}
          {amount("Monthly limit", "limit", editor.item?.limit)}
          <p className="form-help">
            This category limit repeats each month. Only expense transactions
            count toward it.
          </p>
        </>
      )}
      {editor.type === "goal" && (
        <>
          <Field label="What are you saving for?">
            <input
              name="name"
              maxLength={200}
              placeholder="A trip worth waiting for"
              defaultValue={editor.item?.name}
              required
            />
          </Field>
          <div className="form-grid">
            {amount("Target amount", "target", editor.item?.target)}
            {amount("Already saved", "saved", editor.item?.saved || 0, true)}
            <Field label="Target date">
              <input
                name="date"
                type="date"
                defaultValue={editor.item?.date}
                required
              />
            </Field>
            <Field label="A little personality">
              <select name="emoji" defaultValue={editor.item?.emoji || "🌱"}>
                {["🌱", "🏝️", "🏠", "💻", "🚗", "🎓", "✨", "🎁"].map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            </Field>
          </div>
          <p className="form-help">
            Goals are progress trackers. Updating savings here doesn’t change
            your wallet balances.
          </p>
        </>
      )}
      {editor.type === "contribution" && (
        <>
          {amount("Amount saved", "amount")}
          <p className="form-help">
            Adds to “{editor.item.name}”. This records progress only; use a
            transfer to move money between wallets.
          </p>
        </>
      )}
      {editor.type === "bill" && (
        <>
          <Field label="Bill or subscription">
            <input
              name="name"
              maxLength={200}
              placeholder="Netflix, rent, internet…"
              defaultValue={editor.item?.name}
              required
            />
          </Field>
          <div className="form-grid">
            {amount("Amount", "amount", editor.item?.amount)}
            <Field label="Repeats">
              <select
                name="cadence"
                defaultValue={editor.item?.cadence || "monthly"}
              >
                <option value="monthly">Every month</option>
                <option value="yearly">Every year</option>
                <option value="weekly">Every week</option>
              </select>
            </Field>
            <Field label="Next due date">
              <input
                name="date"
                type="date"
                defaultValue={editor.item?.date || day()}
                required
              />
            </Field>
            <Field label="Pay from">
              <select name="account" defaultValue={editor.item?.account}>
                {accounts}
              </select>
            </Field>
            {categoryField}
          </div>
          <p className="form-help">
            Mark paid to record an expense and advance the due date. Upcoming
            reminders appear inside Gareeb.
          </p>
        </>
      )}
      {editor.type === "split" && (
        <>
          <Field label="Person">
            <input
              name="name"
              maxLength={200}
              placeholder="Their name"
              defaultValue={editor.item?.name}
              required
            />
          </Field>
          <Field label="For what?">
            <input
              name="title"
              maxLength={200}
              placeholder="Dinner, rent, a weekend away…"
              defaultValue={editor.item?.title}
              required
            />
          </Field>
          <div className="form-grid">
            {amount("Their share / amount owed", "amount", editor.item?.amount)}
            <Field label="Who owes whom?">
              <select
                name="direction"
                defaultValue={editor.item?.direction || "owed"}
              >
                <option value="owed">They owe me</option>
                <option value="owe">I owe them</option>
              </select>
            </Field>
          </div>
          <p className="form-help">
            A personal IOU tracker. It doesn’t message anyone or change wallet
            balances. Record the payment separately when money moves.
          </p>
        </>
      )}
      {editor.type === "rule" && (
        <>
          <Field label="When a merchant contains">
            <input
              name="match"
              maxLength={80}
              placeholder="e.g. coffee"
              defaultValue={editor.item?.match}
              required
            />
          </Field>
          {categoryField}
          <p className="form-help">
            The first matching rule suggests a category when you finish entering
            a new transaction title.
          </p>
        </>
      )}
      {editor.type === "onboarding" && (
        <>
          <p className="form-help">
            A fresh notebook for your money. No signup needed.
          </p>
          <Field label="What should we call you?">
            <input
              name="name"
              placeholder="Your first name"
              maxLength={60}
              required
            />
          </Field>
          <Field label="Currency">
            <select name="currency" defaultValue="INR">
              <option value="INR">₹ · Indian rupee</option>
              <option value="USD">$ · US dollar</option>
              <option value="EUR">€ · Euro</option>
              <option value="GBP">£ · British pound</option>
              <option value="AED">AED · UAE dirham</option>
            </select>
          </Field>
          {amount("Monthly income plan", "income", 0, true)}
          {amount("Current main account balance", "opening", 0, true)}
          <p className="form-help">
            You can change these later. All wallets use your chosen currency.
          </p>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-footer">
        {item && editor.type !== "contribution" && onDelete && (
          <button
            type="button"
            className="danger-button"
            onClick={() => onDelete(item.id)}
          >
            <Icon name="Trash2" />
            Delete
          </button>
        )}
        <button type="submit" className="primary" disabled={busy}>
          <Icon name="Check" />
          {editor.type === "onboarding"
            ? "Let’s begin"
            : editor.type === "contribution"
              ? "Add savings"
              : "Save " + (editor.type === "transaction" ? kind : editor.type)}
        </button>
      </div>
    </form>
  );
}
