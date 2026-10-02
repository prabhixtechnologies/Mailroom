import { useEffect, useRef } from "react";
import { MailOpen, MoreHorizontal, Paperclip, Star, StarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useRowMenu, type RowMenuAction } from "@/components/ui/row-menu";
import { cn, displayName, formatMailDate } from "@/lib/utils";
import { useSetFlags, type Thread } from "@/lib/mailbox";

export function ThreadList({
  threads,
  isLoading,
  selectedThreadId,
  onSelect,
  emptyTitle,
  emptyHint,
  readOnly = false,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  selectionEnabled = false,
  isThreadSelected,
  onToggleThreadSelected,
}: {
  threads: Thread[];
  isLoading: boolean;
  selectedThreadId: string | null;
  onSelect: (thread: Thread) => void;
  emptyTitle: string;
  emptyHint?: string;
  readOnly?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  selectionEnabled?: boolean;
  isThreadSelected?: (threadId: string) => boolean;
  onToggleThreadSelected?: (threadId: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-px p-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-sm" />
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    return <EmptyState title={emptyTitle} hint={emptyHint} />;
  }

  return (
    <ul className="mr-rows scrollbar-thin">
      {threads.map((thread) => (
        <ThreadRow
          key={thread.id}
          thread={thread}
          selected={thread.id === selectedThreadId}
          readOnly={readOnly}
          onSelect={onSelect}
          selectionEnabled={selectionEnabled}
          checked={isThreadSelected?.(thread.id) ?? false}
          onToggleSelected={() => onToggleThreadSelected?.(thread.id)}
        />
      ))}
      {hasMore && onLoadMore ? (
        <li>
          <LoadMoreFooter isLoadingMore={isLoadingMore} onLoadMore={onLoadMore} />
        </li>
      ) : null}
    </ul>
  );
}

function LoadMoreFooter({
  isLoadingMore,
  onLoadMore,
}: {
  isLoadingMore: boolean;
  onLoadMore: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || isLoadingMore) return;
    const scrollRoot = sentinel.closest(".mr-rows");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      {
        root: scrollRoot instanceof Element ? scrollRoot : null,
        rootMargin: "240px",
        threshold: 0,
      },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isLoadingMore, onLoadMore]);

  return (
    <div className="border-t border-border px-3 py-3">
      <div ref={sentinelRef} className="h-px" aria-hidden />
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        disabled={isLoadingMore}
        onClick={onLoadMore}
      >
        {isLoadingMore ? "Loading…" : "Load more"}
      </Button>
    </div>
  );
}

/**
 * A row, and everything that can be done to it.
 *
 * Split out of the list because the menu is a hook. Before this, the only verb a thread row had
 * was the star, and marking something read without opening it — the commonest thing anyone wants
 * from a list of mail — was not possible at all.
 */
function ThreadRow({
  thread,
  selected,
  readOnly,
  onSelect,
  selectionEnabled,
  checked,
  onToggleSelected,
}: {
  thread: Thread;
  selected: boolean;
  readOnly: boolean;
  onSelect: (thread: Thread) => void;
  selectionEnabled: boolean;
  checked: boolean;
  onToggleSelected: () => void;
}) {
  const setFlags = useSetFlags();

  const copy = async (what: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`Copied ${what}`);
    } catch {
      toast.error("Could not reach the clipboard. Copy it by hand.");
    }
  };

  const who = displayName(thread.correspondent, thread.correspondentName);

  const actions: RowMenuAction[] = [
    ...(readOnly
      ? []
      : [
          {
            id: "read",
            label: thread.read ? "Mark as unread" : "Mark as read",
            icon: <MailOpen className="size-4" />,
            onSelect: () => setFlags.mutate({ threadId: thread.id, read: !thread.read }),
          },
          {
            id: "star",
            label: thread.starred ? "Remove star" : "Add star",
            icon: thread.starred ? <StarOff className="size-4" /> : <Star className="size-4" />,
            onSelect: () => setFlags.mutate({ threadId: thread.id, starred: !thread.starred }),
          },
        ]),
    // Absent rather than disabled when there is no address to copy: a menu lists what can be
    // done, and a permanently greyed row is only noise.
    ...(thread.correspondent
      ? [
          {
            id: "copy-address",
            label: "Copy sender address",
            group: "copy",
            onSelect: () => copy("address", thread.correspondent as string),
          },
        ]
      : []),
    {
      id: "copy-subject",
      label: "Copy subject",
      group: "copy",
      onSelect: () => copy("subject", thread.subject),
    },
  ];

  const { rowProps, menu, openAt } = useRowMenu(actions, `${who}: ${thread.subject}`);

  return (
    <li className="scan-row">
      <div
        {...rowProps}
        className={cn(
          "mr-row",
          selected && "is-on",
          checked && "is-checked",
          !thread.read && "is-unread",
        )}
      >
        {selectionEnabled && !readOnly ? (
          <input
            type="checkbox"
            className="mr-row__check"
            checked={checked}
            aria-label={`Select ${who}: ${thread.subject}`}
            onChange={(event) => {
              event.stopPropagation();
              onToggleSelected();
            }}
            onClick={(event) => event.stopPropagation()}
          />
        ) : null}
        <button
          type="button"
          onClick={() => {
            if (readOnly) return;
            setFlags.mutate({ threadId: thread.id, starred: !thread.starred });
          }}
          aria-label={thread.starred ? "Remove star" : "Add star"}
          className={cn("mr-row__star", thread.starred && "is-on")}
        >
          <Star className={cn("size-3.5", thread.starred && "fill-current")} />
        </button>

        <button type="button" onClick={() => onSelect(thread)} className="mr-row__body">
          <div className="mr-row__top">
            <span className="mr-row__who">{who}</span>
            <time className="mr-row__when" dateTime={thread.lastMessageAt}>
              {formatMailDate(thread.lastMessageAt)}
            </time>
          </div>
          <span className="mr-row__subj">
            {thread.subject}
            {thread.hasAttachments || thread.messageCount > 1 ? (
              <span className="mr-row__meta">
                {thread.hasAttachments ? <Paperclip className="size-3" aria-hidden /> : null}
                {thread.messageCount > 1 ? thread.messageCount : null}
              </span>
            ) : null}
          </span>
          {thread.snippet ? <span className="mr-row__preview">{thread.snippet}</span> : null}
        </button>

        {/* Visible, because a right-click menu nobody knows about is not an affordance. */}
        <button
          type="button"
          aria-label={`Actions for ${who}: ${thread.subject}`}
          className="mr-row__more"
          onClick={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            openAt({ x: box.left - 180, y: box.bottom + 4 });
          }}
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>
      {menu}
    </li>
  );
}
