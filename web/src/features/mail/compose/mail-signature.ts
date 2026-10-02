/** True when the editor body already contains the signature's visible text. */
export function bodyContainsSignature(bodyHtml: string, signatureHtml: string): boolean {
  const signatureText = htmlToPlain(signatureHtml).trim();
  if (!signatureText) return true;
  return htmlToPlain(bodyHtml).includes(signatureText);
}

/** Appends signature HTML once at the end of the compose body. */
export function appendSignatureHtml(bodyHtml: string, signatureHtml: string): string {
  if (!signatureHtml.trim()) return bodyHtml;
  if (bodyContainsSignature(bodyHtml, signatureHtml)) return bodyHtml;
  if (!bodyHtml.trim()) return signatureHtml;
  return `${bodyHtml}<p><br></p>${signatureHtml}`;
}

function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}
