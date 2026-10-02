import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { BulkActionBar } from "./BulkActionBar";
import type { MailboxSummary, Thread } from "@/lib/mailbox";

vi.mock("@/lib/mailbox", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mailbox")>();
  return {
    ...actual,
    useBulkSetFlags: () => ({ isPending: false, mutate: vi.fn() }),
    useMoveThreads: () => ({ isPending: false, mutate: vi.fn() }),
    folderOfKind: actual.folderOfKind,
  };
});

const mailbox: MailboxSummary = {
  id: "m1",
  address: "you@example.com",
  name: "You",
  kind: "PERSONAL",
  mine: true,
  folders: [
    {
      id: "inbox",
      mailboxId: "m1",
      kind: "INBOX",
      name: "Inbox",
      parentId: null,
      sortOrder: 0,
      threadCount: 1,
      unreadCount: 1,
    },
    {
      id: "archive",
      mailboxId: "m1",
      kind: "ARCHIVE",
      name: "Archive",
      parentId: null,
      sortOrder: 1,
      threadCount: 0,
      unreadCount: 0,
    },
    {
      id: "trash",
      mailboxId: "m1",
      kind: "TRASH",
      name: "Trash",
      parentId: null,
      sortOrder: 2,
      threadCount: 0,
      unreadCount: 0,
    },
    {
      id: "spam",
      mailboxId: "m1",
      kind: "SPAM",
      name: "Spam",
      parentId: null,
      sortOrder: 3,
      threadCount: 0,
      unreadCount: 0,
    },
  ],
};

const thread: Thread = {
  id: "t1",
  mailboxId: "m1",
  folderId: "inbox",
  subject: "Hello",
  messageCount: 1,
  hasAttachments: false,
  read: false,
  starred: false,
  lastMessageAt: "2026-01-01T00:00:00Z",
  lastMessageDirection: "INBOUND",
};

describe("BulkActionBar", () => {
  it("names the toolbar and selection count", () => {
    render(
      <BulkActionBar
        selectedThreads={[thread]}
        mailbox={mailbox}
        readOnly={false}
        snoozedView={false}
        onClearSelection={vi.fn()}
      />,
    );
    expect(screen.getByRole("toolbar", { name: "Bulk actions" })).toBeInTheDocument();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("clears selection from the keyboard", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      <BulkActionBar
        selectedThreads={[thread]}
        mailbox={mailbox}
        readOnly={false}
        snoozedView={false}
        onClearSelection={onClear}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(onClear).toHaveBeenCalled();
  });
});
