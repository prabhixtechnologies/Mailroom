import { FileEdit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { getApiErrorMessage } from "@/lib/api-client";
import { useDiscardDraft, type Draft } from "@/lib/mailbox";
import { cn } from "@/lib/utils";

/**
 * The Drafts folder.
 *
 * <p>Drafts are not threads, so the ordinary thread list cannot show them: a draft has no
 * correspondent yet, often no subject, and never a message history. This renders the fields a
 * half-written message actually has, and clicking one reopens compose where it was left.
 */
export function DraftList({
  drafts,
  isLoading,
  error,
  onOpen,
  onCompose,
}: {
  drafts: Draft[];
  isLoading: boolean;
  error: unknown;
  onOpen: (draft: Draft) => void;
  onCompose: () => void;
}) {
  const remove = useDiscardDraft();

  if (error) {
    return <EmptyState title="Your drafts would not load" hint={getApiErrorMessage(error)} />;
  }

  if (isLoading) {
    return (
      <ul className="divide-y divide-border" aria-busy="true">
        {[0, 1, 2, 3].map((row) => (
          <li key={row} className="animate-pulse space-y-2 px-4 py-3">
            <div className="h-3.5 w-1/3 rounded bg-surface-muted" />
            <div className="h-3 w-3/4 rounded bg-surface-muted" />
          </li>
        ))}
      </ul>
    );
  }

  if (drafts.length === 0) {
    return (
      <EmptyState
        title="No drafts"
        hint="Anything you start writing is saved here automatically until you send it."
        action={<Button onClick={onCompose}>Write a message</Button>}
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {drafts.map((draft) => {
        const recipients = draft.to.filter(Boolean);
        return (
          <li key={draft.id}>
            <div className="group flex items-start gap-3 px-4 py-3 hover:bg-surface-muted">
              <button
                type="button"
                onClick={() => onOpen(draft)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="flex items-center gap-2">
                  <FileEdit className="size-3.5 shrink-0 text-[var(--px-warning-subtle-ink)]" aria-hidden />
                  <span
                    className={cn(
                      "truncate text-sm font-semibold",
                      recipients.length === 0 && "text-text-muted italic font-normal",
                    )}
                  >
                    {recipients.length > 0 ? recipients.join(", ") : "No recipient yet"}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-sm">
                  {draft.subject?.trim() || <span className="text-text-muted italic">No subject</span>}
                </span>
                <span className="mt-0.5 block truncate text-xs text-text-muted">
                  Last edited {relative(draft.updatedAt)}
                </span>
              </button>

              <button
                type="button"
                // Visible on hover for a mouse, and always once focused, so it is reachable
                // by keyboard. `opacity-0` alone would hide it from sighted keyboard users.
                className="shrink-0 rounded-md px-2 py-1 text-xs text-text-muted opacity-0 transition-opacity hover:text-[var(--px-danger)] focus-visible:opacity-100 group-hover:opacity-100"
                onClick={() => remove.mutate(draft.id)}
                disabled={remove.isPending}
                aria-label={`Discard draft${draft.subject ? `: ${draft.subject}` : ""}`}
              >
                Discard
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** "3 minutes ago", down to the minute and no finer — a draft timestamp is orientation, not data. */
function relative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recently";
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(then).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
