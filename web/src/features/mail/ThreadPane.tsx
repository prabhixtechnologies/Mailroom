import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Archive, Mail, MailOpen, Reply, ReplyAll, Send, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Avatar, Badge, EmptyState, Skeleton } from "@/components/ui/misc";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  folderOfKind,
  useMoveThreads,
  useReply,
  useSetFlags,
  useThreadMessages,
  type MailboxSummary,
  type Message,
  type Thread,
} from "@/lib/mailbox";
import { hardenLinks, sanitizeEmailHtml } from "@/lib/sanitize";
import { cn, displayName, formatFullDate, initials } from "@/lib/utils";

export function ThreadPane({
  thread,
  mailbox,
  onClosed,
}: {
  thread: Thread | null;
  mailbox: MailboxSummary | undefined;
  onClosed: () => void;
}) {
  const messages = useThreadMessages(thread?.id);
  const setFlags = useSetFlags();
  const moveThreads = useMoveThreads();

  // Opening a conversation is what marks it read, which is the behaviour of every mail client and the
  // reason there is no "mark as read" button in the list. Deliberately fires once per thread: keyed on
  // the id so re-rendering does not repeat the call, and skipped when it is already read.
  const markedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!thread || thread.read) return;
    if (markedRef.current === thread.id) return;
    markedRef.current = thread.id;
    setFlags.mutate({ threadId: thread.id, read: true });
  }, [thread, setFlags]);

  if (!thread) {
    return (
      <EmptyState
        icon={<Mail className="size-8" />}
        title="Nothing selected"
        hint="Pick a conversation on the left to read it."
      />
    );
  }

  const archive = folderOfKind(mailbox, "ARCHIVE");
  const trash = folderOfKind(mailbox, "TRASH");

  const move = (folderId: string | undefined) => {
    if (!folderId) return;
    moveThreads.mutate({ folderId, threadIds: [thread.id] }, { onSuccess: onClosed });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-start gap-2 border-b border-border p-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg font-semibold tracking-tight" title={thread.subject}>
            {thread.subject}
          </h2>
          <p className="truncate text-xs text-text-muted">
            {thread.correspondent ?? "Unknown sender"}
            {thread.messageCount > 1 ? ` · ${thread.messageCount} messages` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            title={thread.starred ? "Remove star" : "Add star"}
            aria-label={thread.starred ? "Remove star" : "Add star"}
            onClick={() => setFlags.mutate({ threadId: thread.id, starred: !thread.starred })}
          >
            <Star className={cn("size-4", thread.starred && "fill-warning text-warning")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title={thread.read ? "Mark unread" : "Mark read"}
            aria-label={thread.read ? "Mark unread" : "Mark read"}
            onClick={() => {
              // Cleared so the effect above does not immediately mark it read again while the pane is
              // still open — which would make the button look broken.
              markedRef.current = thread.id;
              setFlags.mutate({ threadId: thread.id, read: !thread.read });
            }}
          >
            {thread.read ? <Mail className="size-4" /> : <MailOpen className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Archive"
            aria-label="Archive"
            disabled={!archive}
            onClick={() => move(archive?.id)}
          >
            <Archive className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Move to trash"
            aria-label="Move to trash"
            disabled={!trash}
            onClick={() => move(trash?.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {messages.isLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : messages.isError ? (
          <EmptyState
            title="This conversation would not load"
            hint={getApiErrorMessage(messages.error)}
          />
        ) : (
          <ul className="divide-y divide-border">
            {(messages.data ?? []).map((message, index) => (
              <MessageRow
                key={message.id}
                message={message}
                // The newest message is what somebody opened the thread to read. Older ones collapse,
                // which is the difference between a conversation and a wall of quoted replies.
                defaultOpen={index === (messages.data ?? []).length - 1}
              />
            ))}
          </ul>
        )}
      </div>

      <ReplyBox threadId={thread.id} />
    </div>
  );
}

function MessageRow({ message, defaultOpen }: { message: Message; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyRef = useRef<HTMLDivElement>(null);

  // After the sanitised HTML is in the DOM but before the browser paints, so links are already safe the
  // first time they are clickable.
  useLayoutEffect(() => {
    if (open && bodyRef.current) hardenLinks(bodyRef.current);
  }, [open, message.id]);

  const who = displayName(message.fromAddress, message.fromName);

  return (
    <li className="p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 text-left"
      >
        <Avatar label={initials(who)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{who}</span>
            {message.direction === "OUTBOUND" ? <Badge tone="muted">Sent</Badge> : null}
            <span className="shrink-0 text-xs text-text-muted">
              {formatFullDate(message.occurredAt)}
            </span>
          </div>
          {!open ? (
            <p className="truncate text-xs text-text-muted">{message.snippet ?? message.bodyText}</p>
          ) : (
            <p className="truncate text-xs text-text-muted">{message.fromAddress}</p>
          )}
        </div>
      </button>

      {open ? (
        <div className="mt-3 pl-11">
          {message.bodyHtml ? (
            <div
              ref={bodyRef}
              className="email-html"
              // Sanitised on the way in. Rendering a mail body without that is how a mail client hands
              // an attacker the reader's session — see lib/sanitize.ts.
              dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(message.bodyHtml) }}
            />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {message.bodyText ?? "(no content)"}
            </pre>
          )}
          {message.attachmentCount > 0 ? (
            <p className="mt-3 text-xs text-text-muted">
              {message.attachmentCount} attachment{message.attachmentCount === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function ReplyBox({ threadId }: { threadId: string }) {
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<"REPLY" | "REPLY_ALL">("REPLY");
  const [error, setError] = useState<string | null>(null);
  const reply = useReply();

  // A half-written reply belongs to the conversation it was written in, so switching threads must not
  // carry it across.
  useEffect(() => {
    setBody("");
    setError(null);
  }, [threadId]);

  const send = () => {
    const text = body.trim();
    if (text.length === 0) return;
    setError(null);
    reply.mutate(
      { threadId, replyMode: mode, bodyHtml: toHtml(text) },
      {
        onSuccess: () => setBody(""),
        onError: (err) => setError(getApiErrorMessage(err)),
      },
    );
  };

  return (
    <div className="border-t border-border p-3">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Write a reply…"
        className="min-h-[80px]"
      />
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      <div className="mt-2 flex items-center gap-2">
        <Button onClick={send} disabled={reply.isPending || body.trim().length === 0}>
          <Send className="size-4" />
          {reply.isPending ? "Sending…" : "Send"}
        </Button>
        <Button
          size="sm"
          variant={mode === "REPLY" ? "secondary" : "ghost"}
          onClick={() => setMode("REPLY")}
        >
          <Reply className="size-4" />
          Reply
        </Button>
        <Button
          size="sm"
          variant={mode === "REPLY_ALL" ? "secondary" : "ghost"}
          onClick={() => setMode("REPLY_ALL")}
        >
          <ReplyAll className="size-4" />
          Reply all
        </Button>
      </div>
    </div>
  );
}

/**
 * Turns what somebody typed into the HTML the send path expects.
 *
 * <p>Escaped first. The body goes out as HTML, so an unescaped `<` from a person writing about code
 * would arrive as markup — at best a mangled message, at worst this app injecting markup into the
 * recipient's mail client on their behalf.
 */
function toHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export { toHtml };
