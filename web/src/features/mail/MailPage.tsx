import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router";
import {
  buildMailUrlSearchParams,
  mailUrlStateEquals,
  parseMailUrlState,
  resolveMailUrlState,
  type MailUrlState,
} from "@/lib/mail-url-state";
import { ExternalLink, Keyboard, Menu, RefreshCw, Search, Settings } from "lucide-react";
import { LogoMark } from "@/components/LogoMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { emptyCopy } from "@/lib/emptyCopy";
import { getApiErrorMessage } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { ONEOPS_URL } from "@/lib/config";
import { useMailStream } from "@/lib/mail-stream";
import {
  folderOfKind,
  useDrafts,
  useMoveThreads,
  useSetFlags,
  useSidebar,
  type Draft,
  type Folder,
  type MailboxMode,
  type MailboxSummary,
  type Thread,
} from "@/lib/mailbox";
import {
  deskPreviewActive,
  previewMailboxes,
  previewMessages,
} from "@/lib/preview";
import { cn, initials } from "@/lib/utils";
import { SkipLink } from "@/components/SkipLink";
import { BulkActionBar } from "./BulkActionBar";
import { ComposeDialog } from "./ComposeDialog";
import { DraftList } from "./DraftList";
import { ShortcutSheet } from "./ShortcutSheet";
import { Sidebar } from "./Sidebar";
import { SnoozeMenu } from "./SnoozeMenu";
import { ThreadList } from "./ThreadList";
import { ThreadPane } from "./ThreadPane";
import { useMailKeyboardShortcuts } from "./useMailKeyboardShortcuts";
import { useMailViewState } from "./useMailViewState";
import { useThreadSelection } from "./useThreadSelection";

function SelectAllCheckbox({
  allSelected,
  someSelected,
  onToggle,
}: {
  allSelected: boolean;
  someSelected: boolean;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someSelected;
  }, [someSelected]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="mr-list__select-all"
      aria-label={allSelected ? "Deselect all on this page" : "Select all on this page"}
      checked={allSelected}
      onChange={onToggle}
    />
  );
}

function unreadTotal(mailboxes: MailboxSummary[]): number {
  return mailboxes.reduce(
    (sum, mailbox) => sum + mailbox.folders.reduce((inner, folder) => inner + folder.unreadCount, 0),
    0,
  );
}

