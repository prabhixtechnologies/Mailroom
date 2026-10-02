import type { FolderThreadFilters, MailboxMode, MailboxSummary } from "./mailbox";

export type MailVirtualView = "folder" | "starred" | "snoozed";

export type MailUrlState = {
  mode: MailboxMode;
  virtualView: MailVirtualView;
  mailboxId: string | null;
  folderId: string | null;
  threadId: string | null;
  compose: boolean;
  draftId: string | null;
  filters: FolderThreadFilters;
};

const EMPTY: MailUrlState = {
  mode: "mine",
  virtualView: "folder",
  mailboxId: null,
  folderId: null,
  threadId: null,
  compose: false,
  draftId: null,
  filters: {},
};

/** Reads deep-link query parameters for Mailroom (OneOps console links use the same names). */
export function parseMailUrlState(search: string): MailUrlState {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const mode = params.get("mode") === "company" ? "company" : "mine";
  const viewRaw = params.get("view");
  const virtualView: MailVirtualView =
    viewRaw === "starred" ? "starred" : viewRaw === "snoozed" ? "snoozed" : "folder";

  const q = params.get("q")?.trim();
  const unreadOnly = params.get("unread") === "1" || params.get("unreadOnly") === "true";
  const hasAttachment =
    params.get("attachments") === "1" || params.get("hasAttachment") === "true";

  const composeRaw = params.get("compose");
  const compose = composeRaw === "1" || composeRaw === "true";

  return {
    mode,
    virtualView,
    mailboxId: params.get("mailbox") || params.get("mailboxId"),
    folderId: params.get("folder") || params.get("folderId"),
    threadId: params.get("thread") || params.get("threadId"),
    compose,
    draftId: params.get("draft") || params.get("draftId"),
    filters: {
      ...(q ? { q } : {}),
      ...(unreadOnly ? { unreadOnly: true } : {}),
      ...(hasAttachment ? { hasAttachment: true } : {}),
    },
  };
}

export function buildMailUrlSearchParams(state: MailUrlState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.mode === "company") params.set("mode", "company");
  if (state.virtualView === "starred") params.set("view", "starred");
  if (state.virtualView === "snoozed") params.set("view", "snoozed");
  if (state.mailboxId) params.set("mailbox", state.mailboxId);
  if (state.virtualView === "folder" && state.folderId) params.set("folder", state.folderId);
  if (state.threadId) params.set("thread", state.threadId);
  if (state.compose) params.set("compose", "1");
  if (state.draftId) params.set("draft", state.draftId);
  if (state.filters.q) params.set("q", state.filters.q);
  if (state.filters.unreadOnly) params.set("unread", "1");
  if (state.filters.hasAttachment) params.set("attachments", "1");
  return params;
}

export function mailUrlStateEquals(a: MailUrlState, b: MailUrlState): boolean {
  return (
    a.mode === b.mode &&
    a.virtualView === b.virtualView &&
    a.mailboxId === b.mailboxId &&
    a.folderId === b.folderId &&
    a.threadId === b.threadId &&
    a.compose === b.compose &&
    a.draftId === b.draftId &&
    (a.filters.q ?? "") === (b.filters.q ?? "") &&
    Boolean(a.filters.unreadOnly) === Boolean(b.filters.unreadOnly) &&
    Boolean(a.filters.hasAttachment) === Boolean(b.filters.hasAttachment)
  );
}

/**
 * Resolves folder/mailbox ids from the sidebar once mailboxes have loaded. Unknown ids are ignored
 * so a stale bookmark falls back to the default inbox rather than an empty shell.
 */
export function resolveMailUrlState(
  parsed: MailUrlState,
  mailboxes: MailboxSummary[],
): {
  mode: MailboxMode;
  virtualView: MailVirtualView;
  mailbox: MailboxSummary | null;
  folderId: string | null;
  threadId: string | null;
  compose: boolean;
  draftId: string | null;
  filters: FolderThreadFilters;
} {
  if (mailboxes.length === 0) {
    return {
      mode: parsed.mode,
      virtualView: parsed.virtualView,
      mailbox: null,
      folderId: null,
      threadId: parsed.threadId,
      compose: parsed.compose,
      draftId: parsed.draftId,
      filters: parsed.filters,
    };
  }

  const mode = parsed.mode;
  const scoped =
    mode === "company" ? mailboxes : mailboxes.filter((m) => m.mine);
  const pool = scoped.length > 0 ? scoped : mailboxes;

  let mailbox =
    (parsed.mailboxId ? pool.find((m) => m.id === parsed.mailboxId) : undefined) ??
    pool.find((m) => m.mine) ??
    pool[0];

  let folderId = parsed.folderId;
  if (folderId && mailbox && !mailbox.folders.some((f) => f.id === folderId)) {
    folderId = null;
  }
  if (!folderId && parsed.virtualView === "folder" && mailbox) {
    const inbox = mailbox.folders.find((f) => f.kind === "INBOX") ?? mailbox.folders[0];
    folderId = inbox?.id ?? null;
  }

  return {
    mode,
    virtualView: parsed.virtualView,
    mailbox: mailbox ?? null,
    folderId: parsed.virtualView === "folder" ? folderId : null,
    threadId: parsed.threadId,
    compose: parsed.compose,
    draftId: parsed.draftId,
    filters: parsed.filters,
  };
}

export function emptyMailUrlState(): MailUrlState {
  return { ...EMPTY };
}
