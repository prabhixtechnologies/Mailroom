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
  type MailboxMode,
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

const CONTEXT_KINDS = new Set<FolderKind>(["INBOX"]);
const ROOM_KINDS = new Set<FolderKind>(["CUSTOM"]);

export function Sidebar({
  mailboxes,
  mode,
  canReadCompany,
  unreadMine,
  unreadCompany,
  onSelectMode,
  selectedFolderId,
  onSelectFolder,
  starredSelected,
  onSelectStarred,
}: {
  mailboxes: MailboxSummary[];
  mode: MailboxMode;
  canReadCompany: boolean;
  unreadMine: number;
  unreadCompany: number;
  onSelectMode: (mode: MailboxMode) => void;
  selectedFolderId: string | null;
  onSelectFolder: (mailbox: MailboxSummary, folder: Folder) => void;
  starredSelected: boolean;
  onSelectStarred: () => void;
}) {
  const groups = mode === "company" ? groupByOwner(mailboxes) : [{ label: null, mailboxes }];

  return (
    <nav className="mr-nav__scroll scrollbar-thin" aria-label="Mailboxes">
      {canReadCompany ? (
        <div className="mr-context" role="tablist" aria-label="Mailbox context">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "mine"}
            className={cn("mr-context__btn", mode === "mine" && "is-on")}
            onClick={() => onSelectMode("mine")}
          >
            My mail
            {unreadMine > 0 ? <span className="mr-context__count">{unreadMine}</span> : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "company"}
            className={cn("mr-context__btn", mode === "company" && "is-on")}
            onClick={() => onSelectMode("company")}
          >
            Company mail
            {unreadCompany > 0 ? <span className="mr-context__count">{unreadCompany}</span> : null}
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onSelectStarred}
        className={cn("mr-nav-link", starredSelected && "is-on")}
        aria-current={starredSelected ? "page" : undefined}
      >
        <Star />
        <span>Starred</span>
      </button>

      {groups.map((group) => (
        <div key={group.label ?? "mine"}>
          {group.label ? <p className="mr-nav-label">{group.label}</p> : null}
          {group.mailboxes.map((mailbox) => (
            <MailboxSection
              key={mailbox.id}
              mailbox={mailbox}
              companyMode={mode === "company"}
              selectedFolderId={selectedFolderId}
              onSelectFolder={onSelectFolder}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

function groupByOwner(mailboxes: MailboxSummary[]) {
  const order: string[] = [];
  const byKey = new Map<string, { label: string; mailboxes: MailboxSummary[] }>();
  for (const mailbox of mailboxes) {
    const key = mailbox.ownerUserId ?? "shared";
    const label = mailbox.ownerUserId ? (mailbox.ownerLabel ?? mailbox.name) : "Shared inboxes";
    let group = byKey.get(key);
    if (!group) {
      group = { label, mailboxes: [] };
      byKey.set(key, group);
      order.push(key);
    }
    group.mailboxes.push(mailbox);
  }
  return order.map((key) => byKey.get(key)!);
}

function MailboxSection({
  mailbox,
  companyMode,
  selectedFolderId,
  onSelectFolder,
}: {
  mailbox: MailboxSummary;
  companyMode: boolean;
  selectedFolderId: string | null;
  onSelectFolder: (mailbox: MailboxSummary, folder: Folder) => void;
}) {
  const [open, setOpen] = useState(mailbox.mine || mailbox.kind === "PERSONAL");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const createFolder = useCreateFolder();

  const topLevel = mailbox.folders.filter((f) => f.parentId === null);
  const childrenOf = (parentId: string) => mailbox.folders.filter((f) => f.parentId === parentId);
  const primary = topLevel.filter((f) => CONTEXT_KINDS.has(f.kind));
  const rooms = topLevel.filter((f) => ROOM_KINDS.has(f.kind) && f.name.toLowerCase() !== "starred");
  const filing = topLevel.filter((f) => !CONTEXT_KINDS.has(f.kind) && !ROOM_KINDS.has(f.kind));

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
    <div>
      {companyMode ? (
        <div className="mr-box-head">
          <button type="button" onClick={() => setOpen((v) => !v)} className="mr-nav-link">
            {open ? <ChevronDown /> : <ChevronRight />}
            <span className="truncate" title={mailbox.address}>
              {mailbox.name}
            </span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            title={`New folder in ${mailbox.name}`}
            aria-label={`New folder in ${mailbox.name}`}
            onClick={() => setAdding((v) => !v)}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      ) : null}

      {open || !companyMode ? (
        <div>
          {primary.map((folder) => (
            <FolderBlock
              key={folder.id}
              mailbox={mailbox}
              folder={folder}
              children={childrenOf(folder.id)}
              selectedFolderId={selectedFolderId}
              onSelectFolder={onSelectFolder}
            />
          ))}

          {rooms.length > 0 ? (
            <div className="mr-nav-group">
              <p className="mr-nav-label">Rooms</p>
              {rooms.map((folder) => (
                <FolderBlock
                  key={folder.id}
                  mailbox={mailbox}
                  folder={folder}
                  children={childrenOf(folder.id)}
                  selectedFolderId={selectedFolderId}
                  onSelectFolder={onSelectFolder}
                />
              ))}
            </div>
          ) : null}

          {filing.length > 0 ? (
            <div className="mr-nav-group">
              <p className="mr-nav-label">Filing</p>
              {filing.map((folder) => (
                <FolderBlock
                  key={folder.id}
                  mailbox={mailbox}
                  folder={folder}
                  children={childrenOf(folder.id)}
                  selectedFolderId={selectedFolderId}
                  onSelectFolder={onSelectFolder}
                />
              ))}
            </div>
          ) : null}

          {!companyMode ? (
            <div className="mt-2 px-1">
              {adding ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                  }}
                >
                  <Input
                    autoFocus
                    value={name}
                    placeholder="New room"
                    onChange={(event) => setName(event.target.value)}
                    onBlur={() => {
                      if (name.trim().length === 0) setAdding(false);
                    }}
                    className="h-8 text-xs"
                  />
                </form>
              ) : (
                <button type="button" className="mr-nav-link" onClick={() => setAdding(true)}>
                  <Plus />
                  <span>New room</span>
                </button>
              )}
            </div>
          ) : adding ? (
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
                className="h-8 text-xs"
              />
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FolderBlock({
  mailbox,
  folder,
  children,
  selectedFolderId,
  onSelectFolder,
}: {
  mailbox: MailboxSummary;
  folder: Folder;
  children: Folder[];
  selectedFolderId: string | null;
  onSelectFolder: (mailbox: MailboxSummary, folder: Folder) => void;
}) {
  return (
    <div>
      <FolderRow
        folder={folder}
        depth={0}
        selected={folder.id === selectedFolderId}
        onSelect={() => onSelectFolder(mailbox, folder)}
      />
      {children.map((child) => (
        <FolderRow
          key={child.id}
          folder={child}
          depth={1}
          selected={child.id === selectedFolderId}
          onSelect={() => onSelectFolder(mailbox, child)}
        />
      ))}
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
      className={cn("mr-nav-link", depth > 0 && "pl-8", selected && "is-on")}
    >
      <Icon />
      <span className="min-w-0 flex-1 truncate">{folder.name}</span>
      {folder.unreadCount > 0 ? <span className="mr-nav-count">{folder.unreadCount}</span> : null}
    </button>
  );
}
