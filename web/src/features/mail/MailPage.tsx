import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { ExternalLink, Menu, RefreshCw, Search, Settings } from "lucide-react";
import { LogoMark } from "@/components/LogoMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { emptyCopy } from "@/lib/emptyCopy";
import { getApiErrorMessage } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { ONEOPS_URL } from "@/lib/config";
import {
  useFolderThreads,
  useSidebar,
  useStarred,
  type Folder,
  type MailboxMode,
  type MailboxSummary,
  type Thread,
} from "@/lib/mailbox";
import {
  deskPreviewActive,
  previewMailboxes,
  previewMessages,
  previewThreadsFor,
} from "@/lib/preview";
import { cn, initials } from "@/lib/utils";
import { SkipLink } from "@/components/SkipLink";
import { ComposeDialog } from "./ComposeDialog";
import { Sidebar } from "./Sidebar";
import { ThreadList } from "./ThreadList";
import { ThreadPane } from "./ThreadPane";

function unreadTotal(mailboxes: MailboxSummary[]): number {
  return mailboxes.reduce(
    (sum, mailbox) => sum + mailbox.folders.reduce((inner, folder) => inner + folder.unreadCount, 0),
    0,
  );
}

/**
 * Three panes on a desktop, one at a time on a phone.
 *
 * <p>The layout is driven by what is selected rather than by a route, so opening a conversation does not
 * push a history entry — on a phone the back gesture then means "back to the list", which is what it
 * should mean, without a route for every thread.
 */
