import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, apiRequestVoid } from "./api-client";
import { cursorPageSchema } from "./cursor-page";

/**
 * The mailbox API, as Mailroom uses it.
 *
 * <p>Schemas rather than hand-written interfaces because the alternative is trusting a response and
 * finding out it changed shape three screens later, as an undefined property somewhere that reads like a
 * rendering bug. Parsing at the boundary makes a contract change a single clear error.
 */

export const folderKinds = [
  "INBOX",
  "SENT",
  "DRAFTS",
  "ARCHIVE",
  "TRASH",
  "SPAM",
  "CUSTOM",
] as const;

export type FolderKind = (typeof folderKinds)[number];

export const folderSchema = z.object({
  id: z.string(),
  mailboxId: z.string(),
  kind: z.enum(folderKinds),
  name: z.string(),
  parentId: z.string().nullish(),
  sortOrder: z.number(),
  colour: z.string().nullish(),
  threadCount: z.number(),
  unreadCount: z.number(),
});

export type Folder = z.infer<typeof folderSchema>;

export const mailboxSchema = z.object({
  id: z.string(),
  address: z.string(),
  name: z.string(),
  kind: z.enum(["SHARED", "PERSONAL", "SYSTEM"]),
  mine: z.boolean(),
  ownerUserId: z.string().nullish(),
  ownerLabel: z.string().nullish(),
  folders: z.array(folderSchema),
});

export type MailboxSummary = z.infer<typeof mailboxSchema>;

export const threadSchema = z.object({
  id: z.string(),
  mailboxId: z.string(),
  folderId: z.string().nullish(),
  subject: z.string(),
  snippet: z.string().nullish(),
  correspondent: z.string().nullish(),
  correspondentName: z.string().nullish(),
  messageCount: z.number(),
  hasAttachments: z.boolean(),
  read: z.boolean(),
  starred: z.boolean(),
  snoozedUntil: z.string().nullish(),
  lastMessageAt: z.string(),
  lastMessageDirection: z.enum(["INBOUND", "OUTBOUND"]),
});

export type Thread = z.infer<typeof threadSchema>;

export const threadListPageSchema = cursorPageSchema(threadSchema);
export type ThreadListPage = z.infer<typeof threadListPageSchema>;

export const DEFAULT_FOLDER_THREAD_PAGE_SIZE = 50;

export type FolderThreadFilters = {
  q?: string;
  unreadOnly?: boolean;
  hasAttachment?: boolean;
  from?: string;
  to?: string;
};

