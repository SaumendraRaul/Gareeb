import { useState, type FormEvent } from "react";
import { cents, day, money, uid, type State } from "./model";
import {
  groupBalances,
  settlementsFor,
  splitEvenly,
  recordSettlement,
  upsertGroupExpense,
} from "./v2";
import type { ExpenseGroup, GroupExpense } from "./v2-data";
import { Field, Icon, Modal, Progress } from "./ui";
import { download } from "./storage";

type Props = {
  s: State;
  onSave: (next: State, message: string) => Promise<boolean>;
  onNotice: (message: string) => void;
  cash: (amount: number) => string;
};
type Sheet =
  | { kind: "group"; group?: ExpenseGroup }
  | { kind: "expense"; group: ExpenseGroup; expense?: GroupExpense }
  | {
      kind: "settle";
      group: ExpenseGroup;
      from: string;
      to: string;
      amount: number;
    }
  | { kind: "delete"; group: ExpenseGroup; id: string; settlement?: boolean };
export function Groups({ s, onSave, onNotice, cash }: Props) {
  const [selected, setSelected] = useState<string | null>(null),
    [sheet, setSheet] = useState<Sheet | null>(null),
    [archived, setArchived] = useState(false),
    [busy, setBusy] = useState(false);
  const groups = s.groups || [],
    g = groups.find((g) => g.id === selected);
  async function saveGroup(group: ExpenseGroup, message: string) {
    if (busy) return false;
    setBusy(true);
    try {
      const ok = await onSave(
        {
          ...s,
          groups: groups.some((g) => g.id === group.id)
            ? groups.map((g) => (g.id === group.id ? group : g))
            : [...groups, group],
        },
        message,
      );
      if (ok) {
        setSheet(null);
        setSelected(group.id);
      }
      return ok;
    } finally {
      setBusy(false);
    }
  }
  async function share(group: ExpenseGroup) {
    const fmt = (n: number) => money(n, s.settings.currency),
      names = (id: string) =>
        group.members.find((m) => m.id === id)?.name || "";
    const lines = [
      `${group.name} · Gareeb`,
      `Recorded expenses: ${fmt(group.expenses.reduce((n, e) => n + e.amount, 0))}`,
      "",
      "Balances",
      ...groupBalances(group).map(
        (m) =>
          `${m.name}: ${m.net > 0 ? "gets back" : m.net < 0 ? "owes" : "settled"} ${fmt(Math.abs(m.net))}`,
      ),
      "",
      "Suggested settlements",
      ...settlementsFor(group).map(
        (p) => `${names(p.from)} → ${names(p.to)}: ${fmt(p.amount)}`,
      ),
      "",
      "Expense history",
      ...group.expenses.map(
        (e) =>
          `${e.date} · ${e.title} · ${names(e.payer)} paid ${fmt(e.amount)}; ${e.shares.map((x) => `${names(x.member)} ${fmt(x.amount)}`).join(", ")}`,
      ),
      "",
      "Payment history",
      ...group.settlements.map(
        (p) =>
          `${p.date} · ${names(p.from)} paid ${names(p.to)} ${fmt(p.amount)}`,
      ),
      "",
      "Personal ledger only. Confirm payments with the people involved.",
    ];
    try {
      await download(
        "gareeb-group-summary.txt",
        lines.join("\n"),
        "text/plain",
      );
    } catch (e) {
      onNotice("Could not share: " + (e as Error).message);
    }
  }
  const balances = g ? groupBalances(g) : [],
    suggested = g ? settlementsFor(g) : [],
    total = g?.expenses.reduce((n, e) => n + e.amount, 0) || 0;
  return (
    <div className="together-space">
      {!g && (
        <div className="v2-hero together-hero">
          <span className="v2-eyebrow">GOOD TIMES. CLEAR TABS.</span>
          <h2>
            Life is better
            <br />
            when it adds up.
          </h2>
          <p>
            Trips, flatmates, little celebrations.
            <br />
            Keep the money part easy.
          </p>
          <div className="together-orbits" aria-hidden="true">
            <span>☺</span>
            <span>✦</span>
            <span>☺</span>
          </div>
          <button
            className="primary"
            onClick={() => setSheet({ kind: "group" })}
          >
            <Icon name="Plus" />
            New group
          </button>
        </div>
      )}
      {!g ? (
        <>
          <div className="v2-section-heading">
            <h3>Your circles</h3>
            <button
              className="text-button"
              onClick={() => setArchived(!archived)}
            >
              {archived ? "Active groups" : "Archived groups"}
            </button>
          </div>
          <div className="group-grid">
            {groups
              .filter((g) => g.archived === archived)
              .map((group) => {
                const total = group.expenses.reduce((n, e) => n + e.amount, 0);
                return (
                  <button
                    className="group-card"
                    key={group.id}
                    onClick={() => setSelected(group.id)}
                  >
                    <span className="group-emoji">{group.emoji}</span>
                    <strong>{group.name}</strong>
                    <span>
                      {group.members.length} people · {group.expenses.length}{" "}
                      expenses
                    </span>
                    <b>{cash(total)}</b>
                    <span className="group-avatars">
                      {group.members.slice(0, 5).map((m) => (
                        <i key={m.id}>{m.name[0]}</i>
                      ))}
                      <Icon name="ArrowUpRight" />
                    </span>
                  </button>
                );
              })}
          </div>
          {!groups.some((g) => g.archived === archived) && (
            <div className="v2-empty">
              <Icon name="Users" size={36} />
              <h3>
                {archived ? "No archived circles" : "Start with your people"}
              </h3>
              <p>
                Create a group for a trip or household. Add who paid, split the
                amount, and track settlements.
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="v2-section-heading">
            <button className="text-button" onClick={() => setSelected(null)}>
              <Icon name="ArrowLeft" />
              All groups
            </button>
            <button className="text-button" onClick={() => void share(g)}>
              <Icon name="Share2" />
              Share summary
            </button>
          </div>
          <section className="group-detail">
            <div className="v2-section-heading">
              <div>
                <span className="group-emoji">{g.emoji}</span>
                <h2>{g.name}</h2>
                <p>{g.members.map((m) => m.name).join(" · ")}</p>
              </div>
              <button
                className="icon-button"
                aria-label="Edit group"
                onClick={() => setSheet({ kind: "group", group: g })}
              >
                <Icon name="Pencil" />
              </button>
            </div>
            <div className="group-totals">
              <span>
                Total spent<strong>{cash(total)}</strong>
              </span>
              <span>
                Still to settle
                <strong>
                  {cash(suggested.reduce((n, p) => n + p.amount, 0))}
                </strong>
              </span>
            </div>
            {g.budget > 0 && (
              <div className="group-budget">
                <Progress value={(total / g.budget) * 100} />
                <small>
                  {cash(Math.abs(g.budget - total))}{" "}
                  {total > g.budget ? "over" : "left in"} your {cash(g.budget)}{" "}
                  group budget
                </small>
              </div>
            )}
            <div className="member-balances">
              {balances.map((m) => (
                <div key={m.id}>
                  <i>{m.name[0]}</i>
                  <span>
                    {m.name}
                    <small>
                      {m.net > 0
                        ? "Gets back"
                        : m.net < 0
                          ? "Owes"
                          : "All square"}
                    </small>
                  </span>
                  <b
                    className={
                      m.net > 0 ? "positive" : m.net < 0 ? "negative" : ""
                    }
                  >
                    {cash(Math.abs(m.net))}
                  </b>
                </div>
              ))}
            </div>
            {!g.archived && (
              <button
                className="primary full-width"
                onClick={() => setSheet({ kind: "expense", group: g })}
              >
                <Icon name="Plus" />
                Add shared expense
              </button>
            )}
          </section>
          <section className="v2-panel">
            <div className="v2-section-heading">
              <h3>Settle a little, smile a lot</h3>
              <Icon name="Handshake" />
            </div>
            <p className="form-help">
              Suggested transfers simplify the group’s balances. Record only
              payments that actually happened.
            </p>
            {suggested.map((p) => (
              <div className="settlement-row" key={p.from + p.to}>
                <span>
                  <b>{g.members.find((m) => m.id === p.from)?.name}</b>
                  <small>
                    pays {g.members.find((m) => m.id === p.to)?.name}
                  </small>
                </span>
                <strong>{cash(p.amount)}</strong>
                {!g.archived && (
                  <button
                    className="secondary"
                    onClick={() => setSheet({ kind: "settle", group: g, ...p })}
                  >
                    Record payment
                  </button>
                )}
              </div>
            ))}
            {!suggested.length && (
              <div className="all-square">
                <Icon name="CircleCheck" />
                <span>All square. That feels good.</span>
              </div>
            )}
          </section>
          <section className="v2-panel">
            <h3>The shared story</h3>
            {[...g.expenses]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((e) => (
                <div className="group-history" key={e.id}>
                  <span className="category-icon">
                    <Icon name="Receipt" />
                  </span>
                  <button
                    className="group-history-main"
                    disabled={g.archived}
                    onClick={() =>
                      setSheet({ kind: "expense", group: g, expense: e })
                    }
                  >
                    <b>{e.title}</b>
                    <small>
                      {e.date} · {g.members.find((m) => m.id === e.payer)?.name}{" "}
                      paid · {e.shares.length} people
                    </small>
                  </button>
                  <strong>{cash(e.amount)}</strong>
                  {!g.archived && (
                    <button
                      className="icon-button"
                      aria-label={`Delete ${e.title} shared expense`}
                      onClick={() =>
                        setSheet({ kind: "delete", group: g, id: e.id })
                      }
                    >
                      <Icon name="Trash2" size={16} />
                    </button>
                  )}
                </div>
              ))}
            {!g.expenses.length && (
              <p className="form-help">
                Your first shared expense starts the story.
              </p>
            )}
            {g.settlements.map((p) => (
              <div className="group-history" key={p.id}>
                <Icon name="CircleCheck" />
                <span className="group-history-main">
                  <b>
                    {g.members.find((m) => m.id === p.from)?.name} →{" "}
                    {g.members.find((m) => m.id === p.to)?.name}
                  </b>
                  <small>Payment recorded · {p.date}</small>
                </span>
                <strong>{cash(p.amount)}</strong>
                {!g.archived && (
                  <button
                    className="icon-button"
                    aria-label="Delete recorded payment"
                    onClick={() =>
                      setSheet({
                        kind: "delete",
                        group: g,
                        id: p.id,
                        settlement: true,
                      })
                    }
                  >
                    <Icon name="Trash2" size={16} />
                  </button>
                )}
              </div>
            ))}
          </section>
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              void saveGroup(
                { ...g, archived: !g.archived },
                g.archived
                  ? "Group reopened."
                  : "Group archived. History is kept.",
              )
            }
          >
            {g.archived ? "Reopen group" : "Archive group"}
          </button>
        </>
      )}
      <p className="quiet-note">
        Groups are kept on this device and included in full backups. Shared
        entries and settlements do not change your wallet balances. Record
        wallet movements separately when needed.
      </p>
      {sheet && (
        <Modal
          title={
            sheet.kind === "group"
              ? sheet.group
                ? "Edit your circle"
                : "A new circle"
              : sheet.kind === "expense"
                ? sheet.expense
                  ? "Edit shared expense"
                  : "Add shared expense"
                : sheet.kind === "settle"
                  ? "Record a payment"
                  : "Remove this record?"
          }
          onClose={() => {
            if (!busy) setSheet(null);
          }}
        >
          {sheet.kind === "group" && (
            <GroupForm
              group={sheet.group}
              busy={busy}
              onSave={(g) => saveGroup(g, "Your circle is ready.")}
            />
          )}
          {sheet.kind === "expense" && (
            <SharedExpenseForm
              key={sheet.expense?.id || "new"}
              group={sheet.group}
              expense={sheet.expense}
              cash={cash}
              busy={busy}
              onSave={(e) =>
                saveGroup(
                  upsertGroupExpense(sheet.group, e),
                  "Shared expense saved.",
                )
              }
            />
          )}
          {sheet.kind === "settle" && (
            <PaymentForm
              sheet={sheet}
              busy={busy}
              onSave={(g) =>
                saveGroup(g, "Payment recorded. A little more even.")
              }
            />
          )}
          {sheet.kind === "delete" && (
            <>
              <p>
                This recalculates everyone’s balances. You can undo immediately
                after saving.
              </p>
              <button
                className="danger-button"
                disabled={busy}
                onClick={() =>
                  void saveGroup(
                    {
                      ...sheet.group,
                      expenses: sheet.settlement
                        ? sheet.group.expenses
                        : sheet.group.expenses.filter((e) => e.id !== sheet.id),
                      settlements: sheet.settlement
                        ? sheet.group.settlements.filter(
                            (p) => p.id !== sheet.id,
                          )
                        : sheet.group.settlements,
                    },
                    "Record removed.",
                  )
                }
              >
                Delete record
              </button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
function GroupForm({
  group,
  busy,
  onSave,
}: {
  group?: ExpenseGroup;
  busy: boolean;
  onSave: (g: ExpenseGroup) => Promise<boolean>;
}) {
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    try {
      const f = new FormData(e.currentTarget),
        get = (k: string) => String(f.get(k) || "").trim();
      let members =
        group?.members ||
        get("members")
          .split(",")
          .map((name) => ({ id: uid(), name: name.trim() }));
      if (
        members.length < 2 ||
        members.length > 30 ||
        members.some((m) => !m.name || m.name.length > 40) ||
        new Set(members.map((m) => m.name.toLowerCase())).size !==
          members.length
      )
        throw Error("Add 2–30 unique names, separated by commas.");
      const added = get("addMembers");
      if (added)
        members = [
          ...members,
          ...added.split(",").map((name) => ({ id: uid(), name: name.trim() })),
        ];
      await onSave({
        id: group?.id || uid(),
        name: get("name"),
        emoji: get("emoji"),
        members,
        expenses: group?.expenses || [],
        settlements: group?.settlements || [],
        budget:
          get("budget") && Number(get("budget")) !== 0
            ? cents(get("budget"))
            : 0,
        archived: group?.archived || false,
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <form onSubmit={submit} className="v2-form">
      <Field label="Group name">
        <input
          name="name"
          maxLength={60}
          required
          defaultValue={group?.name}
          placeholder="Goa, here we come"
        />
      </Field>
      <div className="form-grid">
        <Field label="Group icon">
          <select name="emoji" defaultValue={group?.emoji || "🌴"}>
            {["🌴", "🏠", "🍕", "🎉", "☕", "🎒", "💛", "🎮"].map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </Field>
        <Field label="Group budget (optional)">
          <input
            name="budget"
            inputMode="decimal"
            type="number"
            min="0"
            step="0.01"
            defaultValue={group?.budget ? group.budget / 100 : ""}
            placeholder="0.00"
          />
        </Field>
      </div>
      {group ? (
        <>
          <p className="form-help">
            Members: {group.members.map((m) => m.name).join(", ")}. Existing
            members stay attached to their history.
          </p>
          <Field label="Add members (comma separated)">
            <input
              name="addMembers"
              maxLength={800}
              placeholder="Priya, Aman"
            />
          </Field>
        </>
      ) : (
        <Field label="Members (comma separated)">
          <input
            name="members"
            maxLength={1000}
            defaultValue="You, "
            placeholder="You, Priya, Aman"
            required
          />
        </Field>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="primary full-width" disabled={busy}>
        Save group
      </button>
    </form>
  );
}
function SharedExpenseForm({
  group,
  expense,
  cash,
  busy,
  onSave,
}: {
  group: ExpenseGroup;
  expense?: GroupExpense;
  cash: (n: number) => string;
  busy: boolean;
  onSave: (e: GroupExpense) => Promise<boolean>;
}) {
  const [value, setValue] = useState(
      expense ? String(expense.amount / 100) : "",
    ),
    [mode, setMode] = useState<"equal" | "custom">(
      expense ? "custom" : "equal",
    ),
    [members, setMembers] = useState(
      expense?.shares.map((x) => x.member) || group.members.map((m) => m.id),
    ),
    [error, setError] = useState("");
  let preview: { member: string; amount: number }[] = [];
  try {
    preview = splitEvenly(cents(value), members);
  } catch {
    /* Amount is still being entered. */
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    try {
      const f = new FormData(e.currentTarget),
        amount = cents(value),
        shares =
          mode === "equal"
            ? splitEvenly(amount, members)
            : members.map((member) => {
                const v = String(f.get("share-" + member) || "0");
                return { member, amount: Number(v) === 0 ? 0 : cents(v) };
              });
      if (
        !members.length ||
        shares.reduce((n, x) => n + x.amount, 0) !== amount
      )
        throw Error("The individual shares must add up exactly to the total.");
      const date = String(f.get("date"));
      if (date > day()) throw Error("Record payments dated today or earlier.");
      await onSave({
        id: expense?.id || uid(),
        title: String(f.get("title")).trim(),
        amount,
        payer: String(f.get("payer")),
        shares,
        date,
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <form className="v2-form" onSubmit={submit}>
      <Field label="Shared expense title">
        <input
          name="title"
          maxLength={100}
          required
          defaultValue={expense?.title}
          placeholder="Dinner by the sea"
        />
      </Field>
      <Field label="Total shared amount">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="decimal"
          type="number"
          min="0.01"
          step="0.01"
          required
          autoFocus
        />
      </Field>
      <div className="form-grid">
        <Field label="Paid by">
          <select
            name="payer"
            defaultValue={expense?.payer || group.members[0].id}
          >
            {group.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Expense date">
          <input
            name="date"
            type="date"
            defaultValue={expense?.date || day()}
            max={day()}
            required
          />
        </Field>
      </div>
      <div className="segmented">
        <button
          type="button"
          className={mode === "equal" ? "selected" : ""}
          onClick={() => setMode("equal")}
        >
          Split equally
        </button>
        <button
          type="button"
          className={mode === "custom" ? "selected" : ""}
          onClick={() => setMode("custom")}
        >
          Custom amounts
        </button>
      </div>
      <div className="share-members">
        {group.members.map((m) => (
          <div key={m.id}>
            <label>
              <input
                type="checkbox"
                checked={members.includes(m.id)}
                onChange={(e) =>
                  setMembers(
                    e.target.checked
                      ? [...members, m.id]
                      : members.filter((id) => id !== m.id),
                  )
                }
              />
              {m.name}
            </label>
            {members.includes(m.id) &&
              (mode === "equal" ? (
                <strong>
                  {cash(preview.find((p) => p.member === m.id)?.amount || 0)}
                </strong>
              ) : (
                <input
                  name={"share-" + m.id}
                  aria-label={`${m.name} share`}
                  inputMode="decimal"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  defaultValue={
                    (expense?.shares.find((x) => x.member === m.id)?.amount ||
                      0) / 100
                  }
                />
              ))}
          </div>
        ))}
      </div>
      <p className="form-help">
        Equal splits distribute any remaining pennies in the order selected. The
        payer can be excluded from the split.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="primary full-width" disabled={busy}>
        Save shared expense
      </button>
    </form>
  );
}
function PaymentForm({
  sheet,
  busy,
  onSave,
}: {
  sheet: Extract<Sheet, { kind: "settle" }>;
  busy: boolean;
  onSave: (g: ExpenseGroup) => Promise<boolean>;
}) {
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    try {
      const f = new FormData(e.currentTarget);
      await onSave(
        recordSettlement(
          sheet.group,
          sheet.from,
          sheet.to,
          cents(String(f.get("amount"))),
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <form className="v2-form" onSubmit={submit}>
      <p>
        <b>{sheet.group.members.find((m) => m.id === sheet.from)?.name}</b> paid{" "}
        <b>{sheet.group.members.find((m) => m.id === sheet.to)?.name}</b>
      </p>
      <Field label="Payment amount">
        <input
          name="amount"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          max={sheet.amount / 100}
          defaultValue={sheet.amount / 100}
          required
        />
      </Field>
      <p className="form-help">
        You can record a smaller payment. This updates the group ledger; it does
        not send money.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="primary full-width" disabled={busy}>
        Confirm payment received
      </button>
    </form>
  );
}