export function MailPage() {
  const { logout, me, permissions } = useAuth();
  const [params, setSearchParams] = useSearchParams();
  const previewBusy = deskPreviewActive(params.toString() ? `?${params}` : window.location.search);
  const canReadCompany = permissions.includes("MAIL_READ_ALL");
  const [mailMode, setMailMode] = useState<MailboxMode>("mine");
  const urlBootstrapped = useRef(false);
  const replyDirtyRef = useRef(false);
  const mineSidebar = useSidebar("mine");
  const companySidebar = useSidebar("company", canReadCompany);
  const sidebar = canReadCompany && mailMode === "company" ? companySidebar : mineSidebar;

  const liveBoxes = sidebar.data ?? [];
  const mailboxes = previewBusy && liveBoxes.length === 0 ? previewMailboxes() : liveBoxes;
  const activeMode: MailboxMode = canReadCompany ? mailMode : "mine";

  const view = useMailViewState(mailboxes, previewBusy);

  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [snoozeAnchor, setSnoozeAnchor] = useState<{ x: number; y: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const setFlags = useSetFlags();
  const moveThreads = useMoveThreads();

  const visibleIds = useMemo(() => view.visible.map((t) => t.id), [view.visible]);
  const selection = useThreadSelection(visibleIds, view.listScopeKey);

  const selectedThreads = useMemo(
    () => view.visible.filter((t) => selection.selectedIds.has(t.id)),
    [view.visible, selection.selectedIds],
  );

  const activeMailbox = useMemo(
    () =>
      mailboxes.find((m) => m.id === (selectedThread?.mailboxId ?? view.selectedMailboxId)) ??
      mailboxes[0],
    [mailboxes, view.selectedMailboxId, selectedThread],
  );

  const onDrafts = !view.starredView && !view.snoozedView && view.activeFolder?.kind === "DRAFTS";

  useMailStream({
    enabled: !previewBusy && !onDrafts,
    selectedThreadId: selectedThread?.id ?? null,
    activeFolderId: view.starredView || view.snoozedView ? null : view.selectedFolderId,
  });

  const draftsQuery = useDrafts(onDrafts);
  const drafts = draftsQuery.data ?? [];
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);

  const openDraft = (draft: Draft) => {
    setEditingDraft(draft);
    setComposeOpen(true);
  };

  const guardReplyDirty = useCallback(() => {
    if (!replyDirtyRef.current) return true;
    const leave = window.confirm("Discard this unsent reply?");
    if (leave) replyDirtyRef.current = false;
    return leave;
  }, []);

  const selectThread = useCallback(
    (thread: Thread | null) => {
      if (thread?.id === selectedThread?.id) return;
      if (!guardReplyDirty()) return;
      setSelectedThread(thread);
    },
    [guardReplyDirty, selectedThread?.id],
  );

  useEffect(() => {
    if (urlBootstrapped.current || previewBusy || mailboxes.length === 0) return;
    const parsed = parseMailUrlState(params.toString());
    const resolved = resolveMailUrlState(parsed, mailboxes);
    urlBootstrapped.current = true;

    if (resolved.mode === "company" && canReadCompany) setMailMode("company");
    if (resolved.virtualView === "starred") view.selectStarred();
    else if (resolved.virtualView === "snoozed") view.selectSnoozed();
    else if (resolved.mailbox && resolved.folderId) {
      const folder = resolved.mailbox.folders.find((f) => f.id === resolved.folderId);
      if (folder) view.selectFolder(resolved.mailbox, folder);
    }

    if (parsed.filters.q) view.setQuery(parsed.filters.q);
    if (parsed.filters.unreadOnly) view.setUnreadOnly(true);
    if (parsed.filters.hasAttachment) view.setHasAttachment(true);

    if (resolved.compose) setComposeOpen(true);
    if (resolved.draftId && drafts.length > 0) {
      const draft = drafts.find((d) => d.id === resolved.draftId);
      if (draft) openDraft(draft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailboxes, canReadCompany, previewBusy, params]);

  useEffect(() => {
    if (!urlBootstrapped.current || previewBusy) return;
    const threadId = parseMailUrlState(params.toString()).threadId;
    if (!threadId || selectedThread?.id === threadId) return;
    const match = view.visible.find((t) => t.id === threadId);
    if (match) setSelectedThread(match);
  }, [view.visible, params, previewBusy, selectedThread?.id]);

  const onReplyDirtyChange = useCallback((dirty: boolean) => {
    replyDirtyRef.current = dirty;
  }, []);

  useEffect(() => {
    if (!urlBootstrapped.current) return;
    const desk = params.get("desk");
    const next: MailUrlState = {
      mode: canReadCompany ? mailMode : "mine",
      virtualView: view.virtualView,
      mailboxId: view.selectedMailboxId,
      folderId: view.selectedFolderId,
      threadId: selectedThread?.id ?? null,
      compose: composeOpen,
      draftId: editingDraft?.id ?? null,
      filters: {
        q: view.query.trim() || undefined,
        unreadOnly: view.unreadOnly || undefined,
        hasAttachment: view.hasAttachment || undefined,
      },
    };
    const built = buildMailUrlSearchParams(next);
    if (desk === "busy") built.set("desk", "busy");
    const current = parseMailUrlState(`?${params.toString()}`);
    const currentBuilt = buildMailUrlSearchParams({
      ...current,
      filters: {
        q: current.filters.q,
        unreadOnly: current.filters.unreadOnly,
        hasAttachment: current.filters.hasAttachment,
      },
    });
    if (desk === "busy") currentBuilt.set("desk", "busy");
    if (mailUrlStateEquals(next, current) && built.toString() === currentBuilt.toString()) return;
    setSearchParams(built, { replace: true });
  }, [
    mailMode,
    canReadCompany,
    view.virtualView,
    view.selectedMailboxId,
    view.selectedFolderId,
    view.query,
    view.unreadOnly,
    view.hasAttachment,
    selectedThread?.id,
    composeOpen,
    editingDraft?.id,
    params,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!selectedThread) return;
    const fresh = view.threads.find((t) => t.id === selectedThread.id);
    if (fresh && fresh !== selectedThread) setSelectedThread(fresh);
  }, [view.threads, selectedThread]);

  const selectMode = (mode: MailboxMode) => {
    if (!guardReplyDirty()) return;
    setMailMode(mode);
    view.resetForContextSwitch();
    setSelectedThread(null);
    selection.clear();
  };

  const selectFolder = (mailbox: MailboxSummary, folder: Folder) => {
    if (!guardReplyDirty()) return;
    view.selectFolder(mailbox, folder);
    setSelectedThread(null);
    setNavOpen(false);
    selection.clear();
  };

  const selectStarred = () => {
    if (!guardReplyDirty()) return;
    view.selectStarred();
    setSelectedThread(null);
    setNavOpen(false);
    selection.clear();
  };

  const selectSnoozed = () => {
    if (!guardReplyDirty()) return;
    view.selectSnoozed();
    setSelectedThread(null);
    setNavOpen(false);
    selection.clear();
  };

  const refresh = () => {
    void mineSidebar.refetch();
    if (canReadCompany) void companySidebar.refetch();
    if (view.snoozedView) void view.snoozedThreads.refetch();
    else if (view.starredView) void view.starredThreads.refetch();
    else void view.folderThreads.refetch();
  };

  const listTitle = view.snoozedView
    ? "Snoozed"
    : view.starredView
      ? "Starred"
      : (view.activeFolder?.name ?? (activeMode === "company" ? "Company mail" : "Inbox"));

  const empty =
    (view.starredView || view.snoozedView
      ? view.query.trim().length > 0
      : view.debouncedQuery.trim().length > 0)
      ? emptyCopy.search
      : view.snoozedView
        ? emptyCopy.snoozed
        : view.starredView
          ? emptyCopy.starred
          : view.activeFolder?.kind === "DRAFTS"
            ? emptyCopy.drafts
            : view.activeFolder?.kind === "CUSTOM"
              ? emptyCopy.room
              : emptyCopy.inbox;

  const previewThread = previewBusy && selectedThread?.id.startsWith("t");
  const listLoadingWithSearch = view.listLoading || view.searchPending;

  const moveOpenThread = useCallback(
    (kind: "ARCHIVE" | "TRASH") => {
      const thread = selectedThread;
      if (!thread || previewBusy) return;
      const mailbox =
        mailboxes.find((m) => m.id === thread.mailboxId) ?? activeMailbox;
      const folder = folderOfKind(mailbox, kind);
      if (!folder) return;
      moveThreads.mutate(
        { folderId: folder.id, threadIds: [thread.id] },
        { onSuccess: () => setSelectedThread(null) },
      );
    },
    [selectedThread, previewBusy, mailboxes, activeMailbox, moveThreads],
  );

  const shortcutHandlers = useMemo(
    () => ({
      onFocusSearch: () => {},
      onToggleShortcutSheet: () => setShortcutsOpen((open) => !open),
      onCompose: () => setComposeOpen(true),
      onArchive: () => moveOpenThread("ARCHIVE"),
      onTrash: () => moveOpenThread("TRASH"),
      onSnooze: () => {
        if (!selectedThread || previewBusy) return;
        setSnoozeAnchor({ x: window.innerWidth / 2, y: 120 });
      },
      onToggleSelect: () => {
        if (!selectedThread) return;
        selection.toggle(selectedThread.id);
      },
    }),
    [moveOpenThread, previewBusy, selectedThread, selection],
  );

  useMailKeyboardShortcuts(searchRef, selectedThread, setFlags, shortcutHandlers);

  const onListKey = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, [contenteditable='true']")) return;
    if (view.visible.length === 0) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const index = selectedThread
        ? view.visible.findIndex((thread) => thread.id === selectedThread.id)
        : -1;
      const next =
        event.key === "ArrowDown"
          ? view.visible[Math.min(view.visible.length - 1, Math.max(0, index + 1))]
          : view.visible[Math.max(0, index <= 0 ? 0 : index - 1)];
      if (next) selectThread(next);
      return;
    }
    if (event.key === "Enter" && !selectedThread && view.visible[0]) {
      event.preventDefault();
      selectThread(view.visible[0]);
    }
    if (event.key === "Escape" && selectedThread) {
      event.preventDefault();
      selectThread(null);
    }
  };

  return (
    <div className="mr-shell">
      <SkipLink />
      <header className="mr-top">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Show folders"
          onClick={() => setNavOpen((v) => !v)}
        >
          <Menu className="size-4" />
        </Button>
        <div className="mr-top__brand">
          <LogoMark className="size-7 shrink-0" />
          <span className="mr-top__name hidden sm:inline">Mailroom</span>
        </div>

        <div className="mr-top__tools">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="hidden sm:inline-flex"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            onClick={() => setShortcutsOpen(true)}
          >
            <Keyboard className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Refresh" onClick={refresh}>
            <RefreshCw
              className={cn(
                "size-4",
                (sidebar.isFetching || view.listFetching) && "animate-spin",
              )}
            />
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link to="/settings" aria-label="Settings">
              <Settings className="size-4" />
            </Link>
          </Button>
          {ONEOPS_URL ? (
            <Button variant="ghost" size="icon" asChild>
              <a href={`${ONEOPS_URL}/inbox`} rel="noopener" aria-label="OneOps inbox">
                <ExternalLink className="size-4" />
              </a>
            </Button>
          ) : null}
          <button
            type="button"
            className="mr-account"
            onClick={() => void logout()}
            title="Sign out"
            aria-label="Sign out"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-surface-muted text-[10px] font-semibold text-text">
              {initials(me?.email ?? me?.displayName ?? "You")}
            </span>
            <strong className="hidden md:inline">{me?.email ?? "Sign out"}</strong>
          </button>
        </div>
      </header>

      <div className="mr-floor" id="main-content" tabIndex={-1}>
        {navOpen ? (
          <button
            type="button"
            className="mr-nav-scrim lg:hidden"
            aria-label="Close folders"
            onClick={() => setNavOpen(false)}
          />
        ) : null}
        <aside className={cn("mr-nav", navOpen ? "flex" : "hidden lg:flex")}>
          <div className="mr-lockup">
            <div className="mr-lockup__name">Mailroom</div>
            <div className="mr-lockup__tag">Company communication</div>
          </div>
          <button
            type="button"
            className="mr-compose"
            aria-label="Compose new message"
            onClick={() => setComposeOpen(true)}
          >
            + Compose
          </button>
          {sidebar.isLoading && !previewBusy ? (
            <div className="space-y-2 px-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-7 w-full" />
              ))}
            </div>
          ) : (
            <Sidebar
              mailboxes={mailboxes}
              mode={activeMode}
              canReadCompany={canReadCompany}
              unreadMine={unreadTotal(mineSidebar.data ?? (previewBusy ? previewMailboxes() : []))}
              unreadCompany={unreadTotal(companySidebar.data ?? [])}
              onSelectMode={selectMode}
              selectedFolderId={
                view.starredView || view.snoozedView ? null : view.selectedFolderId
              }
              onSelectFolder={selectFolder}
              starredSelected={view.starredView}
              onSelectStarred={selectStarred}
              snoozedSelected={view.snoozedView}
              onSelectSnoozed={selectSnoozed}
            />
          )}
        </aside>

        <section
          className={cn("mr-list", selectedThread ? "hidden md:flex" : "flex")}
          tabIndex={0}
          aria-label="Message list"
          onKeyDown={onListKey}
        >
          <div className="mr-list__head">
            <div className="mr-list__title-row">
              {!onDrafts && !previewBusy && view.visible.length > 0 ? (
                <SelectAllCheckbox
                  allSelected={selection.allVisibleSelected}
                  someSelected={selection.someVisibleSelected}
                  onToggle={selection.toggleAllVisible}
                />
              ) : null}
              <h1 className="mr-list__title">{listTitle}</h1>
              <p className="mr-list__count">
                <b>
                  {view.visible.length}
                  {view.hasMoreThreads ? "+" : ""}
                </b>
                {view.unreadOnly ? " unread" : view.visible.length === 1 ? " letter" : " letters"}
              </p>
            </div>
            {!view.starredView && !view.snoozedView && activeMailbox ? (
              <p className="mr-list__addr">{activeMailbox.address}</p>
            ) : null}
            <BulkActionBar
              selectedThreads={selectedThreads}
              mailbox={activeMailbox}
              readOnly={previewBusy || onDrafts}
              snoozedView={view.snoozedView}
              onClearSelection={selection.clear}
            />
            <div className="mr-list__tools">
              <label className="mr-search">
                <Search />
                <input
                  ref={searchRef}
                  type="search"
                  value={view.query}
                  onChange={(event) => view.setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      view.setQuery("");
                      searchRef.current?.blur();
                    }
                  }}
                  placeholder="Search this list"
                  aria-label="Search this list"
                />
              </label>
              <button
                type="button"
                className={cn("mr-filter", view.unreadOnly && "is-on")}
                aria-pressed={view.unreadOnly}
                onClick={() => view.setUnreadOnly((value) => !value)}
              >
                {view.unreadOnly ? "Unread" : "All"}
              </button>
              {view.virtualView === "folder" ? (
                <button
                  type="button"
                  className={cn("mr-filter", view.hasAttachment && "is-on")}
                  aria-pressed={view.hasAttachment}
                  onClick={() => view.setHasAttachment((value) => !value)}
                >
                  Attachments
                </button>
              ) : null}
            </div>
          </div>

          {sidebar.isError && !previewBusy ? (
            <EmptyState
              title="Your mailboxes would not load"
              hint={getApiErrorMessage(sidebar.error)}
            />
          ) : view.listError && !previewBusy ? (
            <EmptyState title="This folder would not load" hint={getApiErrorMessage(view.listError)} />
          ) : !sidebar.isLoading && mailboxes.length === 0 ? (
            <EmptyState
              title={activeMode === "company" ? emptyCopy.company.title : emptyCopy.mailboxes.title}
              hint={activeMode === "company" ? emptyCopy.company.hint : emptyCopy.mailboxes.hint}
            />
          ) : onDrafts ? (
            <DraftList
              drafts={drafts}
              isLoading={draftsQuery.isLoading}
              error={draftsQuery.error}
              onOpen={openDraft}
              onCompose={() => {
                setEditingDraft(null);
                setComposeOpen(true);
              }}
            />
          ) : (
            <ThreadList
              threads={view.visible}
              isLoading={listLoadingWithSearch}
              selectedThreadId={selectedThread?.id ?? null}
              onSelect={selectThread}
              emptyTitle={empty.title}
              emptyHint={empty.hint}
              readOnly={previewBusy}
              hasMore={view.hasMoreThreads}
              isLoadingMore={view.loadingMoreThreads}
              onLoadMore={() => void view.loadMoreThreads()}
              selectionEnabled
              isThreadSelected={selection.isSelected}
              onToggleThreadSelected={selection.toggle}
            />
          )}
        </section>

        <section className={cn("mr-desk", selectedThread ? "flex" : "hidden md:flex")}>
          {selectedThread ? (
            <button
              type="button"
              onClick={() => selectThread(null)}
              className="border-b border-border px-4 py-2 text-left text-xs text-text-muted md:hidden"
            >
              ← Back to the list
            </button>
          ) : null}
          <div className="min-h-0 flex-1">
            <ThreadPane
              thread={selectedThread}
              mailbox={activeMailbox}
              onClosed={() => selectThread(null)}
              onReplyDirtyChange={onReplyDirtyChange}
              previewMessages={
                previewThread && selectedThread ? previewMessages(selectedThread.id) : undefined
              }
            />
          </div>
        </section>
      </div>

      <ComposeDialog
        open={composeOpen}
        onOpenChange={(next) => {
          setComposeOpen(next);
          if (!next) {
            setEditingDraft(null);
            setSearchParams(
              (current) => {
                const copy = new URLSearchParams(current);
                copy.delete("compose");
                copy.delete("draft");
                return copy;
              },
              { replace: true },
            );
          }
        }}
        mailboxes={mailboxes}
        initialMailboxId={editingDraft?.mailboxId ?? activeMailbox?.id}
        draft={editingDraft}
      />

      <ShortcutSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <SnoozeMenu
        label="Snooze conversation"
        disabled={!selectedThread || previewBusy}
        anchor={snoozeAnchor}
        onClose={() => setSnoozeAnchor(null)}
        onPick={(iso) => {
          if (!selectedThread) return;
          setFlags.mutate({ threadId: selectedThread.id, snoozeUntil: iso, read: true });
          setSnoozeAnchor(null);
          setSelectedThread(null);
        }}
      />
    </div>
  );
}
