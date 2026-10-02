import { render } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useMailKeyboardShortcuts } from "./useMailKeyboardShortcuts";
import type { Thread } from "@/lib/mailbox";

function Harness({
  thread,
  handlers,
}: {
  thread: Thread | null;
  handlers: Parameters<typeof useMailKeyboardShortcuts>[3];
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  useMailKeyboardShortcuts(searchRef, thread, { mutate: vi.fn() } as never, handlers);
  return <input ref={searchRef} aria-label="Search this list" />;
}

const thread: Thread = {
  id: "t1",
  mailboxId: "m1",
  folderId: "f1",
  subject: "Hi",
  messageCount: 1,
  hasAttachments: false,
  read: true,
  starred: false,
  lastMessageAt: "2026-01-01T00:00:00Z",
  lastMessageDirection: "INBOUND",
};

describe("useMailKeyboardShortcuts", () => {
  it("opens compose on c", () => {
    const onCompose = vi.fn();
    render(<Harness thread={null} handlers={{ onFocusSearch: vi.fn(), onToggleShortcutSheet: vi.fn(), onCompose }} />);
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "c", bubbles: true }));
    expect(onCompose).toHaveBeenCalled();
  });

  it("snoozes the open thread on b", () => {
    const onSnooze = vi.fn();
    render(
      <Harness
        thread={thread}
        handlers={{
          onFocusSearch: vi.fn(),
          onToggleShortcutSheet: vi.fn(),
          onCompose: vi.fn(),
          onSnooze,
        }}
      />,
    );
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "b", bubbles: true }));
    expect(onSnooze).toHaveBeenCalled();
  });
});
