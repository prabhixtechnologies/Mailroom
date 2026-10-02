const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

/** Splits comma/semicolon-separated address strings into trimmed parts. */
export function splitAddressField(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Lowercases and removes duplicate addresses across To/Cc/Bcc. */
export function dedupeRecipients(input: {
  to: string[];
  cc: string[];
  bcc: string[];
}): { to: string[]; cc: string[]; bcc: string[]; duplicatesRemoved: number } {
  const seen = new Set<string>();
  let duplicatesRemoved = 0;
  const take = (list: string[]) => {
    const out: string[] = [];
    for (const raw of list) {
      const normalized = raw.trim().toLowerCase();
      if (!normalized) continue;
      if (seen.has(normalized)) {
        duplicatesRemoved += 1;
        continue;
      }
      seen.add(normalized);
      out.push(normalized);
    }
    return out;
  };
  return {
    to: take(input.to),
    cc: take(input.cc),
    bcc: take(input.bcc),
    duplicatesRemoved,
  };
}

export function invalidAddresses(addresses: string[]): string[] {
  return addresses.filter((a) => !EMAIL.test(a.trim()));
}

export function joinAddressField(addresses: string[]): string {
  return addresses.join(", ");
}

export type ReplyMode = "REPLY" | "REPLY_ALL" | "FORWARD";

export function defaultReplyFields(
  mode: ReplyMode,
  latest: { fromAddress?: string | null; to?: string[]; cc?: string[] },
  ourAddresses: string[],
): { to: string; cc: string; subject?: string } {
  const ours = new Set(ourAddresses.map((a) => a.toLowerCase()));
  const from = latest.fromAddress?.trim().toLowerCase() ?? "";

  if (mode === "FORWARD") {
    return { to: "", cc: "" };
  }

  const to = from && !ours.has(from) ? from : "";
  if (mode === "REPLY") {
    return { to, cc: "" };
  }

  const ccSet = new Set<string>();
  for (const list of [latest.to ?? [], latest.cc ?? []]) {
    for (const addr of list) {
      const lower = addr.trim().toLowerCase();
      if (!lower || lower === to || ours.has(lower)) continue;
      ccSet.add(lower);
    }
  }
  return { to, cc: joinAddressField([...ccSet]) };
}
