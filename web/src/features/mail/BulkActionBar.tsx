import { useMemo, useState } from "react";
import {
  Archive,
  Clock,
  FolderInput,
  Mail,
  MailOpen,
  ShieldAlert,
  Star,
  StarOff,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  folderOfKind,
  useBulkSetFlags,
  useMoveThreads,
  type BulkThreadFlagPatch,
  type Folder,
  type MailboxSummary,
  type Thread,
} from "@/lib/mailbox";
import { SnoozeMenu, SnoozeTrigger } from "./SnoozeMenu";

export function BulkActionBar({
  selectedThreads,
  mailbox,
  readOnly,
  snoozedView,
  onClearSelection,
  onDone,
}: {
  selectedThreads: Thread[];
  mailbox: MailboxSummary | undefined;
  readOnly: boolean;
  snoozedView: boolean;
  onClearSelection: () => void;
  onDone?: () => void;
}) {
  const bulkFlags = useBulkSetFlags();
  const moveThreads = useMoveThreads();
  const [moveOpen, setMoveOpen] = useState(false);
  const [snoozeAt, setSnoozeAt] = useState<{ x: number; y: number } | null>(null);

  const ids = useMemo(() => selectedThreads.map((t) => t.id), [selectedThreads]);
  const busy = bulkFlags.isPending || moveThreads.isPending;

  if (selectedThreads.length === 0 || readOnly) return null;

  const archive = folderOfKind(mailbox, "ARCHIVE");
  const trash = folderOfKind(mailbox, "TRASH");
  const spam = folderOfKind(mailbox, "SPAM");

  const runFlags = (patch: Omit<BulkThreadFlagPatch, "threadIds">) => {
    bulkFlags.mutate(
      { threadIds: ids, ...patch },
      {
        onSuccess: (count) => {
          toast.success(count === 1 ? "Updated 1 conversation" : `Updated ${count} conversations`);
          onClearSelection();
          onDone?.();
        },
        onError: () => toast.error("Could not update those conversations"),
      },
    );
  };

  const moveTo = (folder: Folder | undefined) => {
    if (!folder) return;
    moveThreads.mutate(
      { folderId: folder.id, threadIds: ids },
      {
        onSuccess: () => {
          toast.success(
            selectedThreads.length === 1
              ? "Moved 1 conversation"
              : `Moved ${selectedThreads.length} conversations`,
          );
          setMoveOpen(false);
          onClearSelection();
          onDone?.();
        },
        onError: () => toast.error("Could not move those conversations"),
      },
    );
  };

  const movableFolders = (mailbox?.folders ?? []).filter(
    (f) => f.kind === "CUSTOM" || f.kind === "ARCHIVE" || f.kind === "INBOX",
  );

  const anyUnread = selectedThreads.some((t) => !t.read);
  const anyRead = selectedThreads.some((t) => t.read);
  const anyStarred = selectedThreads.some((t) => t.starred);
  const anyUnstarred = selectedThreads.some((t) => !t.starred);

  return (
    <>
      <div className="mr-bulk" role="toolbar" aria-label="Bulk actions">
        <span className="mr-bulk__count">
          {selectedThreads.length} selected
        </span>
        <div className="mr-bulk__acts">
          {snoozedView ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => runFlags({ clearSnooze: true })}
            >
              <Clock className="size-4" />
              Unsnooze
            </Button>
          ) : (
            <SnoozeTrigger
              disabled={busy}
              title="Snooze"
              onOpen={setSnoozeAt}
            />
          )}
          {anyUnread ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              title="Mark read"
              aria-label="Mark read"
              onClick={() => runFlags({ read: true })}
            >
              <MailOpen className="size-4" />
            </Button>
          ) : null}
          {anyRead ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              title="Mark unread"
              aria-label="Mark unread"
              onClick={() => runFlags({ read: false })}
            >
              <Mail className="size-4" />
            </Button>
          ) : null}
          {anyUnstarred ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              title="Add star"
              aria-label="Add star"
              onClick={() => runFlags({ starred: true })}
            >
              <Star className="size-4" />
            </Button>
          ) : null}
          {anyStarred ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              title="Remove star"
              aria-label="Remove star"
              onClick={() => runFlags({ starred: false })}
            >
              <StarOff className="size-4" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy || !archive}
            title="Archive"
            aria-label="Archive"
            onClick={() => moveTo(archive)}
          >
            <Archive className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy || !spam}
            title="Report spam"
            aria-label="Report spam"
            onClick={() => moveTo(spam)}
          >
            <ShieldAlert className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy || !trash}
            title="Move to trash"
            aria-label="Move to trash"
            onClick={() => moveTo(trash)}
          >
            <Trash2 className="size-4" />
          </Button>
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy || movableFolders.length === 0}
              title="Move to folder"
              aria-label="Move to folder"
              aria-expanded={moveOpen}
              onClick={() => setMoveOpen((v) => !v)}
            >
              <FolderInput className="size-4" />
            </Button>
            {moveOpen ? (
              <div className="mr-bulk-move" role="menu" aria-label="Choose folder">
                {movableFolders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    role="menuitem"
                    className="mr-bulk-move__item"
                    onClick={() => moveTo(folder)}
                  >
                    {folder.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear selection"
          title="Clear selection"
          onClick={onClearSelection}
        >
          <X className="size-4" />
        </Button>
      </div>
      <SnoozeMenu
        label="Snooze selected conversations"
        disabled={busy}
        anchor={snoozeAt}
        onClose={() => setSnoozeAt(null)}
        onPick={(iso) => {
          runFlags({ snoozeUntil: iso, read: true });
          setSnoozeAt(null);
        }}
      />
    </>
  );
}
