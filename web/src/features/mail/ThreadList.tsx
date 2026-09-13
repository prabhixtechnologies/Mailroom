import { Inbox, Paperclip, Star } from "lucide-react";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { cn, displayName, formatMailDate } from "@/lib/utils";
import { useSetFlags, type Thread } from "@/lib/mailbox";

export function ThreadList({
  threads,
  isLoading,
  selectedThreadId,
  onSelect,
  emptyTitle,
  emptyHint,
}: {
  threads: Thread[];
  isLoading: boolean;
  selectedThreadId: string | null;
  onSelect: (thread: Thread) => void;
  emptyTitle: string;
  emptyHint?: string;
}) {
  const setFlags = useSetFlags();

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    return <EmptyState icon={<Inbox className="size-8" />} title={emptyTitle} hint={emptyHint} />;
  }

  return (
    <ul className="divide-y divide-border">
      {threads.map((thread) => (
        <li key={thread.id} className="scan-row">
          <div
            className={cn(
              "group flex min-h-11 w-full items-start gap-2 px-3 py-3 text-left transition-colors",
              thread.id === selectedThreadId ? "bg-primary/10" : "hover:bg-surface-muted",
            )}
          >
            <button
              type="button"
              // Not inside the row button: a button inside a button is invalid HTML and browsers
              // recover from it by dropping one of them, which is how a star becomes unclickable.
              onClick={() => setFlags.mutate({ threadId: thread.id, starred: !thread.starred })}
              aria-label={thread.starred ? "Remove star" : "Add star"}
              className="mt-0.5 shrink-0 text-text-muted hover:text-warning"
            >
              <Star
                className={cn("size-4", thread.starred && "fill-warning text-warning")}
              />
            </button>

            <button
              type="button"
              onClick={() => onSelect(thread)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="flex items-baseline gap-2">
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    thread.read ? "text-text-muted" : "font-semibold text-text",
                  )}
                >
                  {displayName(thread.correspondent, thread.correspondentName)}
                </span>
                <span className="shrink-0 text-xs text-text-muted">
                  {formatMailDate(thread.lastMessageAt)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    thread.read ? "text-text-muted" : "text-text",
                  )}
                >
                  {thread.subject}
                </span>
                {thread.hasAttachments ? (
                  <Paperclip className="size-3.5 shrink-0 text-text-muted" />
                ) : null}
                {thread.messageCount > 1 ? (
                  <span className="shrink-0 text-xs text-text-muted">{thread.messageCount}</span>
                ) : null}
              </div>
              {thread.snippet ? (
                <p className="truncate text-xs text-text-muted">{thread.snippet}</p>
              ) : null}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
