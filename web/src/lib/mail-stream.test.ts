import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  handleMailStreamEvent,
  mailStreamEventSchema,
  shouldRefetchOpenThreadMessages,
} from "./mail-stream";
import { mailboxKeys } from "./mailbox";

describe("mailStreamEventSchema", () => {
  it("parses type/payload envelopes from SSE", () => {
    const event = mailStreamEventSchema.parse({
      type: "new-message",
      payload: { threadId: "t1", messageId: "m1" },
    });
    expect(event.type).toBe("new-message");
    expect(event.payload).toEqual({ threadId: "t1", messageId: "m1" });
  });
});

describe("shouldRefetchOpenThreadMessages", () => {
  it("matches only the selected thread", () => {
    expect(shouldRefetchOpenThreadMessages("t1", "t1")).toBe(true);
    expect(shouldRefetchOpenThreadMessages("t1", "t2")).toBe(false);
    expect(shouldRefetchOpenThreadMessages(undefined, "t1")).toBe(false);
  });
});

describe("handleMailStreamEvent", () => {
  it("invalidates the open thread messages query on new-message", () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    handleMailStreamEvent(
      client,
      { type: "new-message", payload: { threadId: "t1", messageId: "m1" } },
      { selectedThreadId: "t1", activeFolderId: "f1" },
    );
    expect(spy).toHaveBeenCalledWith({ queryKey: mailboxKeys.messages("t1") });
  });
});
