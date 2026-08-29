import { useState } from "react";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder as FolderIcon,
  Inbox,
  Plus,
  Send,
  ShieldAlert,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useCreateFolder,
  type Folder,
  type FolderKind,
  type MailboxSummary,
} from "@/lib/mailbox";

const KIND_ICONS: Record<FolderKind, typeof Inbox> = {
  INBOX: Inbox,
  SENT: Send,
  DRAFTS: FileText,
  ARCHIVE: Archive,
  TRASH: Trash2,
  SPAM: ShieldAlert,
  CUSTOM: FolderIcon,
};

export function Sidebar({
  mailboxes,
  selectedFolderId,
  onSelectFolder,
  starredSelected,
  onSelectStarred,
}: {
  mailboxes: MailboxSummary[];
  selectedFolderId: string | null;
  onSelectFolder: (mailbox: MailboxSummary, folder: Folder) => void;
  starredSelected: boolean;
  onSelectStarred: () => void;
}) {
  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-2 scrollbar-thin">
      <button
        type="button"
        onClick={onSelectStarred}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
          starredSelected ? "bg-primary/15 text-primary" : "hover:bg-surface-muted",
        )}
      >
        <Star className="size-4" />
        <span>Starred</span>
      </button>

      {mailboxes.map((mailbox) => (
        <MailboxSection
          key={mailbox.id}
          mailbox={mailbox}
          selectedFolderId={selectedFolderId}
          onSelectFolder={onSelectFolder}
        />
      ))}
    </nav>
  );
}

function MailboxSection({
  mailbox,
  selectedFolderId,
  onSelectFolder,
}: {
  mailbox: MailboxSummary;
  selectedFolderId: string | null;
  onSelectFolder: (mailbox: MailboxSummary, folder: Folder) => void;
}) {
  // A person's own mailbox starts open; the shared ones they are a member of start closed, because
  // somebody in six support queues does not want six expanded folder trees on first paint.
  const [open, setOpen] = useState(mailbox.mine || mailbox.kind === "PERSONAL");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const createFolder = useCreateFolder();

  const topLevel = mailbox.folders.filter((f) => f.parentId === null);
  const childrenOf = (parentId: string) => mailbox.folders.filter((f) => f.parentId === parentId);

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    createFolder.mutate(
      { mailboxId: mailbox.id, name: trimmed },
      {
        onSuccess: () => {
          setName("");
          setAdding(false);
        },
      },
    );
  };

  return (
    <div className="mt-3">
      <div className="flex items-center gap-1 px-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-1 text-left text-xs font-semibold uppercase tracking-wide text-text-muted hover:text-text"
        >
          {open ? (
            <ChevronDown className="size-3 shrink-0" />
          ) : (
            <ChevronRight className="size-3 shrink-0" />
          )}
          <span className="truncate" title={mailbox.address}>
            {mailbox.mine ? "My mail" : mailbox.name}
          </span>
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          title={`New folder in ${mailbox.name}`}
          aria-label={`New folder in ${mailbox.name}`}
          onClick={() => setAdding((v) => !v)}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      {open ? (
        <div className="mt-0.5 space-y-0.5">
          {topLevel.map((folder) => (
            <div key={folder.id}>
              <FolderRow
                folder={folder}
                depth={0}
                selected={folder.id === selectedFolderId}
                onSelect={() => onSelectFolder(mailbox, folder)}
              />
              {childrenOf(folder.id).map((child) => (
                <FolderRow
                  key={child.id}
                  folder={child}
                  depth={1}
                  selected={child.id === selectedFolderId}
                  onSelect={() => onSelectFolder(mailbox, child)}
                />
              ))}
            </div>
          ))}

          {adding ? (
            <form
              className="px-2 py-1"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <Input
                autoFocus
                value={name}
                placeholder="Folder name"
                onChange={(event) => setName(event.target.value)}
                onBlur={() => {
                  if (name.trim().length === 0) setAdding(false);
                }}
                className="h-7 text-xs"
              />
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FolderRow({
  folder,
  depth,
  selected,
  onSelect,
}: {
  folder: Folder;
  depth: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = KIND_ICONS[folder.kind];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-sm transition-colors",
        depth === 0 ? "pl-2" : "pl-7",
        selected ? "bg-primary/15 text-primary" : "hover:bg-surface-muted",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left">{folder.name}</span>
      {folder.unreadCount > 0 ? (
        <span className="shrink-0 text-xs font-semibold">{folder.unreadCount}</span>
      ) : null}
    </button>
  );
}
