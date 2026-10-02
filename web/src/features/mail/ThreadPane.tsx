import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Clock,
  ImageIcon,
  Mail,
  MailOpen,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, EmptyState, Skeleton } from "@/components/ui/misc";
import { emptyCopy } from "@/lib/emptyCopy";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  folderOfKind,
  useAliases,
  useMoveThreads,
  useSetFlags,
  useThreadMessages,
  type MailboxSummary,
  type Message,
  type Thread,
} from "@/lib/mailbox";
import { sanitizeEmailHtml } from "@/lib/sanitize";
import { ComposeSurface } from "./compose/ComposeSurface";
import type { ReplyMode } from "./compose/mail-recipients";
import { EmailBody } from "./EmailBody";
import { MessageAttachments } from "./MessageAttachments";
import { SnoozeMenu } from "./SnoozeMenu";
import { cn, displayName, formatFullDate, initials } from "@/lib/utils";

export function ThreadPane({
  thread,
  mailbox,
  onClosed,
  previewMessages,
  onReplyDirtyChange,
}: {
  thread: Thread | null;
  mailbox: MailboxSummary | undefined;
  onClosed: () => void;
  previewMessages?: Message[];
  onReplyDirtyChange?: (dirty: boolean) => void;
}) {
  const [snoozeAt, setSnoozeAt] = useState<{ x: number; y: number } | null>(null);
  const fetched = useThreadMessages(previewMessages ? undefined : thread?.id);
  const messages = previewMessages
    ? { data: previewMessages, isLoading: false, isError: false, error: null }
    : fetched;
  const setFlags = useSetFlags();
  const moveThreads = useMoveThreads();

  const markedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!thread || thread.read || previewMessages) return;
    if (markedRef.current === thread.id) return;
    markedRef.current = thread.id;
    setFlags.mutate({ threadId: thread.id, read: true });
  }, [thread, setFlags, previewMessages]);

  if (!thread) {
    return <EmptyState tone="desk" title={emptyCopy.desk.title} hint={emptyCopy.desk.hint} />;
  }

  const archive = folderOfKind(mailbox, "ARCHIVE");
  const trash = folderOfKind(mailbox, "TRASH");

  const move = (folderId: string | undefined) => {
    if (!folderId || previewMessages) return;
    moveThreads.mutate({ folderId, threadIds: [thread.id] }, { onSuccess: onClosed });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="mr-letter__head">
        <div className="min-w-0 flex-1">
          <h2 className="mr-letter__subj" title={thread.subject}>
            {thread.subject}
          </h2>
          <p className="mr-letter__from">
            {thread.correspondentName || thread.correspondent || "Unknown sender"}
            {thread.correspondent && thread.correspondentName ? ` · ${thread.correspondent}` : ""}
            {thread.messageCount > 1 ? ` · ${thread.messageCount} letters` : ""}
          </p>
        </div>
        <div className="mr-letter__acts">
          <Button
            variant="ghost"
            size="icon"
            title={thread.starred ? "Remove star" : "Add star"}
            aria-label={thread.starred ? "Remove star" : "Add star"}
            disabled={Boolean(previewMessages)}
            onClick={() => setFlags.mutate({ threadId: thread.id, starred: !thread.starred })}
          >
            <Star className={cn("size-4", thread.starred && "fill-warning text-warning")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title={thread.read ? "Mark unread" : "Mark read"}
            aria-label={thread.read ? "Mark unread" : "Mark read"}
            disabled={Boolean(previewMessages)}
            onClick={() => {
              markedRef.current = thread.id;
              setFlags.mutate({ threadId: thread.id, read: !thread.read });
            }}
          >
            {thread.read ? <Mail className="size-4" /> : <MailOpen className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Snooze"
            aria-label="Snooze"
            disabled={Boolean(previewMessages)}
            onClick={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              setSnoozeAt({ x: box.left, y: box.bottom + 4 });
            }}
          >
            <Clock className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Archive"
            aria-label="Archive"
            disabled={!archive || Boolean(previewMessages)}
            onClick={() => move(archive?.id)}
          >
            <Archive className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Move to trash"
            aria-label="Move to trash"
            disabled={!trash || Boolean(previewMessages)}
            onClick={() => move(trash?.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </header>

      <div className="mr-letter__body scrollbar-thin">
        {messages.isLoading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : messages.isError ? (
          <EmptyState
            title="This conversation would not load"
            hint={getApiErrorMessage(messages.error)}
          />
        ) : (
          <ul>
            {(messages.data ?? []).map((message, index) => (
              <MessageRow
                key={message.id}
                message={message}
                defaultOpen={index === (messages.data ?? []).length - 1}
              />
            ))}
          </ul>
        )}
      </div>

      <ReplyCompose
        key={thread.id}
        threadId={thread.id}
        mailbox={mailbox}
        messages={messages.data ?? []}
        preview={Boolean(previewMessages)}
        onDirtyChange={onReplyDirtyChange}
      />

      <SnoozeMenu
        label="Snooze conversation"
        disabled={Boolean(previewMessages)}
        anchor={snoozeAt}
        onClose={() => setSnoozeAt(null)}
        onPick={(iso) => {
          setFlags.mutate({ threadId: thread.id, snoozeUntil: iso, read: true });
          setSnoozeAt(null);
          onClosed();
        }}
      />
    </div>
  );
}

function MessageRow({ message, defaultOpen }: { message: Message; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [remoteImagesLoaded, setRemoteImagesLoaded] = useState(false);

  useEffect(() => {
    setRemoteImagesLoaded(false);
  }, [message.id]);

  // Sanitised once here purely to answer "would anything be blocked?", so the banner is not
  // offered on a message that has no remote images. EmailBody sanitises again for the frame,
  // with the isolated ruleset that keeps the message's own CSS.
  const blockedRemoteImages = useMemo(() => {
    if (remoteImagesLoaded || !message.bodyHtml) return false;
    return /data-blocked-src=/i.test(sanitizeEmailHtml(message.bodyHtml));
  }, [message.bodyHtml, remoteImagesLoaded]);

  const who = displayName(message.fromAddress, message.fromName);

  return (
    <li className="mr-message">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mr-message__who"
        aria-expanded={open}
        aria-controls={`message-body-${message.id}`}
      >
        {/* Seeded on the address, not the display name: the same person writing as
            "Sam" and "Samantha Reed" should stay one colour. */}
        <Avatar label={initials(who)} seed={message.fromAddress ?? who} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{who}</span>
            {message.direction === "OUTBOUND" ? <Badge tone="muted">Sent</Badge> : null}
            <time className="tabular shrink-0 text-xs text-text-muted" dateTime={message.occurredAt}>
              {formatFullDate(message.occurredAt)}
            </time>
          </div>
          <p className="truncate text-xs text-text-muted">
            {open ? (message.fromAddress ?? "") : (message.snippet ?? message.bodyText)}
          </p>
        </div>
      </button>

      {open ? (
        <div className="mr-message__copy" id={`message-body-${message.id}`}>
          {blockedRemoteImages ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-surface-muted px-3 py-2 text-xs text-text-muted">
              <ImageIcon className="size-3.5 shrink-0" aria-hidden />
              <span>Remote images are hidden so senders cannot track when you read this message.</span>
              <Button type="button" size="sm" variant="secondary" onClick={() => setRemoteImagesLoaded(true)}>
                Load images
              </Button>
            </div>
          ) : null}
          {message.bodyHtml ? (
            <EmailBody html={message.bodyHtml} allowRemoteImages={remoteImagesLoaded} />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed">
              {message.bodyText ?? "(no content)"}
            </pre>
          )}
          {message.attachmentCount > 0 ? (
            <MessageAttachments messageId={message.id} attachmentCount={message.attachmentCount} />
          ) : defaultOpen ? (
            <p className="mt-4 text-xs text-text-muted">{emptyCopy.attachments.title}</p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function ReplyCompose({
  threadId,
  mailbox,
  messages,
  preview,
  onDirtyChange,
}: {
  threadId: string;
  mailbox: MailboxSummary | undefined;
  messages: Message[];
  preview: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [mode, setMode] = useState<ReplyMode>("REPLY");
  const aliases = useAliases(mailbox?.id);
  const latest = messages.length > 0 ? messages[messages.length - 1] : undefined;
  const ourAddresses = [
    ...(mailbox ? [mailbox.address] : []),
    ...(aliases.data?.map((a) => a.address) ?? []),
  ];
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setMode("REPLY");
    setDirty(false);
    onDirtyChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    if (!dirty || preview) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, preview]);

  const requestReplyMode = (next: ReplyMode) => {
    if (dirty && next !== mode) {
      const leave = window.confirm("Discard this unsent reply?");
      if (!leave) return;
      setDirty(false);
      onDirtyChange?.(false);
    }
    setMode(next);
  };

  if (!mailbox) return null;

  return (
    <div className="mr-reply">
      <ComposeSurface
        layout="inline"
        mailboxes={[mailbox]}
        mailboxId={mailbox.id}
        threadId={threadId}
        replyMode={mode}
        onReplyModeChange={requestReplyMode}
        latestMessage={latest}
        ourAddresses={ourAddresses}
        preview={preview}
        disabled={preview}
        onDirtyChange={(next) => {
          setDirty(next);
          onDirtyChange?.(next);
        }}
      />
    </div>
  );
}
