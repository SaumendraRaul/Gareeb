import {
  useEffect,
  useRef,
  useId,
  isValidElement,
  cloneElement,
  type ReactNode,
} from "react";
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
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <path d="M26 11a13 13 0 1 0 3 17v-7H19" />
        <circle cx="29" cy="10" r="2.5" />
      </svg>
      <span>
        gareeb<span className="logo-dot">.</span>
      </span>
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
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const els = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button,input,select,textarea,[tabindex="0"]',
          ) || [],
        ).filter((e) => !e.hasAttribute("disabled"));
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
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
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
        <div className="sheet-handle" />
        <header>
          <div>
            <span className="eyebrow">A LITTLE MORE CLARITY</span>
            <h2>{title}</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
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
