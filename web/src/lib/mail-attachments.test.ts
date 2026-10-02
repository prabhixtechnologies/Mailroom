import { afterEach, describe, expect, it, vi } from "vitest";
import { describePendingAttachment, resolveDraftAttachmentRows } from "./mail-attachments";

describe("describePendingAttachment", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses pending attachment metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          fileId: "f1",
          filename: "invoice.pdf",
          contentType: "application/pdf",
          sizeBytes: 42,
          scanStatus: "CLEAN",
        }),
      })),
    );

    const meta = await describePendingAttachment("f1");
    expect(meta.filename).toBe("invoice.pdf");
    expect(meta.sizeBytes).toBe(42);
  });
});

describe("resolveDraftAttachmentRows", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps placeholder names when metadata fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 404,
        json: async () => ({ code: "NOT_FOUND", message: "missing" }),
      })),
    );

    const rows = await resolveDraftAttachmentRows(["gone"]);
    expect(rows).toEqual([{ fileId: "gone", filename: "Attachment", sizeBytes: 0 }]);
  });
});
