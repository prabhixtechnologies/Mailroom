import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/*
  Row verbs reachable by right-click, by long-press, and from the keyboard.

  The third implementation of this idea in the portfolio, which wants explaining rather than
  hiding. @prabhixtechnologies/ui has the canonical one, built on Radix; OneOps uses it. MobiStack cannot,
  because it has no Tailwind and every class in that version would resolve to nothing. This app
  does have Tailwind, but adding @prabhixtechnologies/ui here means adding its dozen Radix packages and a
  second preset whose alias names collide with the ones index.css already declares - a larger and
  riskier change than the menu is worth, made in passing.

  The honest factoring is to lift the gesture handling - which is all of the difficult part, and
  none of the rendering - into a headless hook that all three can import, and leave each surface
  its own panel. That is a change to @prabhixtechnologies/ui and its consumers, not to this file.

  Until then the contract is what is shared: the same verbs on the same three routes, and a
  visible trigger so the menu is discoverable. Infra/docs/UX-STANDARD.md § 3.2.
*/

export interface RowMenuAction {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => unknown;
  disabled?: boolean;
  /** Groups render in order, separated by a rule. Ungrouped actions come first. */
  group?: string;
}

const LONG_PRESS_MS = 500;
const PANEL_WIDTH = 240;

export function useRowMenu(actions: RowMenuAction[], label: string) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const usable = actions.some((action) => !action.disabled);

  const close = useCallback(() => setAt(null), []);
  const open = useCallback((point: { x: number; y: number }) => usable && setAt(point), [usable]);

  const cancelLongPress = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => cancelLongPress, [cancelLongPress]);

  useEffect(() => {
    if (!at) return;
    // Focus moves into the panel so the keyboard route does not end at a menu nobody is in.
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    const onDown = (event: MouseEvent) => {
      if (!panel.current?.contains(event.target as Node)) close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    // Closing on scroll rather than repositioning: the panel is anchored to a point on the
    // screen, and a list that moves underneath it leaves it pointing at a different row.
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", close, true);
    };
  }, [at, close]);

  const rowProps = {
    onContextMenu: (event: React.MouseEvent) => {
      if (!usable) return;
      event.preventDefault();
      open({ x: event.clientX, y: event.clientY });
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      // Shift+F10 and the Menu key are the keyboard equivalents of a right-click. Browsers are
      // inconsistent about turning either into a contextmenu event, so both are handled here.
      if (event.key !== "ContextMenu" && !(event.key === "F10" && event.shiftKey)) return;
      event.preventDefault();
      const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
      open({ x: box.left + 24, y: box.bottom - 8 });
    },
    onPointerDown: (event: React.PointerEvent) => {
      if (event.pointerType !== "touch" || !usable) return;
      const { clientX, clientY } = event;
      timer.current = window.setTimeout(() => {
        // Touch has no right-click, so the long press is its only route. The haptic is what
        // tells a finger the press registered before anything has painted.
        navigator.vibrate?.(10);
        open({ x: clientX, y: clientY });
      }, LONG_PRESS_MS);
    },
    onPointerUp: cancelLongPress,
    onPointerCancel: cancelLongPress,
    onPointerMove: cancelLongPress,
  };

  const groups = (() => {
    const order: string[] = [];
    const byGroup = new Map<string, RowMenuAction[]>();
    for (const action of actions) {
      const key = action.group ?? "";
      if (!byGroup.has(key)) {
        byGroup.set(key, []);
        order.push(key);
      }
      byGroup.get(key)!.push(action);
    }
    order.sort((a, b) => (a === "" ? -1 : b === "" ? 1 : 0));
    return order.map((key) => byGroup.get(key)!);
  })();

  const menu =
    at && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panel}
            role="menu"
            aria-label={label}
            className="fixed z-50 w-60 overflow-hidden rounded-md border border-border bg-surface-elevated py-1 shadow-lg"
            // Clamped so a right-click near an edge does not open a panel off-screen.
            style={{
              left: Math.max(8, Math.min(at.x, window.innerWidth - PANEL_WIDTH - 8)),
              top: Math.max(8, Math.min(at.y, window.innerHeight - (actions.length * 34 + 48))),
            }}
          >
            <p className="truncate px-3 py-1.5 text-xs text-text-muted">{label}</p>
            {groups.map((items, index) => (
              <div key={items[0]?.group ?? index} className={index > 0 ? "mt-1 border-t border-border pt-1" : ""}>
                {items.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    role="menuitem"
                    disabled={action.disabled}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text hover:bg-surface-muted disabled:opacity-50"
                    onClick={() => {
                      close();
                      void action.onSelect();
                    }}
                  >
                    {action.icon}
                    {action.label}
                  </button>
                ))}
              </div>
            ))}
          </div>,
          document.body,
        )
      : null;

  return { rowProps, menu, usable, openAt: open };
}
