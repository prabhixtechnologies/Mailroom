import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isolatedEmailDocument, sanitizeEmailHtml } from "@/lib/sanitize";
import { useTheme } from "@/lib/theme";

/**
 * A message body, rendered in a document of its own.
 *
 * <p>The body used to go straight into the app's DOM through `dangerouslySetInnerHTML`. DOMPurify
 * stopped it running anything, but same-document rendering has a second problem the sanitiser can
 * only answer by deleting: a mail body's CSS applies to the whole page. The old code therefore
 * stripped every `<style>` tag and `style` attribute, which is safe and means real email —
 * newsletters, receipts, anything with a layout — arrived as a pile of unstyled text.
 *
 * <p>A sandboxed iframe fixes both halves. The frame gets no `allow-scripts`, so nothing in the
 * message executes; it gets no `allow-forms`, so a phishing login cannot be submitted; and its CSS
 * is scoped to the frame, so the message can be styled without touching the app around it.
 *
 * <p>`allow-same-origin` is present and is not a hole here. The known danger is
 * `allow-scripts` *together with* `allow-same-origin`, which lets framed script reach out and
 * remove its own sandbox attribute. With scripts off there is no code inside to use the origin,
 * and the parent needs it to measure the content and size the frame — the alternative is a fixed
 * height with a nested scrollbar in the middle of the reading pane.
 */
export function EmailBody({
  html,
  allowRemoteImages,
}: {
  html: string;
  allowRemoteImages: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(120);
  const { theme } = useTheme();

  const srcDoc = useMemo(() => {
    const clean = sanitizeEmailHtml(html, { allowRemoteImages, isolated: true });
    return isolatedEmailDocument(clean, { dark: theme === "dark" });
  }, [html, allowRemoteImages, theme]);

  const measure = useCallback(() => {
    const doc = frame.current?.contentDocument;
    if (!doc?.body) return;
    // scrollHeight of the documentElement, not the body: a body with collapsed margins or a
    // floated-only layout reports 0.
    const next = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, 40);
    setHeight((current) => (Math.abs(current - next) > 1 ? next : current));
  }, []);

  useEffect(() => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;

    // Images settle after load and change the height, and a long newsletter can reflow more
    // than once. Observing is more reliable than measuring on the load event alone.
    const observer = new ResizeObserver(measure);
    if (doc.body) observer.observe(doc.body);
    for (const img of doc.images) {
      img.addEventListener("load", measure);
      img.addEventListener("error", measure);
    }
    measure();

    return () => {
      observer.disconnect();
      for (const img of doc.images) {
        img.removeEventListener("load", measure);
        img.removeEventListener("error", measure);
      }
    };
  }, [srcDoc, measure]);

  return (
    <iframe
      ref={frame}
      title="Message content"
      srcDoc={srcDoc}
      onLoad={measure}
      // No allow-scripts, no allow-forms, no allow-top-navigation. allow-popups plus
      // allow-popups-to-escape-sandbox is what makes a link open in a normal tab instead of
      // one that inherits this sandbox.
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      loading="lazy"
      className="w-full border-0 bg-transparent"
      style={{ height }}
    />
  );
}
