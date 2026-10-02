import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Group {
  title: string;
  items: { keys: string[]; label: string }[];
}

const GROUPS: Group[] = [
  {
    title: "Anywhere",
    items: [
      { keys: ["/"], label: "Search this list" },
      { keys: ["c"], label: "Write a letter" },
      { keys: ["?"], label: "Show this list" },
    ],
  },
  {
    title: "In the list",
    items: [
      { keys: ["↓"], label: "Next letter" },
      { keys: ["↑"], label: "Previous letter" },
      { keys: ["Enter"], label: "Open the first letter" },
      { keys: ["Esc"], label: "Close the open letter" },
      { keys: ["x"], label: "Select or deselect the open letter" },
    ],
  },
  {
    title: "On the open letter",
    items: [
      { keys: ["s"], label: "Star, or remove the star" },
      { keys: ["u"], label: "Mark unread, or read" },
      { keys: ["r"], label: "Mark read" },
      { keys: ["e"], label: "Archive" },
      { keys: ["#"], label: "Move to trash" },
      { keys: ["b"], label: "Snooze" },
    ],
  },
];

export function ShortcutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="mr-sheet-scrim" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-sheet-title"
        className="mr-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mr-sheet__head">
          <h2 id="shortcut-sheet-title">Keyboard shortcuts</h2>
          <Button ref={close} variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
        </div>
        <div className="mr-sheet__body">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h3>{group.title}</h3>
              <dl>
                {group.items.map((item) => (
                  <div key={item.label}>
                    <dt>
                      {item.keys.map((key) => (
                        <kbd key={key}>{key}</kbd>
                      ))}
                    </dt>
                    <dd>{item.label}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
