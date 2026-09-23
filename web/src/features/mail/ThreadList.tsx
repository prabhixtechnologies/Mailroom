import { Paperclip, Star } from "lucide-react";
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
  readOnly = false,
}: {
  threads: Thread[];
  isLoading: boolean;
  selectedThreadId: string | null;
  onSelect: (thread: Thread) => void;
  emptyTitle: string;
  emptyHint?: string;
  readOnly?: boolean;
}) {
  const setFlags = useSetFlags();

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
        <li key={thread.id} className="scan-row">
          <div
            className={cn(
              "mr-row",
              thread.id === selectedThreadId && "is-on",
              !thread.read && "is-unread",
            )}
          >
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
                <span className="mr-row__who">
                  {displayName(thread.correspondent, thread.correspondentName)}
                </span>
                <time className="mr-row__when" dateTime={thread.lastMessageAt}>
                  {formatMailDate(thread.lastMessageAt)}
                </time>
              </div>
              <span className="mr-row__subj">
                {thread.subject}
                {thread.hasAttachments || thread.messageCount > 1 ? (
                  <span className="mr-row__meta">
                    {thread.hasAttachments ? <Paperclip className="size-3" /> : null}
                    {thread.messageCount > 1 ? thread.messageCount : null}
                  </span>
                ) : null}
              </span>
              {thread.snippet ? <span className="mr-row__preview">{thread.snippet}</span> : null}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
