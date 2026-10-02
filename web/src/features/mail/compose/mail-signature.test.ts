import { describe, expect, it } from "vitest";
import { appendSignatureHtml, bodyContainsSignature } from "./mail-signature";

describe("mail signature", () => {
  it("detects an existing signature", () => {
    expect(
      bodyContainsSignature("<p>Hi</p><p>Best, Team</p>", "<p>Best, Team</p>"),
    ).toBe(true);
  });

  it("appends only when missing", () => {
    const merged = appendSignatureHtml("<p>Hello</p>", "<p>Cheers</p>");
    expect(merged).toContain("Cheers");
    expect(appendSignatureHtml(merged, "<p>Cheers</p>")).toBe(merged);
  });
});