/** Stable query-key shape: omit empty filters so keys stay predictable. */
export function normalizeFolderThreadFilters(filters: FolderThreadFilters): FolderThreadFilters {
  const q = filters.q?.trim();
  const from = filters.from?.trim();
  const to = filters.to?.trim();
  return {
    ...(q ? { q } : {}),
    ...(filters.unreadOnly ? { unreadOnly: true } : {}),
    ...(filters.hasAttachment ? { hasAttachment: true } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
}

export function folderThreadListSearchParams(
  folderId: string,
  filters: FolderThreadFilters,
  cursor: string | null,
  limit = DEFAULT_FOLDER_THREAD_PAGE_SIZE,
): URLSearchParams {
  const params = new URLSearchParams({
    folderId,
    limit: String(limit),
  });
  const normalized = normalizeFolderThreadFilters(filters);
  if (normalized.q) params.set("q", normalized.q);
  if (normalized.unreadOnly) params.set("unreadOnly", "true");
  if (normalized.hasAttachment) params.set("hasAttachment", "true");
  if (normalized.from) params.set("from", normalized.from);
  if (normalized.to) params.set("to", normalized.to);
  if (cursor) params.set("cursor", cursor);
  return params;
}

export async function fetchFolderThreadPage(
  folderId: string,
  filters: FolderThreadFilters,
  cursor: string | null,
  limit = DEFAULT_FOLDER_THREAD_PAGE_SIZE,
): Promise<ThreadListPage> {
  const qs = folderThreadListSearchParams(folderId, filters, cursor, limit);
  return apiRequest(`/oneops/mailbox/folders/threads/page?${qs}`, threadListPageSchema);
}

export function flattenThreadPages(data: InfiniteData<ThreadListPage> | undefined): Thread[] {
  if (!data?.pages.length) return [];
  return data.pages.flatMap((page) => page.items);
}

export const messageSchema = z.object({
  id: z.string(),
  direction: z.enum(["INBOUND", "OUTBOUND"]),
  fromAddress: z.string().nullish(),
  fromName: z.string().nullish(),
  to: z.array(z.string()).default([]),
  cc: z.array(z.string()).default([]),
  subject: z.string().nullish(),
  snippet: z.string().nullish(),
  bodyText: z.string().nullish(),
  bodyHtml: z.string().nullish(),
  deliveryStatus: z.string().nullish(),
  occurredAt: z.string(),
  attachmentCount: z.number(),
});

export type Message = z.infer<typeof messageSchema>;

export const draftSchema = z.object({
  id: z.string(),
  threadId: z.string().nullish(),
  mailboxId: z.string().nullish(),
  replyMode: z.enum(["REPLY", "REPLY_ALL", "FORWARD"]),
  to: z.array(z.string()),
  cc: z.array(z.string()),
  bcc: z.array(z.string()),
  subject: z.string().nullish(),
  bodyHtml: z.string().nullish(),
  attachmentIds: z.array(z.string()),
  updatedAt: z.string(),
});

export type Draft = z.infer<typeof draftSchema>;

const composeResponseSchema = z.object({
  threadId: z.string(),
  messageId: z.string(),
  subject: z.string(),
});

const aliasSchema = z.object({
  id: z.string(),
  mailboxId: z.string(),
  address: z.string(),
  createdAt: z.string(),
});

export type Alias = z.infer<typeof aliasSchema>;

// -------------------------------------------------------------------------------------------------
// Queries
// -------------------------------------------------------------------------------------------------

export type MailboxMode = "mine" | "company";

export const mailboxKeys = {
  sidebar: (mode: MailboxMode = "mine") => ["mailbox", "sidebar", mode] as const,
  folderThreads: (folderId: string, filters: FolderThreadFilters = {}) =>
    ["mailbox", "folder", folderId, "threads", normalizeFolderThreadFilters(filters)] as const,
  thread: (threadId: string) => ["mailbox", "thread", threadId] as const,
  messages: (threadId: string) => ["mailbox", "messages", threadId] as const,
  drafts: ["mailbox", "drafts"] as const,
  starred: ["mailbox", "starred"] as const,
  snoozed: ["mailbox", "snoozed"] as const,
  aliases: (mailboxId: string) => ["mailbox", "aliases", mailboxId] as const,
};

/** Sidebar counts and every folder thread list (any filter set). */
export function invalidateMailboxThreadLists(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ["mailbox", "sidebar"] });
  void queryClient.invalidateQueries({ queryKey: ["mailbox", "folder"] });
  void queryClient.invalidateQueries({ queryKey: mailboxKeys.starred });
  void queryClient.invalidateQueries({ queryKey: mailboxKeys.snoozed });
}

export function invalidateMailboxAfterStreamEvent(
  queryClient: QueryClient,
  context: {
    threadId?: string;
    activeFolderId?: string | null;
    selectedThreadId?: string | null;
  },
): void {
  void queryClient.invalidateQueries({ queryKey: ["mailbox", "sidebar"] });
  if (context.activeFolderId) {
    void queryClient.invalidateQueries({
      queryKey: ["mailbox", "folder", context.activeFolderId],
    });
  } else {
    void queryClient.invalidateQueries({ queryKey: ["mailbox", "folder"] });
  }
  void queryClient.invalidateQueries({ queryKey: mailboxKeys.starred });
  void queryClient.invalidateQueries({ queryKey: mailboxKeys.snoozed });
  if (
    context.threadId &&
    context.selectedThreadId &&
    context.threadId === context.selectedThreadId
  ) {
    void queryClient.invalidateQueries({
      queryKey: mailboxKeys.messages(context.selectedThreadId),
    });
  }
}

