import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api-client";
import { useCompose, useSaveDraft, type Draft, type MailboxSummary } from "@/lib/mailbox";
import { toHtml } from "./ThreadPane";

/**
 * A new message.
 *
 * <p>Autosaves as a draft while it is open, so closing the tab mid-sentence is recoverable. The saved
 * draft is deleted by the send path rather than here — doing it here would leave a sent message and its
 * draft both in the list if the delete failed after the send succeeded.
 */
export function ComposeDialog({
  open,
  onOpenChange,
  mailboxes,
  initialMailboxId,
  draft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mailboxes: MailboxSummary[];
  initialMailboxId: string | undefined;
  draft?: Draft | null;
}) {
  const [mailboxId, setMailboxId] = useState(initialMailboxId ?? "");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);

  const compose = useCompose();
  const saveDraft = useSaveDraft();

  useEffect(() => {
    if (!open) return;
    setError(null);
    setMailboxId(draft?.mailboxId ?? initialMailboxId ?? "");
    setTo((draft?.to ?? []).join(", "));
    setCc((draft?.cc ?? []).join(", "));
    setSubject(draft?.subject ?? "");
    setBody(draft?.bodyHtml ? htmlToPlain(draft.bodyHtml) : "");
    setDraftId(draft?.id ?? null);
  }, [open, draft, initialMailboxId]);

  // Autosave on a timer rather than per keystroke: one row either way, but per keystroke is a request
  // per character and this is a mail client somebody may leave open all day.
  useEffect(() => {
    if (!open || !mailboxId) return;
    const hasContent = to.trim() || subject.trim() || body.trim();
    if (!hasContent) return;

    const timer = setTimeout(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      saveDraft.mutate(
        {
          mailboxId,
          to: splitAddresses(to),
          cc: splitAddresses(cc),
          subject: subject.trim() || undefined,
          bodyHtml: body.trim() ? toHtml(body) : undefined,
        },
        { onSuccess: (saved) => setDraftId(saved.id) },
      );
    }, 4000);
    return () => clearTimeout(timer);
    // saveDraft is deliberately excluded: its identity changes on every mutation state transition, so
    // depending on it would reset the timer the moment a save started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mailboxId, to, cc, subject, body]);

  const send = () => {
    const recipients = splitAddresses(to);
    if (!mailboxId) {
      setError("Choose which address to send from.");
      return;
    }
    if (recipients.length === 0) {
      setError("Add at least one recipient.");
      return;
    }
    setError(null);
    compose.mutate(
      {
        mailboxId,
        to: recipients,
        cc: splitAddresses(cc),
        subject: subject.trim() || undefined,
        bodyHtml: toHtml(body),
        draftId: draftId ?? undefined,
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => setError(getApiErrorMessage(err)),
      },
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[min(680px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <Dialog.Title className="text-sm font-semibold">New message</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-text-muted">From</span>
              <select
                value={mailboxId}
                onChange={(event) => setMailboxId(event.target.value)}
                className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm"
              >
                <option value="">Choose an address…</option>
                {mailboxes.map((mailbox) => (
                  <option key={mailbox.id} value={mailbox.id}>
                    {mailbox.name} · {mailbox.address}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-text-muted">To</span>
              <Input
                value={to}
                onChange={(event) => setTo(event.target.value)}
                placeholder="someone@example.com, another@example.com"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-text-muted">Cc</span>
              <Input value={cc} onChange={(event) => setCc(event.target.value)} />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-text-muted">Subject</span>
              <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-text-muted">Message</span>
              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className="min-h-[200px]"
              />
            </label>

            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>

          <div className="flex items-center gap-2 border-t border-border px-4 py-3">
            <Button onClick={send} disabled={compose.isPending}>
              <Send className="size-4" />
              {compose.isPending ? "Sending…" : "Send"}
            </Button>
            <span className="text-xs text-text-muted">
              {draftId ? "Saved as a draft" : "Drafts save automatically"}
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function splitAddresses(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Recovers the typed text from a saved draft's HTML.
 *
 * <p>Lossy on purpose. The compose box is plain text, so a draft round-trips through `toHtml` and back;
 * anything richer than paragraphs and line breaks was not typed here in the first place.
 */
function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}
