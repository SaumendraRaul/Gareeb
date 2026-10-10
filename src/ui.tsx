import {
  useEffect,
  useLayoutEffect,
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
const closingSheets = new WeakMap<HTMLElement, Promise<void>>();
const reducedMotion = () =>
  document.documentElement.dataset.motion === "reduced" ||
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function closeSheet(backdrop: HTMLElement): Promise<void> {
  const existing = closingSheets.get(backdrop);
  if (existing) return existing;
  const sheet = backdrop.querySelector<HTMLElement>(".modal");
  const scrim = backdrop.querySelector<HTMLElement>(".modal-scrim");
  if (!sheet || reducedMotion() || !backdrop.getClientRects().length)
    return Promise.resolve();
  const transform = getComputedStyle(sheet).transform;
  const scrimOpacity = scrim ? getComputedStyle(scrim).opacity : "1";
  const mobile = window.matchMedia("(max-width: 700px)").matches;
  // Freeze the layout before blurring a focused input: keyboard resize events
  // must not move the closing sheet's base position halfway through its exit.
  backdrop.dataset.phase = "closing";
  const height = sheet.offsetHeight;
  sheet.style.height = `${height}px`;
  sheet.style.maxHeight = "none";
  for (const animation of sheet.getAnimations()) animation.cancel();
  for (const animation of scrim?.getAnimations() || []) animation.cancel();
  backdrop.style.pointerEvents = "auto";
  sheet.style.pointerEvents = "none";
  sheet.style.willChange = "transform";
  const active = document.activeElement;
  if (active instanceof HTMLElement && sheet.contains(active)) active.blur();
  const result = Promise.all([
    sheet
      .animate(
        [
          { transform, opacity: 1 },
          {
            transform: `translate3d(0,${mobile ? height + 32 : 24}px,0)`,
            opacity: mobile ? 1 : 0,
          },
        ],
        { duration: 230, easing: "cubic-bezier(.32,0,.67,1)", fill: "forwards" },
      )
      .finished.catch(() => {}),
    scrim
      ?.animate([{ opacity: scrimOpacity }, { opacity: 0 }], {
        duration: 230,
        fill: "forwards",
      })
      .finished.catch(() => {}),
  ]).then(() => {});
  closingSheets.set(backdrop, result);
  return result;
}
export async function dismissSheets() {
  await Promise.all(
    Array.from(document.querySelectorAll<HTMLElement>(".modal-backdrop")).map(
      closeSheet,
    ),
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
  const ref = useRef<HTMLDivElement>(null),
    backdropRef = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null),
    offset = useRef(0),
    draggingAt = useRef(0),
    dismissing = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const settleDrag = () => {
    const sheet = ref.current;
    if (!sheet) return;
    const transform = getComputedStyle(sheet).transform;
    sheet.getAnimations().forEach((a) => a.cancel());
    sheet.style.setProperty("--sheet-drag", "0px");
    const animation = sheet.animate(
      [{ transform }, { transform: "translate3d(0,0,0)" }],
      { duration: reducedMotion() ? 0 : 180, easing: "cubic-bezier(.2,.8,.2,1)" },
    );
    void animation.finished.then(() => {
      if (drag.current === null) sheet.style.willChange = "";
    }).catch(() => {});
  };
  const dismiss = useCallback(async () => {
    if (dismissing.current) return;
    dismissing.current = true;
    void feedback();
    if (backdropRef.current) await closeSheet(backdropRef.current);
    onCloseRef.current();
  }, []);
  useLayoutEffect(() => {
    const sheet = ref.current,
      backdrop = backdropRef.current;
    if (!sheet || !backdrop) return;
    const viewport = window.visualViewport;
    let resizeFrame = 0, startFrame = 0;
    const animations: Animation[] = [];
    const size = () => {
      if (backdrop.dataset.phase === "closing") return;
      backdrop.style.height = `${viewport?.height || window.innerHeight}px`;
      backdrop.style.top = `${viewport?.offsetTop || 0}px`;
    };
    const resize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        if (backdrop.dataset.phase !== "opening") size();
      });
    };
    // Set the viewport and scroll lock before the first rendered frame.
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    size();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    const scrim = backdrop.querySelector<HTMLElement>(".modal-scrim")!;
    if (!reducedMotion()) {
      const mobile = window.matchMedia("(max-width: 700px)").matches;
      const from = mobile ? "translate3d(0,100%,0)" : "translate3d(0,24px,0)";
      backdrop.dataset.phase = "opening";
      sheet.style.transform = from;
      sheet.style.willChange = "transform";
      scrim.style.opacity = "0";
      // Allow the opaque sheet to be painted in its own layer before moving it.
      startFrame = requestAnimationFrame(() => {
        startFrame = requestAnimationFrame(() => {
          if (backdrop.dataset.phase !== "opening") return;
          const slide = sheet.animate(
            [{ transform: from }, { transform: "translate3d(0,0,0)" }],
            { duration: 280, easing: "cubic-bezier(.22,.8,.24,1)" },
          );
          animations.push(slide, scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 }));
          sheet.style.transform = "";
          scrim.style.opacity = "";
          void slide.finished.then(() => {
            if (backdrop.dataset.phase !== "opening") return;
            backdrop.dataset.phase = "open";
            sheet.style.willChange = "";
            size();
          }).catch(() => {});
        });
      });
    } else backdrop.dataset.phase = "open";
    return () => {
      document.body.style.overflow = bodyOverflow;
      cancelAnimationFrame(startFrame);
      cancelAnimationFrame(resizeFrame);
      animations.forEach((a) => a.cancel());
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
    };
  }, []);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    ref.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (!ref.current?.getClientRects().length) return;
      if (e.key === "Escape") {
        e.preventDefault();
        void dismiss();
      }
      if (e.key === "Tab") {
        const els = Array.from(
          ref.current.querySelectorAll<HTMLElement>(
            'button,input,select,textarea,[tabindex="0"]',
          ),
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
      document.removeEventListener("keydown", key);
      if (prev?.isConnected) prev.focus({ preventScroll: true });
    };
  }, [dismiss]);
  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div className="modal-scrim" aria-hidden="true" />
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
            if (dismissing.current || !ref.current) return;
            const current = new DOMMatrixReadOnly(getComputedStyle(ref.current).transform).m42;
            if (backdropRef.current) backdropRef.current.dataset.phase = "open";
            ref.current.getAnimations().forEach((a) => a.cancel());
            ref.current.style.transform = "";
            ref.current.style.willChange = "transform";
            ref.current.style.setProperty("--sheet-drag", `${current}px`);
            draggingAt.current = performance.now();
            drag.current = e.clientY - current;
            offset.current = current;
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
            if (
              offset.current > 90 ||
              (offset.current > 25 &&
                offset.current /
                  Math.max(1, performance.now() - draggingAt.current) >
                  0.6)
            )
              void dismiss();
            else settleDrag();
          }}
          onPointerCancel={() => {
            drag.current = null;
            offset.current = 0;
            settleDrag();
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