export function useSidebar(mode: MailboxMode = "mine", enabled = true) {
  return useQuery({
    queryKey: mailboxKeys.sidebar(mode),
    queryFn: () =>
      apiRequest(
        mode === "company" ? "/oneops/mailbox?mode=company" : "/oneops/mailbox",
        z.array(mailboxSchema),
      ),
    enabled,
    // Folder counts go stale the moment mail arrives, and a wrong unread count is the single most
    // noticeable thing a mail client can get wrong.
    refetchInterval: 60_000,
  });
}

export function useFolderThreads(
  folderId: string | undefined,
  filters: FolderThreadFilters = {},
  enabled = true,
) {
  const normalized = normalizeFolderThreadFilters(filters);

  return useInfiniteQuery({
    queryKey: folderId
      ? mailboxKeys.folderThreads(folderId, normalized)
      : ["mailbox", "folder", "none"],
    queryFn: ({ pageParam }) =>
      fetchFolderThreadPage(folderId!, normalized, pageParam ?? null),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor ?? undefined : undefined),
    enabled: !!folderId && enabled,
    refetchInterval: 60_000,
    placeholderData: (previous) => previous,
  });
}

export function useStarred() {
  return useQuery({
    queryKey: mailboxKeys.starred,
    queryFn: () => apiRequest("/oneops/mailbox/starred", z.array(threadSchema)),
    refetchInterval: 60_000,
  });
}

export function useSnoozed() {
  return useQuery({
    queryKey: mailboxKeys.snoozed,
    queryFn: () => apiRequest("/oneops/mailbox/snoozed", z.array(threadSchema)),
    refetchInterval: 60_000,
  });
}

export type ThreadFlagPatch = {
  read?: boolean;
  starred?: boolean;
  snoozeUntil?: string;
  clearSnooze?: boolean;
};

export type BulkThreadFlagPatch = ThreadFlagPatch & {
  threadIds: string[];
};

/** True when the thread is hidden from the inbox until the snooze time passes. */
export function isActivelySnoozed(thread: Thread, now = Date.now()): boolean {
  if (!thread.snoozedUntil) return false;
  return new Date(thread.snoozedUntil).getTime() > now;
}

export function useThreadMessages(threadId: string | undefined) {
  return useQuery({
    queryKey: threadId ? mailboxKeys.messages(threadId) : ["mailbox", "messages", "none"],
    queryFn: () =>
      apiRequest(`/oneops/mailbox/threads/messages?threadId=${threadId}`, z.array(messageSchema)),
    enabled: !!threadId,
  });
}

/**
 * Every saved draft for the signed-in user.
 *
 * <p>Gated rather than always-on: the Drafts folder is the only place that renders these,
 * and fetching them on every mailbox view would be a request per navigation for a list
 * almost nobody is looking at.
 */
export function useDrafts(enabled = true) {
  return useQuery({
    queryKey: mailboxKeys.drafts,
    queryFn: () => apiRequest("/oneops/mailbox/drafts", z.array(draftSchema)),
    enabled,
  });
}

export function useAliases(mailboxId: string | undefined) {
  return useQuery({
    queryKey: mailboxId ? mailboxKeys.aliases(mailboxId) : ["mailbox", "aliases", "none"],
    queryFn: () => apiRequest(`/oneops/mailbox/aliases?mailboxId=${mailboxId}`, z.array(aliasSchema)),
    enabled: !!mailboxId,
  });
}

// -------------------------------------------------------------------------------------------------
// Mutations
// -------------------------------------------------------------------------------------------------

/**
 * Read, starred and snoozed.
 *
 * <p>Invalidates the sidebar as well as the list, because marking something read changes an unread count
 * a person is looking at in their peripheral vision. Leaving it stale is how a mail client ends up
 * claiming three unread messages in an empty inbox.
 */
export function useSetFlags() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { threadId: string } & ThreadFlagPatch) =>
      apiRequest(`/oneops/mailbox/threads/flags?threadId=${input.threadId}`, threadSchema, {
        method: "PATCH",
        body: {
          read: input.read,
          starred: input.starred,
          snoozeUntil: input.snoozeUntil,
          clearSnooze: input.clearSnooze,
        },
      }),
    onSuccess: () => {
      invalidateMailboxThreadLists(queryClient);
    },
  });
}

