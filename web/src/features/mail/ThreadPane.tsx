import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Archive, Forward, Mail, MailOpen, Reply, ReplyAll, Send, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Avatar, Badge, EmptyState, Skeleton } from "@/components/ui/misc";
import { emptyCopy } from "@/lib/emptyCopy";
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
  previewMessages,
}: {
  thread: Thread | null;
  mailbox: MailboxSummary | undefined;
  onClosed: () => void;
  previewMessages?: Message[];
}) {
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

      <ReplyBox threadId={thread.id} preview={Boolean(previewMessages)} />
    </div>
  );
}

function MessageRow({ message, defaultOpen }: { message: Message; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (open && bodyRef.current) hardenLinks(bodyRef.current);
  }, [open, message.id]);

  const who = displayName(message.fromAddress, message.fromName);

  return (
    <li className="mr-message">
      <button type="button" onClick={() => setOpen((v) => !v)} className="mr-message__who">
        <Avatar label={initials(who)} />
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
        <div className="mr-message__copy">
          {message.bodyHtml ? (
            <div
              ref={bodyRef}
              className="email-html"
              dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(message.bodyHtml) }}
            />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed">
              {message.bodyText ?? "(no content)"}
            </pre>
          )}
          {message.attachmentCount > 0 ? (
            <p className="mt-4 text-xs text-text-muted">
              {message.attachmentCount} file{message.attachmentCount === 1 ? "" : "s"} attached
            </p>
          ) : defaultOpen ? (
            <p className="mt-4 text-xs text-text-muted">{emptyCopy.attachments.title}</p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function ReplyBox({ threadId, preview }: { threadId: string; preview: boolean }) {
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<"REPLY" | "REPLY_ALL" | "FORWARD">("REPLY");
  const [error, setError] = useState<string | null>(null);
  const reply = useReply();

  useEffect(() => {
    setBody("");
    setError(null);
  }, [threadId]);

  const send = () => {
    if (preview) return;
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
    <div className="mr-reply">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={mode === "FORWARD" ? "Add a note, then send…" : "Write a reply…"}
        className="min-h-[72px]"
      />
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button onClick={send} disabled={preview || reply.isPending || body.trim().length === 0}>
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
        <Button
          size="sm"
          variant={mode === "FORWARD" ? "secondary" : "ghost"}
          onClick={() => setMode("FORWARD")}
        >
          <Forward className="size-4" />
          Forward
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
