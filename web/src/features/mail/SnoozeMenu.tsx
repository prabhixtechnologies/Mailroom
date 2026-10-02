import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { snoozePresets, snoozeUntilIso } from "@/lib/snooze";

export function SnoozeMenu({
  label,
  disabled,
  onPick,
  onClose,
  anchor,
}: {
  label: string;
  disabled?: boolean;
  onPick: (iso: string) => void;
  onClose: () => void;
  anchor: { x: number; y: number } | null;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const customId = useId();
  const [customValue, setCustomValue] = useState("");

  useEffect(() => {
    if (!anchor) return;
    panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    const onDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [anchor, onClose]);

  if (!anchor || disabled) return null;

  const presets = snoozePresets();
  const minLocal = new Date(Date.now() + 60_000);
  const minValue = toLocalInputValue(minLocal);

  const applyCustom = () => {
    if (!customValue) return;
    const picked = new Date(customValue);
    if (Number.isNaN(picked.getTime()) || picked.getTime() <= Date.now()) return;
    onPick(snoozeUntilIso(picked));
    onClose();
  };

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      aria-label={label}
      className="mr-snooze-menu"
      style={{ top: anchor.y, left: Math.max(8, anchor.x - 220) }}
    >
      <p className="mr-snooze-menu__title">Snooze until</p>
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          role="menuitem"
          className="mr-snooze-menu__item"
          onClick={() => {
            onPick(snoozeUntilIso(preset.until()));
            onClose();
          }}
        >
          <Clock className="size-4 shrink-0" aria-hidden />
          {preset.label}
        </button>
      ))}
      <div className="mr-snooze-menu__custom">
        <label htmlFor={customId}>Pick date and time</label>
        <input
          id={customId}
          type="datetime-local"
          min={minValue}
          value={customValue}
          onChange={(event) => setCustomValue(event.target.value)}
        />
        <Button type="button" size="sm" variant="secondary" disabled={!customValue} onClick={applyCustom}>
          Snooze
        </Button>
      </div>
    </div>,
    document.body,
  );
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function SnoozeTrigger({
  disabled,
  title,
  onOpen,
}: {
  disabled?: boolean;
  title: string;
  onOpen: (anchor: { x: number; y: number }) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled}
      title={title}
      aria-label={title}
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        onOpen({ x: box.left, y: box.bottom + 4 });
      }}
    >
      <Clock className="size-4" />
    </Button>
  );
}
