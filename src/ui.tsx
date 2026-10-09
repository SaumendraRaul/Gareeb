import {
  useEffect,
  useRef,
  useId,
  useState,
  useCallback,
  isValidElement,
  cloneElement,
  type ReactNode,
} from "react";
import { feedback } from "./feedback";
import brand from "./brand.json";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  X,
  House,
  ChartNoAxesCombined,
  Wallet,
  Target,
  Settings,
  Bell,
  Search,
  SlidersHorizontal,
  Download,
  Upload,
  ShieldCheck,
  Leaf,
  Sparkles,
  Coffee,
  Utensils,
  ShoppingBasket,
  ShoppingBag,
  TramFront,
  Clapperboard,
  HeartPulse,
  BookOpen,
  Shapes,
  CreditCard,
  Banknote,
  CalendarDays,
  Repeat2,
  Users,
  Check,
  CheckCheck,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Paperclip,
  CircleHelp,
  TrendingUp,
  Menu,
  CircleCheck,
  CircleAlert,
  Sprout,
  Ellipsis,
  RotateCcw,
  Share2,
  Handshake,
  Receipt,
  ChevronUp,
  LockKeyhole,
  Plane,
  Gift,
  Dog,
  Dumbbell,
} from "lucide-react";
const icons = {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  X,
  House,
  ChartNoAxesCombined,
  Wallet,
  Target,
  Settings,
  Bell,
  Search,
  SlidersHorizontal,
  Download,
  Upload,
  ShieldCheck,
  Leaf,
  Sparkles,
  Coffee,
  Utensils,
  ShoppingBasket,
  ShoppingBag,
  TramFront,
  Clapperboard,
  HeartPulse,
  BookOpen,
  Shapes,
  CreditCard,
  Banknote,
  CalendarDays,
  Repeat2,
  Users,
  Check,
  CheckCheck,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Paperclip,
  CircleHelp,
  TrendingUp,
  Menu,
  CircleCheck,
  CircleAlert,
  Sprout,
  Ellipsis,
  RotateCcw,
  Share2,
  Handshake,
  Receipt,
  ChevronUp,
  LockKeyhole,
  Plane,
  Gift,
  Dog,
  Dumbbell,
};
export function Icon({
  name,
  size = 20,
  ...props
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const I = icons[name as keyof typeof icons] || Shapes;
  return <I size={size} strokeWidth={1.7} {...props} />;
}
export function Logo() {
  return (
    <span className="logo">
      <svg viewBox="22 12 84 96" aria-hidden="true" focusable="false">
        {brand.paths.map(({ role, d }) => (
          <path key={role} className={`brand-${role}`} d={d} />
        ))}
      </svg>
      <span>gareeb</span>
    </span>
  );
}
export function Section({
  title,
  sub,
  action,
  children,
  className = "",
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name="Sprout" size={28} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Progress({ value, color }: { value: number; color?: string }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={Math.min(100, Math.max(0, Math.round(value)))}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          background: color,
        }}
      />
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);
  const offset = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [exiting, setExiting] = useState(false);
  const dismiss = useCallback(() => {
    if (timer.current) return;
    void feedback();
    setExiting(true);
    const reduced =
      document.documentElement.dataset.motion === "reduced" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = setTimeout(onClose, reduced ? 0 : 160);
  }, [onClose]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
      if (e.key === "Tab") {
        const els = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button,input,select,textarea,[tabindex="0"]',
          ) || [],
        ).filter(
          (e) => !e.hasAttribute("disabled") && e.getClientRects().length > 0,
        );
        const first = els[0],
          last = els[els.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.removeEventListener("keydown", key);
      prev?.focus();
    };
  }, [dismiss]);
  return (
    <div
      className={`modal-backdrop ${exiting ? "is-exiting" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <button
          type="button"
          className="sheet-handle"
          aria-label="Close sheet"
          onClick={() => {
            if (offset.current < 5) dismiss();
          }}
          onPointerDown={(e) => {
            drag.current = e.clientY;
            offset.current = 0;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (drag.current === null) return;
            offset.current = Math.max(
              0,
              Math.min(260, e.clientY - drag.current),
            );
            ref.current?.style.setProperty(
              "--sheet-drag",
              `${offset.current}px`,
            );
          }}
          onPointerUp={(e) => {
            if (drag.current === null) return;
            drag.current = null;
            e.currentTarget.releasePointerCapture(e.pointerId);
            if (offset.current > 90) dismiss();
            else ref.current?.style.setProperty("--sheet-drag", "0px");
          }}
          onPointerCancel={() => {
            drag.current = null;
            offset.current = 0;
            ref.current?.style.setProperty("--sheet-drag", "0px");
          }}
        >
          <span />
        </button>
        <header>
          <div>
            <span className="eyebrow">A LITTLE MORE CLARITY</span>
            <h2>{title}</h2>
          </div>
          <button
            className="icon-button"
            onClick={dismiss}
            aria-label="Close dialog"
          >
            <Icon name="X" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <label className="field">
      <span id={id + "-label"}>{label}</span>
      {isValidElement<Record<string, unknown>>(children)
        ? cloneElement(children, {
            "aria-labelledby": id + "-label",
            "aria-describedby": hint ? id + "-hint" : undefined,
          })
        : children}
      {hint && <small id={id + "-hint"}>{hint}</small>}
    </label>
  );
}
