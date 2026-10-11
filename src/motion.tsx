import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export const prefersQuietMotion = () =>
  document.documentElement.dataset.motion === "reduced" ||
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const ease = "cubic-bezier(.22,.8,.24,1)";

/** One live view: exit, replace, enter. New taps always supersede old taps. */
export function useMotionView<T extends string, E extends HTMLElement = HTMLDivElement>(
  initial: T, order: readonly T[], resetScroll = false,
) {
  const [value, setValue] = useState(initial);
  const [target, setTarget] = useState(initial);
  const ref = useRef<E | null>(null);
  const current = useRef(value);
  const desired = useRef(initial);
  const sequence = useRef(0);
  const direction = useRef(1);
  const animation = useRef<Animation | null>(null);
  const entering = useRef(false);
  current.current = value;

  const select = useCallback((next: T) => {
    if (next === desired.current) return;
    desired.current = next;
    setTarget(next);
    const ticket = ++sequence.current;
    const el = ref.current;
    const previousStyle = el ? getComputedStyle(el) : null;
    const from = { opacity: previousStyle?.opacity || "1", transform: previousStyle?.transform || "none" };
    animation.current?.cancel();
    direction.current = order.indexOf(next) >= order.indexOf(current.current) ? 1 : -1;
    const commit = () => {
      if (sequence.current !== ticket) return;
      if (el) { el.inert = false; el.style.willChange = ""; }
      animation.current?.cancel();
      animation.current = null;
      entering.current = next !== current.current;
      if (resetScroll && entering.current) window.scrollTo({ top: 0, behavior: "instant" });
      setValue(next);
    };
    if (!el || prefersQuietMotion() || next === current.current || !el.getClientRects().length) {
      commit();
      if (el) el.dataset.phase = "idle";
      return;
    }
    el.inert = true;
    el.dataset.phase = "exiting";
    el.style.willChange = "transform, opacity";
    const exit = el.animate([from, { opacity: 0, transform: `translate3d(${-direction.current * 10}px,0,0)` }], {
      duration: 90, easing: "ease-out", fill: "forwards",
    });
    exit.id = "gareeb-view";
    animation.current = exit;
    void exit.finished.then(commit, () => {});
  }, [order, resetScroll]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !entering.current) return;
    entering.current = false;
    el.inert = false;
    if (prefersQuietMotion()) { el.dataset.phase = "idle"; return; }
    el.dataset.phase = "entering";
    el.style.willChange = "transform, opacity";
    const entry = el.animate([
      { opacity: 0, transform: `translate3d(${direction.current * 16}px,0,0)` },
      { opacity: 1, transform: "translate3d(0,0,0)" },
    ], { duration: 240, easing: ease });
    entry.id = "gareeb-view";
    animation.current = entry;
    void entry.finished.then(() => {
      if (animation.current !== entry) return;
      el.dataset.phase = "idle";
      el.style.willChange = "";
      animation.current = null;
    }, () => {});
  }, [value]);

  useEffect(() => () => {
    sequence.current++;
    animation.current?.cancel();
    if (ref.current) { ref.current.inert = false; ref.current.style.willChange = ""; }
  }, []);
  return { value, target, select, ref };
}