export function MailPage() {
  const { logout, me, permissions } = useAuth();
  const [params] = useSearchParams();
  const previewBusy = deskPreviewActive(params.toString() ? `?${params}` : window.location.search);
  const canReadCompany = permissions.includes("MAIL_READ_ALL");
  const [mailMode, setMailMode] = useState<MailboxMode>("mine");
  const mineSidebar = useSidebar("mine");
  const companySidebar = useSidebar("company", canReadCompany);
  const sidebar = canReadCompany && mailMode === "company" ? companySidebar : mineSidebar;

  const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [starredView, setStarredView] = useState(false);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const liveBoxes = sidebar.data ?? [];
  const mailboxes = previewBusy && liveBoxes.length === 0 ? previewMailboxes() : liveBoxes;
  const activeMode: MailboxMode = canReadCompany ? mailMode : "mine";

  useEffect(() => {
    if (selectedFolderId || starredView || mailboxes.length === 0) return;
    const preferred = mailboxes.find((m) => m.mine) ?? mailboxes[0];
    const inbox = preferred.folders.find((f) => f.kind === "INBOX") ?? preferred.folders[0];
    if (inbox) {
      setSelectedMailboxId(preferred.id);
      setSelectedFolderId(inbox.id);
    }
  }, [mailboxes, selectedFolderId, starredView]);

  const folderThreads = useFolderThreads(starredView ? undefined : selectedFolderId ?? undefined);
  const starredThreads = useStarred();

  const liveThreads = starredView ? starredThreads.data ?? [] : folderThreads.data ?? [];
  const threads =
    previewBusy && liveThreads.length === 0
      ? previewThreadsFor(selectedFolderId, starredView)
      : liveThreads;
  const listLoading = previewBusy ? false : starredView ? starredThreads.isLoading : folderThreads.isLoading;
  const listError = starredView ? starredThreads.error : folderThreads.error;

  const activeMailbox = useMemo(
    () =>
      mailboxes.find((m) => m.id === (selectedThread?.mailboxId ?? selectedMailboxId)) ??
      mailboxes[0],
    [mailboxes, selectedMailboxId, selectedThread],
  );

  const activeFolder = useMemo(
    () => activeMailbox?.folders.find((f) => f.id === selectedFolderId),
    [activeMailbox, selectedFolderId],
  );

  useEffect(() => {
    if (!selectedThread) return;
    const fresh = threads.find((t) => t.id === selectedThread.id);
    if (fresh && fresh !== selectedThread) setSelectedThread(fresh);
  }, [threads, selectedThread]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads.filter((thread) => {
      if (unreadOnly && thread.read) return false;
      if (!q) return true;
      const hay = [thread.subject, thread.snippet, thread.correspondent, thread.correspondentName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [threads, query, unreadOnly]);

  const selectMode = (mode: MailboxMode) => {
    setMailMode(mode);
    setSelectedMailboxId(null);
    setSelectedFolderId(null);
    setStarredView(false);
    setSelectedThread(null);
    setQuery("");
  };

  const selectFolder = (mailbox: MailboxSummary, folder: Folder) => {
    setStarredView(false);
    setSelectedMailboxId(mailbox.id);
    setSelectedFolderId(folder.id);
    setSelectedThread(null);
    setNavOpen(false);
    setQuery("");
  };

  const refresh = () => {
    void mineSidebar.refetch();
    if (canReadCompany) void companySidebar.refetch();
    if (starredView) void starredThreads.refetch();
    else void folderThreads.refetch();
  };

  const listTitle = starredView
    ? "Starred"
    : (activeFolder?.name ?? (activeMode === "company" ? "Company mail" : "Inbox"));

  const empty =
    query.trim().length > 0
      ? emptyCopy.search
      : starredView
        ? emptyCopy.starred
        : activeFolder?.kind === "DRAFTS"
          ? emptyCopy.drafts
          : activeFolder?.kind === "CUSTOM"
            ? emptyCopy.room
            : emptyCopy.inbox;

  const previewThread = previewBusy && selectedThread?.id.startsWith("t");

  const onListKey = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, [contenteditable='true']")) return;
    if (visible.length === 0) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const index = selectedThread
        ? visible.findIndex((thread) => thread.id === selectedThread.id)
        : -1;
      const next =
        event.key === "ArrowDown"
          ? visible[Math.min(visible.length - 1, Math.max(0, index + 1))]
          : visible[Math.max(0, index <= 0 ? 0 : index - 1)];
      if (next) setSelectedThread(next);
      return;
    }
    if (event.key === "Enter" && !selectedThread && visible[0]) {
      event.preventDefault();
      setSelectedThread(visible[0]);
    }
    if (event.key === "Escape" && selectedThread) {
      event.preventDefault();
      setSelectedThread(null);
    }
  };

  useEffect(() => {
    const onWindowKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      if (event.key === "/" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key === "c" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setComposeOpen(true);
      }
    };
    window.addEventListener("keydown", onWindowKey);
    return () => window.removeEventListener("keydown", onWindowKey);
  }, []);

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
          <Button variant="ghost" size="icon" aria-label="Refresh" onClick={refresh}>
            <RefreshCw className={cn("size-4", sidebar.isFetching && "animate-spin")} />
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
          <button type="button" className="mr-account" onClick={() => void logout()} title="Sign out">
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
          <button type="button" className="mr-compose" onClick={() => setComposeOpen(true)}>
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
              selectedFolderId={starredView ? null : selectedFolderId}
              onSelectFolder={selectFolder}
              starredSelected={starredView}
              onSelectStarred={() => {
                setStarredView(true);
                setSelectedFolderId(null);
                setSelectedThread(null);
                setNavOpen(false);
              }}
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
              <h1 className="mr-list__title">{listTitle}</h1>
              <p className="mr-list__count">
                <b>{visible.length}</b>
                {unreadOnly ? " unread" : visible.length === 1 ? " letter" : " letters"}
              </p>
            </div>
            {!starredView && activeMailbox ? (
              <p className="mr-list__addr">{activeMailbox.address}</p>
            ) : null}
            <div className="mr-list__tools">
              <label className="mr-search">
                <Search />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setQuery("");
                      searchRef.current?.blur();
                    }
                  }}
                  placeholder="Search this list"
                  aria-label="Search this list"
                />
              </label>
              <button
                type="button"
                className={cn("mr-filter", unreadOnly && "is-on")}
                onClick={() => setUnreadOnly((value) => !value)}
              >
                {unreadOnly ? "Unread" : "All"}
              </button>
            </div>
          </div>

          {sidebar.isError && !previewBusy ? (
            <EmptyState
              title="Your mailboxes would not load"
              hint={getApiErrorMessage(sidebar.error)}
            />
          ) : listError && !previewBusy ? (
            <EmptyState title="This folder would not load" hint={getApiErrorMessage(listError)} />
          ) : !sidebar.isLoading && mailboxes.length === 0 ? (
            <EmptyState
              title={activeMode === "company" ? emptyCopy.company.title : emptyCopy.mailboxes.title}
              hint={activeMode === "company" ? emptyCopy.company.hint : emptyCopy.mailboxes.hint}
            />
          ) : (
            <ThreadList
              threads={visible}
              isLoading={listLoading}
              selectedThreadId={selectedThread?.id ?? null}
              onSelect={setSelectedThread}
              emptyTitle={empty.title}
              emptyHint={empty.hint}
              readOnly={previewBusy}
            />
          )}
        </section>

        <section className={cn("mr-desk", selectedThread ? "flex" : "hidden md:flex")}>
          {selectedThread ? (
            <button
              type="button"
              onClick={() => setSelectedThread(null)}
              className="border-b border-border px-4 py-2 text-left text-xs text-text-muted md:hidden"
            >
              ← Back to the list
            </button>
          ) : null}
          <div className="min-h-0 flex-1">
            <ThreadPane
              thread={selectedThread}
              mailbox={activeMailbox}
              onClosed={() => setSelectedThread(null)}
              previewMessages={
                previewThread && selectedThread ? previewMessages(selectedThread.id) : undefined
              }
            />
          </div>
        </section>
      </div>

      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        mailboxes={mailboxes}
        initialMailboxId={activeMailbox?.id}
      />
    </div>
  );
}
