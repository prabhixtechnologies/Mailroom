import { describe, expect, it } from "vitest";
import {
  dedupeRecipients,
  defaultReplyFields,
  invalidAddresses,
  splitAddressField,
} from "./mail-recipients";

describe("splitAddressField", () => {
  it("splits on commas and semicolons", () => {
    expect(splitAddressField("a@x.com; b@x.com, c@x.com")).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
    ]);
  });
});

describe("dedupeRecipients", () => {
  it("removes duplicates across fields", () => {
    const result = dedupeRecipients({
      to: ["A@x.com"],
      cc: ["a@x.com", "b@x.com"],
      bcc: ["B@x.com"],
    });
    expect(result.to).toEqual(["a@x.com"]);
    expect(result.cc).toEqual(["b@x.com"]);
    expect(result.bcc).toEqual([]);
    expect(result.duplicatesRemoved).toBe(2);
  });
});

describe("invalidAddresses", () => {
  it("flags malformed addresses", () => {
    expect(invalidAddresses(["good@example.com", "not-an-email"])).toEqual(["not-an-email"]);
  });
});

describe("defaultReplyFields", () => {
  it("reply-all excludes our addresses from cc", () => {
    const fields = defaultReplyFields(
      "REPLY_ALL",
      {
        fromAddress: "customer@example.com",
        to: ["me@acme.com", "customer@example.com"],
        cc: ["other@example.com", "alias@acme.com"],
      },
      ["me@acme.com", "alias@acme.com"],
    );
    expect(fields.to).toBe("customer@example.com");
    expect(fields.cc).toBe("other@example.com");
  });
});
