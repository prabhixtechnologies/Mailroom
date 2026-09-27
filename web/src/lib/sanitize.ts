import DOMPurify from "dompurify";

const REMOTE_IMAGE_SRC = /^https?:/i;

export type SanitizeEmailHtmlOptions = {
  /** When true, http(s) image sources are kept. Default false — remote images load only on explicit user action. */
  allowRemoteImages?: boolean;
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
    FORBID_TAGS: ["style", "form", "input", "button", "iframe", "object", "embed", "link", "meta"],
    FORBID_ATTR: ["style", "srcset", "formaction", "background"],
    // Anything not on this list is not a link a mail body has any business making. javascript: and
    // data: URLs in particular are how a sanitiser that only filters tags still gets bypassed.
    ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel|cid):/i,
    ADD_ATTR: ["target", "data-blocked-src"],
  });

  if (allowRemoteImages) {
    return purified;
  }

  const doc = new DOMParser().parseFromString(purified, "text/html");
  for (const img of doc.querySelectorAll("img")) {
    const src = img.getAttribute("src") ?? "";
    if (REMOTE_IMAGE_SRC.test(src)) {
      img.setAttribute("data-blocked-src", src);
      img.removeAttribute("src");
    }
  }
  return doc.body.innerHTML;
}

/**
 * Forces every link in a sanitised body to open in a new tab with the referrer stripped.
 *
 * <p>`target="_blank"` without `rel="noopener"` hands the opened page a handle on this one, which it can
 * use to navigate Mailroom somewhere else — a phishing page that appears in the tab the reader trusts.
 */
export function hardenLinks(container: HTMLElement): void {
  for (const anchor of container.querySelectorAll("a")) {
    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noopener noreferrer nofollow");
  }
}