/** Measures only at selection/resize, then moves a single composited highlight. */
export function MovingHighlight({ selection }: { selection: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef<DOMRect | null>(null);
  const animation = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    const pill = ref.current;
    const parent = pill?.parentElement;
    if (!pill || !parent) return;
    const position = (animate: boolean) => {
      const active = parent.querySelector<HTMLElement>(":scope > button.active, :scope > button.selected");
      if (!active || !parent.getClientRects().length) {
        pill.style.opacity = "0";
        previous.current = null;
        return;
      }
      const old = previous.current ? pill.getBoundingClientRect() : null;
      animation.current?.cancel();
      const bounds = parent.getBoundingClientRect();
      // Layout dimensions stay stable while the button itself is being pressed.
      const x = active.offsetLeft;
      const y = active.offsetTop;
      const box = new DOMRect(bounds.left + parent.clientLeft + x - parent.scrollLeft,
        bounds.top + parent.clientTop + y - parent.scrollTop, active.offsetWidth, active.offsetHeight);
      Object.assign(pill.style, {
        opacity: "1", width: `${box.width}px`, height: `${box.height}px`,
        transform: `translate3d(${x}px,${y}px,0)`,
      });
      previous.current = box;
      if (!animate || !old || prefersQuietMotion()) return;
      animation.current = pill.animate([
        { transform: `translate3d(${x + old.left - box.left}px,${y + old.top - box.top}px,0) scale(${old.width / box.width},${old.height / box.height})` },
        { transform: `translate3d(${x}px,${y}px,0) scale(1,1)` },
      ], { duration: 280, easing: ease });
      animation.current.id = "gareeb-highlight";
    };
    position(true);
    let width = parent.clientWidth;
    let height = parent.clientHeight;
    const observer = new ResizeObserver(() => {
      if (width === parent.clientWidth && height === parent.clientHeight) return;
      width = parent.clientWidth;
      height = parent.clientHeight;
      position(false);
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, [selection]);
  useEffect(() => () => animation.current?.cancel(), []);
  return <span ref={ref} className="moving-highlight" aria-hidden="true" />;
}

/** Delegated press/release feedback covers existing buttons without delaying actions. */
export function useButtonMotion() {
  useEffect(() => {
    let pressed: HTMLButtonElement | null = null;
    let start = { x: 0, y: 0 };
    const running = new Map<HTMLButtonElement, Animation>();
    const buttonAt = (event: Event) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      return button && !button.disabled && !button.closest("[inert]") && !button.matches(".sheet-handle") ? button : null;
    };
    const play = (button: HTMLButtonElement, down: boolean) => {
      const scale = getComputedStyle(button).scale;
      running.get(button)?.cancel();
      if (prefersQuietMotion()) { running.delete(button); return; }
      const animation = button.animate([
        { scale: scale === "none" ? "1" : scale },
        { scale: down ? (button.matches(".transaction, .upcoming-row") ? ".99" : ".95") : "1" },
      ], { duration: down ? 85 : 220, easing: ease, fill: down ? "forwards" : "none" });
      running.set(button, animation);
      if (!down) void animation.finished.then(() => {
        if (running.get(button) === animation) running.delete(button);
      }, () => {});
    };
    const release = () => {
      if (pressed) play(pressed, false);
      pressed = null;
    };
    const down = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      release();
      start = { x: event.clientX, y: event.clientY };
      pressed = buttonAt(event);
      if (pressed) play(pressed, true);
    };
    const move = (event: PointerEvent) => {
      if (pressed && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) release();
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat || !["Enter", " "].includes(event.key)) return;
      pressed = buttonAt(event);
      if (pressed) play(pressed, true);
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointermove", move, { capture: true, passive: true });
    document.addEventListener("pointerup", release, true);
    document.addEventListener("pointercancel", release, true);
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("keyup", release, true);
    window.addEventListener("blur", release);
    const quiet = () => {
      if (!prefersQuietMotion()) return;
      running.forEach(animation => animation.cancel());
      running.clear();
      pressed = null;
      // Finish exits instead of cancelling them, so navigation still commits.
      document.getAnimations().filter(a => a.id.startsWith("gareeb-")).forEach(a => a.finish());
    };
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    media.addEventListener("change", quiet);
    const observer = new MutationObserver(quiet);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
    return () => {
      observer.disconnect();
      media.removeEventListener("change", quiet);
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", release, true);
      document.removeEventListener("pointercancel", release, true);
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("keyup", release, true);
      window.removeEventListener("blur", release);
      running.forEach(animation => animation.cancel());
    };
  }, []);
}
