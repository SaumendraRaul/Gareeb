import { useMemo, type CSSProperties } from "react";
import { cat, day, type State, type Transaction } from "./model";
import { annualBillCost, calendarDays, weeklySummary } from "./extras";
import { Icon, Section } from "./ui";
import { Capacitor } from "@capacitor/core";
import { configureHaptics, feedback } from "./feedback";

type Cash = (amount: number) => string;
export function ExperienceSettings({
  s,
  onSave,
  onNotice,
}: {
  s: State;
  onSave: (s: State, message: string) => void;
  onNotice: (message: string) => void;
}) {
  return (
    <div className="experience-settings">
      <div className="experience-heading">
        <Icon name="Sparkles" size={20} />
        <span>
          <b>Feel a little more connected</b>
          <small>Make Gareeb comfortable for you.</small>
        </span>
      </div>
      <label className="toggle-row">
        <span>
          <b>Haptic feedback</b>
          <small>Gentle taps and save confirmations on your phone</small>
        </span>
        <input
          aria-label="Haptic feedback"
          role="switch"
          type="checkbox"
          checked={s.settings.haptics !== false}
          onChange={(e) => {
            configureHaptics(e.target.checked);
            onSave(
              { ...s, settings: { ...s.settings, haptics: e.target.checked } },
              "Haptic preference saved.",
            );
          }}
        />
      </label>
      <label className="toggle-row">
        <span>
          <b>Reduce motion</b>
          <small>Your system’s reduced-motion preference also applies.</small>
        </span>
        <input
          aria-label="Reduce motion"
          role="switch"
          type="checkbox"
          checked={!!s.settings.reducedMotion}
          onChange={(e) =>
            onSave(
              {
                ...s,
                settings: { ...s.settings, reducedMotion: e.target.checked },
              },
              "Motion preference saved.",
            )
          }
        />
      </label>
      <button
        type="button"
        className="text-button"
        disabled={s.settings.haptics === false}
        onClick={() => {
          void feedback("success");
          onNotice(
            Capacitor.isNativePlatform()
              ? "Haptic preview sent to your device."
              : "Haptics are available in the Android app.",
          );
        }}
      >
        Try a gentle pulse <Icon name="Sparkles" size={15} />
      </button>
    </div>
  );
}
export function QuickEntries({
  s,
  cash,
  onUse,
  onRemove,
  onAdd,
}: {
  s: State;
  cash: Cash;
  onUse: (t: Transaction) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <section className="quick-entries" aria-label="Transaction shortcuts">
      <div className="quick-heading">
        <span>
          <Icon name="Sparkles" size={16} /> YOUR EVERYDAY SHORTCUTS
        </span>
        <button className="text-button" onClick={onAdd}>
          New entry <Icon name="Plus" size={15} />
        </button>
      </div>
      {(s.shortcuts || []).length ? (
        <div className="shortcut-track">
          {s.shortcuts!.map((t) => (
            <div className="shortcut-chip" key={t.id}>
              <button
                onClick={() => onUse(t)}
                aria-label={`Use shortcut ${t.title}`}
              >
                <span
                  className="shortcut-icon"
                  style={{
                    background: cat(t.category, s).tint,
                    color: cat(t.category, s).color,
                  }}
                >
                  <Icon
                    name={
                      t.kind === "income"
                        ? "ArrowDownLeft"
                        : t.kind === "transfer"
                          ? "ArrowLeftRight"
                          : cat(t.category, s).icon
                    }
                    size={18}
                  />
                </span>
                <span>
                  <b>{t.title}</b>
                  <small>
                    {cash(t.amount)} · {t.kind}
                  </small>
                </span>
              </button>
              <button
                className="shortcut-remove"
                aria-label={`Remove shortcut ${t.title}`}
                onClick={() => onRemove(t.id)}
              >
                <Icon name="X" size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <button className="shortcut-empty" onClick={onAdd}>
          <span className="shortcut-icon">
            <Icon name="Coffee" />
          </span>
          <span>
            <b>Your usual, without the typing.</b>
            <small>
              Save a transaction as a shortcut. Review it before adding.
            </small>
          </span>
          <Icon name="ArrowRight" size={18} />
        </button>
      )}
    </section>
  );
}

export function WeekReview({ s, cash }: { s: State; cash: Cash }) {
  const week = useMemo(() => weeklySummary(s.transactions), [s.transactions]);
  const delta = week.before
    ? Math.round((Math.abs(week.current - week.before) / week.before) * 100)
    : null;
  return (
    <Section
      title="Your seven-day check-in"
      sub="Small patterns. A clearer picture."
      className="week-review"
      action={
        <span className="pill">
          <Icon name="CalendarDays" size={13} />
          Last 7 days
        </span>
      }
    >
      <div className="week-hero">
        <div>
          <span>Recorded spending</span>
          <strong>{cash(week.current)}</strong>
          <p>
            {delta === null
              ? "Your first week of perspective starts here."
              : `${delta}% ${week.current <= week.before ? "less" : "more"} than the previous 7 days`}
          </p>
        </div>
        <div className="week-orbit" aria-hidden="true">
          <Icon name="Sprout" size={36} />
          <i />
          <i />
        </div>
      </div>
      <div className="week-details">
        <div>
          <b>{week.count}</b>
          <span>expenses tracked</span>
        </div>
        <div>
          <b>
            {week.quietDays}
            <small> / {week.days}</small>
          </b>
          <span>days with no recorded spend</span>
        </div>
      </div>
      <div className="merchant-spotlight">
        <Icon name="ShoppingBag" size={18} />
        <span>
          {week.top ? (
            <>
              Most spent at <b>{week.top.title}</b>
            </>
          ) : (
            "Log a few expenses to discover your patterns."
          )}
        </span>
        {week.top && <strong>{cash(week.top.amount)}</strong>}
      </div>
      <p className="feature-note">
        Today and the previous six days. Only recorded transactions are
        included.
      </p>
    </Section>
  );
}

export function SpendCalendar({
  s,
  selected,
  selectedDay,
  cash,
  onSelect,
}: {
  s: State;
  selected: string;
  selectedDay: string;
  cash: Cash;
  onSelect: (date: string) => void;
}) {
  const days = useMemo(
    () => calendarDays(s.transactions, selected),
    [s.transactions, selected],
  );
  const offset = (new Date(selected + "-01T12:00:00").getDay() + 6) % 7;
  const max = Math.max(1, ...days.map((d) => d.expense));
  const today = day();
  const picked = days.find((d) => d.date === selectedDay);
  return (
    <Section
      title="Your spending calendar"
      sub="Tap a day to explore its transactions."
      className="spend-calendar"
      action={
        <button
          className="text-button"
          onClick={() => onSelect("")}
          disabled={!selectedDay}
        >
          Show full month
        </button>
      }
    >
      <div className="calendar-weekdays" aria-hidden="true">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {Array.from({ length: offset }, (_, i) => (
          <span key={"blank" + i} />
        ))}
        {days.map((d) => (
          <button
            key={d.date}
            disabled={d.date > today}
            className={`calendar-day ${selectedDay === d.date ? "chosen" : ""} ${d.date === today ? "today" : ""}`}
            style={
              {
                "--heat": d.expense ? 0.12 + (0.7 * d.expense) / max : 0,
              } as CSSProperties
            }
            onClick={() => onSelect(selectedDay === d.date ? "" : d.date)}
            aria-pressed={selectedDay === d.date}
            aria-label={`${d.date}: ${cash(d.expense)} spent, ${d.count} transactions`}
          >
            <b>{Number(d.date.slice(-2))}</b>
            <span>{d.expense ? cash(d.expense) : d.income ? "+" : "·"}</span>
            {d.income > 0 && <i aria-hidden="true" />}
          </button>
        ))}
      </div>
      <div className="calendar-key">
        <span>
          <i /> Less spending
        </span>
        <span className="heat-scale">
          <i />
          <i />
          <i />
        </span>
        <span>More spending</span>
      </div>
      {picked && (
        <div className="calendar-summary" role="status">
          <strong>
            {new Date(picked.date + "T12:00:00").toLocaleDateString("en", {
              month: "short",
              day: "numeric",
            })}
          </strong>
          <span>{picked.count} entries</span>
          <span>
            Spent <b>{cash(picked.expense)}</b>
          </span>
          <span>
            Received <b>{cash(picked.income)}</b>
          </span>
        </div>
      )}
    </Section>
  );
}

export function RecurringCosts({ s, cash }: { s: State; cash: Cash }) {
  const annual = annualBillCost(s.bills);
  return (
    <div className="recurring-costs">
      <span className="recurring-symbol">
        <Icon name="Repeat2" size={24} />
      </span>
      <div>
        <span>Your recurring commitments</span>
        <strong>
          {cash(annual)}
          <small> / year</small>
        </strong>
        <p>
          {cash(Math.round(annual / 12))} monthly equivalent · active bills only
        </p>
      </div>
      <p className="feature-note">
        Estimate assumes 52 weekly or 12 monthly payments. One-offs and price
        changes aren’t included.
      </p>
    </div>
  );
}
