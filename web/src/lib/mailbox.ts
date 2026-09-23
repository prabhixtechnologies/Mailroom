import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, apiRequestVoid } from "./api-client";

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

export const messageSchema = z.object({
  id: z.string(),
  direction: z.enum(["INBOUND", "OUTBOUND"]),
  fromAddress: z.string().nullish(),
  fromName: z.string().nullish(),
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
  folder: (folderId: string) => ["mailbox", "folder", folderId] as const,
  thread: (threadId: string) => ["mailbox", "thread", threadId] as const,
  messages: (threadId: string) => ["mailbox", "messages", threadId] as const,
  drafts: ["mailbox", "drafts"] as const,
  starred: ["mailbox", "starred"] as const,
  aliases: (mailboxId: string) => ["mailbox", "aliases", mailboxId] as const,
};

export function useSidebar(mode: MailboxMode = "mine", enabled = true) {
  return useQuery({
    queryKey: mailboxKeys.sidebar(mode),
    queryFn: () =>
      apiRequest(
        mode === "company" ? "/mailbox?mode=company" : "/mailbox",
        z.array(mailboxSchema),
      ),
    enabled,
    // Folder counts go stale the moment mail arrives, and a wrong unread count is the single most
    // noticeable thing a mail client can get wrong.
    refetchInterval: 60_000,
  });
}

export function useFolderThreads(folderId: string | undefined) {
  return useQuery({
    queryKey: folderId ? mailboxKeys.folder(folderId) : ["mailbox", "folder", "none"],
    queryFn: () =>
      apiRequest(`/mailbox/folders/${folderId}/threads?limit=100`, z.array(threadSchema)),
    enabled: !!folderId,
    refetchInterval: 60_000,
  });
}

export function useStarred() {
  return useQuery({
    queryKey: mailboxKeys.starred,
    queryFn: () => apiRequest("/mailbox/starred", z.array(threadSchema)),
  });
}

export function useThreadMessages(threadId: string | undefined) {
  return useQuery({
    queryKey: threadId ? mailboxKeys.messages(threadId) : ["mailbox", "messages", "none"],
    queryFn: () =>
      apiRequest(`/mailbox/threads/${threadId}/messages`, z.array(messageSchema)),
    enabled: !!threadId,
  });
}

export function useDrafts() {
  return useQuery({
    queryKey: mailboxKeys.drafts,
    queryFn: () => apiRequest("/mailbox/drafts", z.array(draftSchema)),
  });
}

export function useAliases(mailboxId: string | undefined) {
  return useQuery({
    queryKey: mailboxId ? mailboxKeys.aliases(mailboxId) : ["mailbox", "aliases", "none"],
    queryFn: () => apiRequest(`/mailbox/${mailboxId}/aliases`, z.array(aliasSchema)),
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
    mutationFn: (input: {
      threadId: string;
      read?: boolean;
      starred?: boolean;
      snoozeUntil?: string;
    }) =>
      apiRequest(`/mailbox/threads/${input.threadId}/flags`, threadSchema, {
        method: "PATCH",
        body: { read: input.read, starred: input.starred, snoozeUntil: input.snoozeUntil },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mailbox"] });
    },
  });
}

export function useMoveThreads() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { folderId: string; threadIds: string[] }) =>
      apiRequest(`/mailbox/folders/${input.folderId}/move`, z.number(), {
        method: "POST",
        body: { threadIds: input.threadIds },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mailbox"] });
    },
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { mailboxId: string; name: string; parentId?: string }) =>
      apiRequest(`/mailbox/${input.mailboxId}/folders`, folderSchema, {
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
      apiRequest(`/mailbox/folders/${input.folderId}`, folderSchema, {
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
      apiRequestVoid(`/mailbox/folders/${folderId}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mailbox"] });
    },
  });
}

export function useSaveDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      threadId?: string;
      mailboxId?: string;
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject?: string;
      bodyHtml?: string;
    }) => apiRequest("/mailbox/drafts", draftSchema, { method: "PUT", body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mailboxKeys.drafts });
    },
  });
}

export function useDiscardDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draftId: string) =>
      apiRequestVoid(`/mailbox/drafts/${draftId}`, { method: "DELETE" }),
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
      draftId?: string;
    }) =>
      apiRequest("/mailbox/compose", composeResponseSchema, {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mailbox"] });
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
      bodyHtml: string;
    }) =>
      apiRequest(`/mail/threads/${input.threadId}/reply`, messageSchema, {
        method: "POST",
        body: {
          replyMode: input.replyMode,
          to: input.to,
          cc: input.cc,
          bodyHtml: input.bodyHtml,
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
      apiRequest(`/mailbox/${input.mailboxId}/aliases`, aliasSchema, {
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
      apiRequestVoid(`/mailbox/${input.mailboxId}/aliases/${input.aliasId}`, {
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
