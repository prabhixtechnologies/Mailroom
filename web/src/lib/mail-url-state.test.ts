import { describe, expect, it } from "vitest";
import { previewMailboxes } from "./preview";
import {
  buildMailUrlSearchParams,
  parseMailUrlState,
  resolveMailUrlState,
} from "./mail-url-state";

describe("parseMailUrlState", () => {
  it("reads deep-link query parameters", () => {
    const parsed = parseMailUrlState(
      "?mode=company&folder=f1&mailbox=m1&thread=t9&compose=1&draft=d2&q=invoice&unread=1&attachments=1",
    );
    expect(parsed.mode).toBe("company");
    expect(parsed.folderId).toBe("f1");
    expect(parsed.mailboxId).toBe("m1");
    expect(parsed.threadId).toBe("t9");
    expect(parsed.compose).toBe(true);
    expect(parsed.draftId).toBe("d2");
    expect(parsed.filters).toEqual({
      q: "invoice",
      unreadOnly: true,
      hasAttachment: true,
    });
  });

  it("maps virtual views", () => {
    expect(parseMailUrlState("?view=starred").virtualView).toBe("starred");
    expect(parseMailUrlState("?view=snoozed").virtualView).toBe("snoozed");
  });
});

describe("buildMailUrlSearchParams", () => {
  it("round-trips the supported keys", () => {
    const built = buildMailUrlSearchParams({
      mode: "company",
      virtualView: "folder",
      mailboxId: "m1",
      folderId: "f1",
      threadId: "t1",
      compose: true,
      draftId: "d1",
      filters: { q: "hello", unreadOnly: true, hasAttachment: true },
    });
    expect(built.get("mode")).toBe("company");
    expect(built.get("mailbox")).toBe("m1");
    expect(built.get("folder")).toBe("f1");
    expect(built.get("thread")).toBe("t1");
    expect(built.get("compose")).toBe("1");
    expect(built.get("draft")).toBe("d1");
    expect(built.get("q")).toBe("hello");
    expect(built.get("unread")).toBe("1");
    expect(built.get("attachments")).toBe("1");
  });
});

describe("resolveMailUrlState", () => {
  it("falls back to inbox when folder id is unknown", () => {
    const mailboxes = previewMailboxes();
    const resolved = resolveMailUrlState(
      parseMailUrlState("?folder=missing"),
      mailboxes,
    );
    expect(resolved.folderId).toBe("preview-inbox");
  });
});
