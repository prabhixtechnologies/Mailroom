import DOMPurify from "dompurify";

const REMOTE_IMAGE_SRC = /^https?:/i;

export type SanitizeEmailHtmlOptions = {
  /** When true, http(s) image sources are kept. Default false — remote images load only on explicit user action. */
  allowRemoteImages?: boolean;

  /**
   * Set only when the output goes into a sandboxed iframe, which lets the message keep its
   * own CSS. See {@link forbiddenTags} for why that is not safe anywhere else.
   */
  isolated?: boolean;
};

/**
 * Renders someone else's HTML without letting it run.
 *
 * <p>Mail bodies are the most hostile input a mail client handles: an attacker chooses every byte and
 * only has to get one message delivered. Rendering `bodyHtml` into the page without this is a standing
 * invitation to read the reader's session — which, since Mailroom holds an access token in memory, means
 * their whole mailbox.
 *
 * <p>Remote images are blocked by default so senders cannot infer read times from pixel loads. The reader
 * can opt in per message in the UI.
 */
export function sanitizeEmailHtml(html: string, options: SanitizeEmailHtmlOptions = {}): string {
  const allowRemoteImages = options.allowRemoteImages === true;
  const purified = DOMPurify.sanitize(html, {
    FORBID_TAGS: forbiddenTags(options),
    FORBID_ATTR: forbiddenAttributes(options),
    // Anything not on this list is not a link a mail body has any business making. javascript: and
    // data: URLs in particular are how a sanitiser that only filters tags still gets bypassed.
    ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel|cid):/i,
    ADD_ATTR: ["target", "data-blocked-src"],
    // `style` is not on DOMPurify's default allow-list, so dropping it from FORBID_TAGS is
    // not enough to get it back. DOMPurify still parses the CSS inside and strips anything
    // it will not vouch for, which is the behaviour we want — the iframe is the second line,
    // not the only one.
    ADD_TAGS: options.isolated === true ? ["style"] : [],
    // Without this, a body that opens with <style> loses it: DOMPurify parses the input as a
    // document and returns the body, and the HTML parser puts a leading <style> in the head.
    FORCE_BODY: options.isolated === true,
  });

  if (allowRemoteImages) {
    return purified;
  }

  // A <template>, not DOMParser. Parsing a fragment as a full document moves <style> into
  // <head>, so serializing `doc.body` afterwards silently threw the message's CSS away —
  // which made the isolated path pointless in exactly the case it exists for.
  const holder = document.createElement("template");
  holder.innerHTML = purified;
  for (const img of holder.content.querySelectorAll("img")) {
    const src = img.getAttribute("src") ?? "";
    if (REMOTE_IMAGE_SRC.test(src)) {
      img.setAttribute("data-blocked-src", src);
      img.removeAttribute("src");
    }
  }
  return holder.innerHTML;
}

/**
 * `style` is only safe to keep when the result is going into an isolated document.
 *
 * <p>In the app's own DOM a mail body's CSS is a live weapon even with every script removed:
 * `position:fixed;inset:0` covers the app with the sender's content, and selectors like
 * `button {}` or `[class*="mr-"] {}` restyle the chrome around the message. Dropping it is
 * the only option there, which is why message bodies rendered as flat text.
 *
 * <p>Inside a sandboxed iframe none of that reaches anything: `fixed` is fixed to the frame,
 * and the frame's selectors cannot see the parent document. So the frame gets real styling
 * and the inline path stays locked down.
 */
function forbiddenTags(options: SanitizeEmailHtmlOptions): string[] {
  const always = ["form", "input", "button", "iframe", "object", "embed", "link", "meta"];
  return options.isolated === true ? always : ["style", ...always];
}

function forbiddenAttributes(options: SanitizeEmailHtmlOptions): string[] {
  const always = ["srcset", "formaction", "background"];
  return options.isolated === true ? always : ["style", ...always];
}

/**
 * Wraps a sanitised body in a standalone document for an isolated frame.
 *
 * <p>Two things have to be done here rather than inside the frame, because the frame runs no
 * scripts at all:
 *
 * <ul>
 *   <li>`<base target="_blank">` — a sandboxed frame cannot navigate the top window, so a link
 *       without this simply does nothing when clicked.
 *   <li>the `rel` on every anchor, set while the body is still a string in this document.
 * </ul>
 *
 * <p>The stylesheet sets only the defaults an email expects and the host page's font, so a
 * message with no CSS of its own does not render in Times New Roman on white while the app
 * around it is in the product's type and dark theme.
 */
export function isolatedEmailDocument(bodyHtml: string, options: { dark: boolean }): string {
  const holder = document.createElement("template");
  holder.innerHTML = bodyHtml;
  for (const anchor of holder.content.querySelectorAll("a")) {
    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noopener noreferrer nofollow");
  }

  // px-allow-literal: this string is the whole document of a sandboxed iframe rendering
  // untrusted mail. Nothing inside it can see the app's stylesheet, so a var() would resolve to
  // nothing and the message would render as unstyled black on transparent. The dark/light pair
  // is passed in by the parent because the frame has no script to read prefers-color-scheme.
  const ink = options.dark ? "#e7e3df" : "#25211d";
  // px-allow-literal: same frame, same reason.
  const link = options.dark ? "#7dd3fc" : "#0e7490";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta name="referrer" content="no-referrer">
<base target="_blank">
<style>
  :root { color-scheme: ${options.dark ? "dark" : "light"}; }
  html, body { margin: 0; padding: 0; background: transparent; }
  body {
    color: ${ink};
    font: 15px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    overflow-wrap: break-word;
    word-break: break-word;
  }
  a { color: ${link}; }
  img, video, table { max-width: 100%; }
  img { height: auto; }
  table { border-collapse: collapse; }
  blockquote {
    margin: 0 0 0 0.5rem;
    padding-left: 0.85rem;
    border-left: 2px solid currentColor;
    opacity: 0.72;
  }
  pre { white-space: pre-wrap; }
</style></head>
<body>${holder.innerHTML}</body></html>`;
}

