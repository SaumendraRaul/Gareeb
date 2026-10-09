import {
  categories,
  categorySpend,
  inMonth,
  totals,
  shiftMonth,
  money,
  type State,
  type Transaction,
} from "./model";
export function IncomeSpark({ s, selected }: { s: State; selected: string }) {
  const values = Array.from(
    { length: 6 },
    (_, i) => totals(inMonth(s, shiftMonth(selected, i - 5))).income,
  );
  const max = Math.max(1, ...values);
  const d = values
    .map((v, i) => `${i ? "L" : "M"}${i * 38} ${35 - (v / max) * 27}`)
    .join(" ");
  return (
    <svg className="sparkline" viewBox="0 0 190 40" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
export function Trend({ s, selected }: { s: State; selected: string }) {
  const data = Array.from({ length: 6 }, (_, i) => {
    const m = shiftMonth(selected, i - 5);
    return { m, ...totals(inMonth(s, m)) };
  });
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  return (
    <div className="trend-chart">
      <div className="chart-legend">
        <span>
          <i className="dot income-dot" />
          Income
        </span>
        <span>
          <i className="dot expense-dot" />
          Expenses
        </span>
      </div>
      <div
        className="bar-chart"
        role="img"
        aria-label="Income and expenses for the past six months"
      >
        {data.map((d, i) => (
          <div className={`bar-group ${i === 5 ? "current" : ""}`} key={d.m}>
            <div
              className="bar-pair"
              title={`${d.m}: income ${money(d.income, s.settings.currency)}, expenses ${money(d.expense, s.settings.currency)}`}
            >
              <div
                className="bar income-bar"
                style={{ height: `${(d.income / max) * 100}%` }}
              />
              <div
                className="bar expense-bar"
                style={{ height: `${(d.expense / max) * 100}%` }}
              />
            </div>
            <span>
              {new Date(d.m + "-01T12:00:00").toLocaleDateString("en", {
                month: "short",
              })}
            </span>
            <span className="sr-only">
              Income {money(d.income, s.settings.currency)}. Expenses{" "}
              {money(d.expense, s.settings.currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
export function Donut({
  categoryList = categories,
  ts,
  currency,
  large = false,
  hideAmounts = false,
}: {
  ts: Transaction[];
  categoryList?: typeof categories;
  currency: string;
  large?: boolean;
  hideAmounts?: boolean;
}) {
  const total = totals(ts).expense;
  const data = categoryList
    .map((c) => ({ ...c, value: categorySpend(ts, c.id) }))
    .filter((c) => c.value)
    .sort((a, b) => b.value - a.value);
  let offset = 0;
  return (
    <div className={`donut-layout ${large ? "large" : ""}`}>
      <div className="donut">
        <svg viewBox="0 0 200 200" role="img" aria-label="Spending by category">
          <circle
            cx="100"
            cy="100"
            r="78"
            fill="none"
            stroke="var(--line)"
            strokeWidth="23"
          />
          {data.map((c) => {
            const fraction = c.value / total;
            const start = offset;
            offset += fraction;
            return (
              <circle
                key={c.id}
                cx="100"
                cy="100"
                r="78"
                fill="none"
                stroke={c.color}
                strokeWidth="23"
                strokeDasharray={`${Math.max(0, fraction * 490 - 4)} ${490}`}
                strokeDashoffset={-start * 490}
                transform="rotate(-90 100 100)"
              >
                <title>
                  {c.name}: {hideAmounts ? "••••" : money(c.value, currency)}
                </title>
              </circle>
            );
          })}
        </svg>
        <div className="donut-center">
          <span>Total spent</span>
          <strong>{hideAmounts ? "••••" : money(total, currency, true)}</strong>
        </div>
      </div>
      <div className="category-legend">
        {data.slice(0, large ? 9 : 4).map((c) => (
          <div key={c.id}>
            <span>
              <i className="dot" style={{ background: c.color }} />
              {c.name}
            </span>
            <b>{Math.round((c.value / total) * 100)}%</b>
          </div>
        ))}
        {!data.length && (
          <p className="muted">
            Your spending story starts with your first expense.
          </p>
        )}
        {!large && data.length > 4 && (
          <div className="muted">+ {data.length - 4} more categories</div>
        )}
      </div>
    </div>
  );
}
export function Daily({
  ts,
  selected,
  currency,
}: {
  ts: Transaction[];
  selected: string;
  currency: string;
}) {
  const days = new Date(
    Number(selected.slice(0, 4)),
    Number(selected.slice(5)),
    0,
  ).getDate();
  const values = Array.from(
    { length: days },
    (_, i) =>
      totals(ts.filter((t) => Number(t.date.slice(8)) === i + 1)).expense,
  );
  const max = Math.max(1, ...values);
  return (
    <>
      <div className="daily-chart">
        {values.map((v, i) => (
          <div
            key={i}
            style={{
              height: `${Math.max(3, (v / max) * 100)}%`,
              opacity: v ? 1 : 0.2,
            }}
            title={`${i + 1}: ${money(v, currency)}`}
          >
            <span className="sr-only">
              Day {i + 1}: {money(v, currency)}
            </span>
          </div>
        ))}
      </div>
      <div className="chart-axis">
        <span>
          1{" "}
          {new Date(selected + "-01T12:00:00").toLocaleDateString("en", {
            month: "short",
          })}
        </span>
        <span>15</span>
        <span>{days}</span>
      </div>
    </>
  );
}
