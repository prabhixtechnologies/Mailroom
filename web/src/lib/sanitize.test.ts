import { describe, expect, it } from "vitest";
import { isolatedEmailDocument, sanitizeEmailHtml } from "./sanitize";

describe("sanitizeEmailHtml", () => {
  it("keeps the formatting a real message uses", () => {
    const html = sanitizeEmailHtml(
      '<p>Hello <b>there</b></p><blockquote>quoted</blockquote><a href="https://example.com">link</a>',
    );
    expect(html).toContain("<b>there</b>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain('href="https://example.com"');
  });

  it("removes script tags", () => {
    const html = sanitizeEmailHtml('<p>hi</p><script>fetch("/steal")</script>');
    expect(html).not.toContain("script");
    expect(html).toContain("<p>hi</p>");
  });

  it("removes event handlers, which are the version of this that looks harmless", () => {
    const html = sanitizeEmailHtml('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain("onerror");
  });

  it("rejects javascript: and data: URLs", () => {
    expect(sanitizeEmailHtml('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:");
    expect(sanitizeEmailHtml('<a href="data:text/html,<script>1</script>">x</a>')).not.toContain(
      "data:text/html",
    );
  });

  it("strips inline styles, which can cover the page with a clickable overlay", () => {
    const html = sanitizeEmailHtml('<div style="position:fixed;inset:0">x</div>');
    expect(html).not.toContain("style=");
  });

  it("drops forms, so a message cannot render a fake sign-in box", () => {
    const html = sanitizeEmailHtml('<form action="https://evil.test"><input name="password"></form>');
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
  });

  it("drops iframes", () => {
    expect(sanitizeEmailHtml('<iframe src="https://evil.test"></iframe>')).not.toContain("iframe");
  });

  it("blocks remote images by default", () => {
    const html = sanitizeEmailHtml('<img src="https://tracker.test/pixel.gif" alt="x">');
    expect(html).not.toMatch(/\ssrc="https:\/\/tracker\.test/);
    expect(html).toContain('data-blocked-src="https://tracker.test/pixel.gif"');
  });

  it("keeps remote images when explicitly allowed", () => {
    const html = sanitizeEmailHtml('<img src="https://tracker.test/pixel.gif">', {
      allowRemoteImages: true,
    });
    expect(html).toContain("https://tracker.test/pixel.gif");
  });

  it("keeps cid images without treating them as remote", () => {
    const html = sanitizeEmailHtml('<img src="cid:logo@mail">');
    expect(html).toContain('src="cid:logo@mail"');
  });
});

describe("sanitizeEmailHtml, isolated", () => {
  it("keeps the message's own CSS, which is the reason the iframe exists", () => {
    const html = sanitizeEmailHtml('<style>p{color:red}</style><p style="margin:0">x</p>', {
      isolated: true,
    });
    expect(html).toContain("<style>");
    expect(html).toContain('style="margin:0"');
  });

  it("still drops scripts and forms inside the frame", () => {
    const html = sanitizeEmailHtml('<script>1</script><form action="https://evil.test"></form>', {
      isolated: true,
    });
    expect(html).not.toContain("script");
    expect(html).not.toContain("form");
  });
});

describe("isolatedEmailDocument", () => {
  it("adds noopener, without which the opened page can navigate this one", () => {
    const doc = isolatedEmailDocument('<a href="https://example.com">x</a>', { dark: false });
    expect(doc).toContain('target="_blank"');
    expect(doc).toContain("noopener");
    expect(doc).toContain("noreferrer");
  });

  it("sets a base target, because a sandboxed frame cannot navigate the top window", () => {
    expect(isolatedEmailDocument("<p>x</p>", { dark: false })).toContain('<base target="_blank">');
  });

  it("carries the app's theme in, since the frame cannot read it", () => {
    expect(isolatedEmailDocument("<p>x</p>", { dark: true })).toContain("color-scheme: dark");
    expect(isolatedEmailDocument("<p>x</p>", { dark: false })).toContain("color-scheme: light");
  });
});
