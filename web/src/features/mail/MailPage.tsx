import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ExternalLink, Inbox, LogOut, Menu, PenSquare, RefreshCw } from "lucide-react";
import { LogoMark } from "@/components/LogoMark";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { getApiErrorMessage } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { ONEOPS_URL } from "@/lib/config";
import {
  useFolderThreads,
  useSidebar,
  useStarred,
  type Folder,
  type MailboxSummary,
  type Thread,
} from "@/lib/mailbox";
import { cn } from "@/lib/utils";
import { ComposeDialog } from "./ComposeDialog";
import { Sidebar } from "./Sidebar";
import { ThreadList } from "./ThreadList";
import { ThreadPane } from "./ThreadPane";

/**
 * Three panes on a desktop, one at a time on a phone.
 *
 * <p>The layout is driven by what is selected rather than by a route, so opening a conversation does not
 * push a history entry — on a phone the back gesture then means "back to the list", which is what it
 * should mean, without a route for every thread.
 */
export function MailPage() {
  const { logout, me } = useAuth();
  const sidebar = useSidebar();

  const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [starredView, setStarredView] = useState(false);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const mailboxes = sidebar.data ?? [];

  // Lands in the inbox of the person's own mailbox, falling back to the first mailbox they can see.
  // Somebody who is only a member of shared queues still gets an inbox rather than an empty screen.
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

  const threads = starredView ? starredThreads.data ?? [] : folderThreads.data ?? [];
  const listLoading = starredView ? starredThreads.isLoading : folderThreads.isLoading;
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

  // The selected thread is a snapshot from a list that refetches. Without this, starring a conversation
  // updates the row behind it while the open header keeps showing the old state.
  useEffect(() => {
    if (!selectedThread) return;
    const fresh = threads.find((t) => t.id === selectedThread.id);
    if (fresh && fresh !== selectedThread) setSelectedThread(fresh);
  }, [threads, selectedThread]);

  const selectFolder = (mailbox: MailboxSummary, folder: Folder) => {
    setStarredView(false);
    setSelectedMailboxId(mailbox.id);
    setSelectedFolderId(folder.id);
    setSelectedThread(null);
    setNavOpen(false);
  };

  const refresh = () => {
    void sidebar.refetch();
    if (starredView) void starredThreads.refetch();
    else void folderThreads.refetch();
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Show folders"
          onClick={() => setNavOpen((v) => !v)}
        >
          <Menu className="size-4" />
        </Button>
        <LogoMark className="size-7 shrink-0" />
        <span className="text-sm font-semibold">Mailroom</span>

        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Refresh" onClick={refresh}>
            <RefreshCw className={cn("size-4", sidebar.isFetching && "animate-spin")} />
          </Button>
          {/* The same threads, seen as work rather than as conversation. Shown to everyone rather than
              gated on a permission, because the queue itself only lists mailboxes the caller can
              already read: someone with no shared mailbox sees an empty queue, not a forbidden one. */}
          <Button variant="ghost" size="sm" asChild>
            <Link to="/queue">
              <Inbox className="size-4" />
              <span className="hidden sm:inline">Queue</span>
            </Link>
          </Button>
          {ONEOPS_URL ? (
            <Button variant="ghost" size="sm" asChild>
              <a href={ONEOPS_URL} rel="noopener">
                <ExternalLink className="size-4" />
                <span className="hidden sm:inline">OneOps</span>
              </a>
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => void logout()}>
            <LogOut className="size-4" />
            <span className="hidden sm:inline">{me?.email ?? "Sign out"}</span>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "w-64 shrink-0 border-r border-border bg-surface-muted/30",
            navOpen ? "absolute inset-y-0 left-0 top-[49px] z-30 bg-surface lg:static" : "hidden",
            "lg:block",
          )}
        >
          {sidebar.isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-7 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="p-2">
                <Button className="w-full" onClick={() => setComposeOpen(true)}>
                  <PenSquare className="size-4" />
                  Write
                </Button>
              </div>
              <Sidebar
                mailboxes={mailboxes}
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
            </>
          )}
        </aside>

        <section
          className={cn(
            "min-h-0 w-full shrink-0 overflow-y-auto border-r border-border scrollbar-thin md:w-96",
            selectedThread ? "hidden md:block" : "block",
          )}
        >
          <div className="sticky top-0 z-10 border-b border-border bg-surface/95 px-3 py-2 backdrop-blur">
            <h2 className="text-sm font-semibold">
              {starredView ? "Starred" : activeFolder?.name ?? "Mail"}
            </h2>
            {!starredView && activeMailbox ? (
              <p className="truncate text-xs text-text-muted">{activeMailbox.address}</p>
            ) : null}
          </div>

          {sidebar.isError ? (
            <EmptyState
              title="Your mailboxes would not load"
              hint={getApiErrorMessage(sidebar.error)}
            />
          ) : listError ? (
            <EmptyState title="This folder would not load" hint={getApiErrorMessage(listError)} />
          ) : !sidebar.isLoading && mailboxes.length === 0 ? (
            <EmptyState
              title="No mailboxes yet"
              hint="Somebody with mailbox admin needs to give you an address before there is mail to read."
            />
          ) : (
            <ThreadList
              threads={threads}
              isLoading={listLoading}
              selectedThreadId={selectedThread?.id ?? null}
              onSelect={setSelectedThread}
              emptyTitle={starredView ? "Nothing starred" : "Nothing here"}
              emptyHint={
                starredView
                  ? "Star a conversation to keep it within reach."
                  : "When mail arrives it will show up here."
              }
            />
          )}
        </section>

        <section
          className={cn("min-h-0 flex-1", selectedThread ? "block" : "hidden md:block")}
        >
          <div className="flex h-full flex-col">
            {selectedThread ? (
              <button
                type="button"
                onClick={() => setSelectedThread(null)}
                className="border-b border-border px-4 py-2 text-left text-xs text-text-muted md:hidden"
              >
                ← Back to list
              </button>
            ) : null}
            <div className="min-h-0 flex-1">
              <ThreadPane
                thread={selectedThread}
                mailbox={activeMailbox}
                onClosed={() => setSelectedThread(null)}
              />
            </div>
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
