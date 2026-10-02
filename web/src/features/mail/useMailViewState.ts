import { useEffect, useMemo, useState } from "react";
import {
  flattenThreadPages,
  isActivelySnoozed,
  normalizeFolderThreadFilters,
  useFolderThreads,
  useSnoozed,
  useStarred,
  type Folder,
  type FolderThreadFilters,
  type MailboxSummary,
  type Thread,
} from "@/lib/mailbox";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { previewThreadsFor } from "@/lib/preview";

export type MailVirtualView = "folder" | "starred" | "snoozed";

export function useMailViewState(mailboxes: MailboxSummary[], previewBusy: boolean) {
  const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [virtualView, setVirtualView] = useState<MailVirtualView>("folder");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [hasAttachment, setHasAttachment] = useState(false);

  const starredView = virtualView === "starred";
  const snoozedView = virtualView === "snoozed";

  useEffect(() => {
    if (selectedFolderId || virtualView !== "folder" || mailboxes.length === 0) return;
    const preferred = mailboxes.find((m) => m.mine) ?? mailboxes[0];
    const inbox = preferred.folders.find((f) => f.kind === "INBOX") ?? preferred.folders[0];
    if (inbox) {
      setSelectedMailboxId(preferred.id);
      setSelectedFolderId(inbox.id);
    }
  }, [mailboxes, selectedFolderId, virtualView]);

  const folderFilters: FolderThreadFilters = useMemo(
    () =>
      normalizeFolderThreadFilters({
        q: debouncedQuery,
        unreadOnly,
        hasAttachment,
      }),
    [debouncedQuery, unreadOnly, hasAttachment],
  );

  const folderThreads = useFolderThreads(
    virtualView === "folder" ? (selectedFolderId ?? undefined) : undefined,
    folderFilters,
    virtualView === "folder",
  );
  const starredThreads = useStarred();
  const snoozedThreads = useSnoozed();

  const activeFolder = useMemo(() => {
    const mailbox =
      mailboxes.find((m) => m.id === selectedMailboxId) ?? mailboxes[0];
    return mailbox?.folders.find((f) => f.id === selectedFolderId);
  }, [mailboxes, selectedFolderId, selectedMailboxId]);

  const liveThreads: Thread[] = snoozedView
    ? (snoozedThreads.data ?? [])
    : starredView
      ? (starredThreads.data ?? [])
      : flattenThreadPages(folderThreads.data);

  const threads =
    previewBusy && liveThreads.length === 0
      ? previewThreadsFor(selectedFolderId, starredView)
      : liveThreads;

  const visible = useMemo(() => {
    let list = threads;
    if (virtualView === "folder" && activeFolder?.kind === "INBOX") {
      list = list.filter((thread) => !isActivelySnoozed(thread));
    }
    if (!starredView && !snoozedView) return list;
    const q = query.trim().toLowerCase();
    return list.filter((thread) => {
      if (unreadOnly && thread.read) return false;
      if (!q) return true;
      const hay = [thread.subject, thread.snippet, thread.correspondent, thread.correspondentName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [threads, query, unreadOnly, starredView, snoozedView, virtualView, activeFolder?.kind]);

  const listScopeKey = snoozedView
    ? "snoozed"
    : starredView
      ? "starred"
      : `${selectedFolderId ?? "none"}:${debouncedQuery}:${unreadOnly}:${hasAttachment}`;

  const listLoading = previewBusy
    ? false
    : snoozedView
      ? snoozedThreads.isLoading
      : starredView
        ? starredThreads.isLoading
        : folderThreads.isLoading;

  const listError = snoozedView
    ? snoozedThreads.error
    : starredView
      ? starredThreads.error
      : folderThreads.error;

  const listFetching = snoozedView
    ? snoozedThreads.isFetching
    : starredView
      ? starredThreads.isFetching
      : folderThreads.isFetching;

  const searchPending = virtualView === "folder" && query.trim() !== debouncedQuery.trim();

  const resetForContextSwitch = () => {
    setSelectedMailboxId(null);
    setSelectedFolderId(null);
    setVirtualView("folder");
    setQuery("");
    setHasAttachment(false);
  };

  const selectFolder = (mailbox: MailboxSummary, folder: Folder) => {
    setVirtualView("folder");
    setSelectedMailboxId(mailbox.id);
    setSelectedFolderId(folder.id);
    setQuery("");
    setHasAttachment(false);
  };

  const selectStarred = () => {
    setVirtualView("starred");
    setSelectedFolderId(null);
    setQuery("");
    setHasAttachment(false);
  };

  const selectSnoozed = () => {
    setVirtualView("snoozed");
    setSelectedFolderId(null);
    setQuery("");
    setHasAttachment(false);
  };

  return {
    selectedMailboxId,
    selectedFolderId,
    virtualView,
    starredView,
    snoozedView,
    query,
    setQuery,
    debouncedQuery,
    unreadOnly,
    setUnreadOnly,
    hasAttachment,
    setHasAttachment,
    activeFolder,
    folderThreads,
    starredThreads,
    snoozedThreads,
    threads,
    visible,
    listScopeKey,
    listLoading,
    listError,
    listFetching,
    searchPending,
    folderFilters,
    resetForContextSwitch,
    selectFolder,
    selectStarred,
    selectSnoozed,
    hasMoreThreads: virtualView === "folder" && (folderThreads.hasNextPage ?? false),
    loadMoreThreads: folderThreads.fetchNextPage,
    loadingMoreThreads: folderThreads.isFetchingNextPage,
  };
}