export function useBulkSetFlags() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BulkThreadFlagPatch) =>
      apiRequest(`/oneops/mailbox/threads/flags`, z.number(), {
        method: "POST",
        body: {
          threadIds: input.threadIds,
          read: input.read,
          starred: input.starred,
          snoozeUntil: input.snoozeUntil,
          clearSnooze: input.clearSnooze,
        },
      }),
    onSuccess: () => {
      invalidateMailboxThreadLists(queryClient);
    },
  });
}

export function useMoveThreads() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { folderId: string; threadIds: string[] }) =>
      apiRequest(`/oneops/mailbox/folders/move?folderId=${input.folderId}`, z.number(), {
        method: "POST",
        body: { threadIds: input.threadIds },
      }),
    onSuccess: () => {
      invalidateMailboxThreadLists(queryClient);
    },
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { mailboxId: string; name: string; parentId?: string }) =>
      apiRequest(`/oneops/mailbox/folders?mailboxId=${input.mailboxId}`, folderSchema, {
        method: "POST",
        body: { name: input.name, parentId: input.parentId },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mailbox", "sidebar"] });
    },
  });
}

export function useRenameFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { folderId: string; name: string }) =>
      apiRequest(`/oneops/mailbox/folders?folderId=${input.folderId}`, folderSchema, {
        method: "PATCH",
        body: { name: input.name },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mailbox", "sidebar"] });
    },
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (folderId: string) =>
      apiRequestVoid(`/oneops/mailbox/folders?folderId=${folderId}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidateMailboxThreadLists(queryClient);
    },
  });
}

export function useSaveDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      threadId?: string;
      mailboxId?: string;
      replyMode?: "REPLY" | "REPLY_ALL" | "FORWARD";
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject?: string;
      bodyHtml?: string;
      attachmentIds?: string[];
    }) => apiRequest("/oneops/mailbox/drafts", draftSchema, { method: "PUT", body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mailboxKeys.drafts });
    },
  });
}

export function useDiscardDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draftId: string) =>
      apiRequestVoid(`/oneops/mailbox/drafts?draftId=${draftId}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mailboxKeys.drafts });
    },
  });
}

export function useCompose() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      mailboxId: string;
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject?: string;
      bodyHtml?: string;
      attachmentIds?: string[];
      draftId?: string;
    }) =>
      apiRequest("/oneops/mailbox/compose", composeResponseSchema, {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      invalidateMailboxThreadLists(queryClient);
    },
  });
}

export function useReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      threadId: string;
      replyMode: "REPLY" | "REPLY_ALL" | "FORWARD";
      to?: string[];
      cc?: string[];
      bcc?: string[];
      bodyHtml: string;
      attachmentIds?: string[];
    }) =>
      apiRequest(`/oneops/mail/threads/reply?id=${input.threadId}`, messageSchema, {
        method: "POST",
        body: {
          replyMode: input.replyMode,
          to: input.to,
          cc: input.cc,
          bcc: input.bcc,
          bodyHtml: input.bodyHtml,
          attachmentIds: input.attachmentIds,
        },
      }),
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: mailboxKeys.messages(input.threadId) });
      void queryClient.invalidateQueries({ queryKey: ["mailbox", "sidebar"] });
    },
  });
}

export function useCreateAlias() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { mailboxId: string; address: string }) =>
      apiRequest(`/oneops/mailbox/aliases?mailboxId=${input.mailboxId}`, aliasSchema, {
        method: "POST",
        body: { address: input.address },
      }),
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: mailboxKeys.aliases(input.mailboxId) });
    },
  });
}

export function useDeleteAlias() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { mailboxId: string; aliasId: string }) =>
      apiRequestVoid(`/oneops/mailbox/aliases?mailboxId=${input.mailboxId}&aliasId=${input.aliasId}`, {
        method: "DELETE",
      }),
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: mailboxKeys.aliases(input.mailboxId) });
    },
  });
}

/** Finds a mailbox's folder of a given kind, for the buttons that mean "archive this" or "bin it". */
export function folderOfKind(mailbox: MailboxSummary | undefined, kind: FolderKind): Folder | undefined {
  return mailbox?.folders.find((f) => f.kind === kind);
}
