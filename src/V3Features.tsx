import { useState, type FormEvent } from "react";
import { cents, day, uid, type State } from "./model";
import {
  affordability,
  resolveExpected,
  type ExpectedPayment,
  type IncomeSchedule,
} from "./v3";
import { Field, Icon, Modal } from "./ui";

type Props = {
  s: State;
  cash: (n: number) => string;
  onSave: (s: State, message: string) => Promise<boolean>;
};
export function SpendCheck({ s, cash }: Omit<Props, "onSave">) {
  const [value, setValue] = useState(""),
    [days, setDays] = useState(30);
  const amount = Math.max(0, Math.round(Number(value || 0) * 100));
  const result = affordability(
    s,
    Number.isSafeInteger(amount) ? amount : 0,
    days,
  );
  return (
    <section className="spend-check v2-panel">
      <span className="v2-eyebrow">A LITTLE ROOM TO BREATHE</span>
      <h2>Can I afford it?</h2>
      <p className="form-help">
        Check a purchase against the money you have, upcoming bills and your
        reserve.
      </p>
      <div className="form-grid spend-controls">
        <Field label="Planned purchase amount">
          <input
            type="number"
            min="0"
            max="10000000000"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
        <Field label="Plan ahead">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>Next 7 days</option>
            <option value={14}>Next 14 days</option>
            <option value={30}>Next 30 days</option>
          </select>
        </Field>
      </div>
      <div className={`spend-result ${result.after < 0 ? "is-tight" : ""}`}>
        <small>
          {result.after < 0
            ? "Short of your plan by"
            : "Left after this purchase"}
        </small>
        <strong>{cash(Math.abs(result.after))}</strong>
        <p>
          {result.after < 0
            ? "This purchase would use money set aside for bills or your reserve."
            : `${cash(result.daily)} per day across the next ${days} days.`}
        </p>
      </div>
      <dl className="calculation">
        <div>
          <dt>Current wallet balances</dt>
          <dd>{cash(result.balance)}</dd>
        </div>
        <div>
          <dt>Bills + unconfirmed charges</dt>
          <dd>− {cash(result.commitments)}</dd>
        </div>
        <div>
          <dt>Protected reserve</dt>
          <dd>− {cash(result.reserve)}</dd>
        </div>
        <div>
          <dt>This purchase</dt>
          <dd>− {cash(amount)}</dd>
        </div>
      </dl>
      <p className="quiet-note">
        Uses recorded balances across all wallets, including savings and credit
        debt. Future income is excluded until confirmed. Your reserve is set in
        Settings. This is a planning estimate; unrecorded spending is not
        included.
      </p>
    </section>
  );
}
export function RecurringHub({ s, cash, onSave }: Props) {
  const [income, setIncome] = useState<IncomeSchedule | "new" | null>(null),
    [review, setReview] = useState<ExpectedPayment | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = (s.expectedPayments || [])
    .filter((e) => e.status === "expected")
    .sort((a, b) => b.date.localeCompare(a.date));
  const history = (s.expectedPayments || [])
    .filter((e) => e.status !== "expected")
    .slice(-30)
    .reverse();
  async function save(next: State, message: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (await onSave(next, message)) {
        setIncome(null);
        setReview(null);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function confirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!review) return;
    try {
      void save(
        resolveExpected(
          s,
          review.id,
          true,
          cents(String(new FormData(e.currentTarget).get("amount"))),
        ),
        "Payment confirmed. Wallet updated.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function saveIncome(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const f = new FormData(e.currentTarget),
        get = (k: string) => String(f.get(k) || "");
      const r: IncomeSchedule = {
        id: income !== "new" && income ? income.id : uid(),
        name: get("name").trim(),
        amount: cents(get("amount")),
        date: get("date"),
        cadence: get("cadence") as IncomeSchedule["cadence"],
        account: get("account"),
        active: true,
        anchorDay:
          income && income !== "new" && income.date === get("date")
            ? income.anchorDay || Number(get("date").slice(8))
            : Number(get("date").slice(8)),
      };
      void save(
        {
          ...s,
          recurringIncome:
            income === "new"
              ? [...(s.recurringIncome || []), r]
              : (s.recurringIncome || []).map((x) => (x.id === r.id ? r : x)),
        },
        "Recurring income saved.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="recurring-hub">
      <section className="v2-panel">
        <div className="v2-section-heading">
          <div>
            <h3>
              Payment inbox{" "}
              {pending.length > 0 && (
                <span className="count-pill">{pending.length}</span>
              )}
            </h3>
            <p>Expected, until you confirm.</p>
          </div>
          <Icon name="CircleCheck" />
        </div>
        {!pending.length && (
          <p className="form-help">
            You’re all caught up. Enable Autopay on a bill to queue due payments
            for review.
          </p>
        )}
        {pending.map((e) => (
          <div className="expected-row" key={e.id}>
            <span>
              <b>{e.title}</b>
              <small>
                {e.date} · Expected {e.kind === "income" ? "income" : "charge"}
              </small>
            </span>
            <strong>{cash(e.amount)}</strong>
            <button
              className="secondary small"
              onClick={() => {
                setError("");
                setReview(e);
              }}
            >
              Review
            </button>
          </div>
        ))}
        <p className="quiet-note">
          Due entries are prepared when Gareeb opens or resumes. No bank
          connection, automatic charge or wallet deduction occurs.
        </p>
      </section>
      <section className="v2-panel">
        <div className="v2-section-heading">
          <h3>Recurring income</h3>
          <button
            className="text-button"
            onClick={() => {
              setError("");
              setIncome("new");
            }}
          >
            <Icon name="Plus" size={16} />
            Add income
          </button>
        </div>
        {(s.recurringIncome || []).map((r) => (
          <div className="expected-row" key={r.id}>
            <button className="group-history-main" onClick={() => setIncome(r)}>
              <b>{r.name}</b>
              <small>
                {r.active ? `${r.cadence} · Next ${r.date}` : "Paused"}
              </small>
            </button>
            <strong>{cash(r.amount)}</strong>
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                void save(
                  {
                    ...s,
                    recurringIncome: s.recurringIncome!.map((x) =>
                      x.id === r.id
                        ? {
                            ...x,
                            active: !x.active,
                            date: !x.active && x.date < day() ? day() : x.date,
                          }
                        : x,
                    ),
                  },
                  r.active
                    ? "Income schedule paused."
                    : "Income schedule resumed.",
                )
              }
            >
              {r.active ? "Pause" : "Resume"}
            </button>
          </div>
        ))}
        {!s.recurringIncome?.length && (
          <p className="form-help">
            Salary, allowance or regular freelance payments—review each arrival
            before it reaches your balance.
          </p>
        )}
      </section>
      {history.length > 0 && (
        <details className="v3-details">
          <summary>Recent payment history</summary>
          {history.map((e) => (
            <div className="expected-row" key={e.id}>
              <span>
                <b>{e.title}</b>
                <small>
                  {e.date} ·{" "}
                  {e.status === "confirmed" ? "Confirmed" : "Not charged"}
                </small>
              </span>
              <strong>{cash(e.amount)}</strong>
            </div>
          ))}
        </details>
      )}
      {(income || review) && (
        <Modal
          title={
            review
              ? "Review expected payment"
              : income === "new"
                ? "Add recurring income"
                : "Edit recurring income"
          }
          onClose={() => {
            if (!busy) {
              setIncome(null);
              setReview(null);
            }
          }}
        >
          {review ? (
            <form className="v2-form" onSubmit={confirm}>
              <h3>{review.title}</h3>
              <p className="form-help">
                Scheduled for {review.date}. Confirm only after the payment
                actually happened. You can correct the charged amount below.
              </p>
              <Field label="Actual payment amount">
                <input
                  name="amount"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  defaultValue={review.amount / 100}
                  required
                />
              </Field>
              <button className="primary" disabled={busy}>
                Confirm {review.kind === "income" ? "received" : "paid"}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void save(
                    resolveExpected(s, review.id, false),
                    "Marked as not charged. Wallet unchanged.",
                  )
                }
              >
                Did not happen
              </button>
            </form>
          ) : (
            <form className="v2-form" onSubmit={saveIncome}>
              <Field label="Income name">
                <input
                  name="name"
                  maxLength={100}
                  placeholder="Salary"
                  defaultValue={income !== "new" ? income?.name : ""}
                  required
                />
              </Field>
              <Field label="Income amount">
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  defaultValue={
                    income !== "new" ? (income?.amount || 0) / 100 : ""
                  }
                  required
                />
              </Field>
              <div className="form-grid">
                <Field label="Next income date">
                  <input
                    name="date"
                    type="date"
                    min="2000-01-01"
                    defaultValue={income !== "new" ? income?.date : day()}
                    required
                  />
                </Field>
                <Field label="Income repeats">
                  <select
                    name="cadence"
                    defaultValue={
                      income !== "new" ? income?.cadence : "monthly"
                    }
                  >
                    <option value="monthly">Every month</option>
                    <option value="weekly">Every week</option>
                    <option value="yearly">Every year</option>
                  </select>
                </Field>
              </div>
              <Field label="Receive into">
                <select
                  name="account"
                  defaultValue={
                    income !== "new" ? income?.account : s.accounts[0].id
                  }
                >
                  {s.accounts.map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <button className="primary" disabled={busy}>
                Save income schedule
              </button>
            </form>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
