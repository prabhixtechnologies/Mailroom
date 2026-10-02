import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FOLDER_THREAD_PAGE_SIZE,
  flattenThreadPages,
  folderThreadListSearchParams,
  invalidateMailboxAfterStreamEvent,
  isActivelySnoozed,
  mailboxKeys,
  normalizeFolderThreadFilters,
  threadListPageSchema,
  threadSchema,
} from "./mailbox";

describe("normalizeFolderThreadFilters", () => {
  it("drops empty search and trims text", () => {
    expect(normalizeFolderThreadFilters({ q: "  hello  ", unreadOnly: false })).toEqual({
      q: "hello",
    });
  });

  it("keeps boolean filters only when true", () => {
    expect(
      normalizeFolderThreadFilters({ unreadOnly: true, hasAttachment: true }),
    ).toEqual({ unreadOnly: true, hasAttachment: true });
  });
});

describe("folderThreadListSearchParams", () => {
  it("builds cursor page query string", () => {
    const params = folderThreadListSearchParams(
      "folder-1",
      { q: "invoice", unreadOnly: true, hasAttachment: true },
      "cursor-abc",
    );
    expect(params.get("folderId")).toBe("folder-1");
    expect(params.get("q")).toBe("invoice");
    expect(params.get("unreadOnly")).toBe("true");
    expect(params.get("hasAttachment")).toBe("true");
    expect(params.get("cursor")).toBe("cursor-abc");
    expect(params.get("limit")).toBe(String(DEFAULT_FOLDER_THREAD_PAGE_SIZE));
  });
});

describe("threadListPageSchema", () => {
  it("accepts a cursor page of threads", () => {
    const sample = {
      items: [
        {
          id: "t1",
          mailboxId: "m1",
          folderId: "f1",
          subject: "Hello",
          messageCount: 1,
          hasAttachments: false,
          read: true,
          starred: false,
          lastMessageAt: "2026-01-01T00:00:00Z",
          lastMessageDirection: "INBOUND",
        },
      ],
      nextCursor: "next",
      hasMore: true,
    };
    const parsed = threadListPageSchema.parse(sample);
    expect(parsed.items).toHaveLength(1);
    expect(threadSchema.parse(parsed.items[0]).subject).toBe("Hello");
    expect(parsed.nextCursor).toBe("next");
    expect(parsed.hasMore).toBe(true);
  });

  it("treats a missing next cursor as null", () => {
    const parsed = threadListPageSchema.parse({ items: [], hasMore: false });
    expect(parsed.nextCursor).toBeNull();
  });
});

describe("flattenThreadPages", () => {
  it("concatenates infinite-query pages in order", () => {
    const flat = flattenThreadPages({
      pages: [
        { items: [{ id: "a" } as never], nextCursor: "1", hasMore: true },
        { items: [{ id: "b" } as never], nextCursor: null, hasMore: false },
      ],
      pageParams: [null, "1"],
    });
    expect(flat.map((t) => t.id)).toEqual(["a", "b"]);
  });
});

describe("isActivelySnoozed", () => {
  it("is true only before the snooze time", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isActivelySnoozed({ snoozedUntil: future } as never, Date.now())).toBe(true);
    expect(isActivelySnoozed({ snoozedUntil: past } as never, Date.now())).toBe(false);
    expect(isActivelySnoozed({ snoozedUntil: null } as never)).toBe(false);
  });
});

describe("invalidateMailboxAfterStreamEvent", () => {
  it("invalidates sidebar, active folder lists, and open thread messages", () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    invalidateMailboxAfterStreamEvent(queryClient, {
      threadId: "thread-1",
      activeFolderId: "folder-9",
      selectedThreadId: "thread-1",
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["mailbox", "sidebar"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["mailbox", "folder", "folder-9"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: mailboxKeys.starred });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: mailboxKeys.messages("thread-1"),
    });
  });
});
