import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, getApiErrorMessage } from "@/lib/api-client";
import {
  deletePendingAttachment,
  resolveDraftAttachmentRows,
  uploadMailAttachment,
  type PendingAttachment,
} from "@/lib/mail-attachments";
import {
  useCompose,
  useReply,
  useSaveDraft,
  type Draft,
  type MailboxSummary,
  type Message,
} from "@/lib/mailbox";
import { cn } from "@/lib/utils";
import { AttachmentStrip, type AttachmentRow } from "./AttachmentStrip";
import {
  dedupeRecipients,
  defaultReplyFields,
  invalidAddresses,
  joinAddressField,
  splitAddressField,
  type ReplyMode,
} from "./mail-recipients";
import { appendSignatureHtml } from "./mail-signature";
import { RecipientFields } from "./RecipientFields";
const RichTextEditor = lazy(() =>
  import("./RichTextEditor").then((module) => ({ default: module.RichTextEditor })),
);

const mailboxDetailSchema = z.object({
  id: z.string(),
  signature: z.string().nullish(),
});

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export function ComposeSurface({
  layout,
  mailboxes,
  mailboxId,
  onMailboxIdChange,
  draft,
  threadId,
  replyMode,
  onReplyModeChange,
  latestMessage,
  ourAddresses,
  preview,
  disabled,
  onSent,
  onDirtyChange,
}: {
  layout: "dialog" | "inline";
  mailboxes: MailboxSummary[];
  mailboxId: string;
  onMailboxIdChange?: (id: string) => void;
  draft?: Draft | null;
  threadId?: string;
  replyMode?: ReplyMode;
  onReplyModeChange?: (mode: ReplyMode) => void;
  latestMessage?: Message;
  ourAddresses: string[];
  preview?: boolean;
  disabled?: boolean;
  onSent?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const isReply = Boolean(threadId);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("<p></p>");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autosave, setAutosave] = useState<AutosaveStatus>("idle");
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const retryFiles = useRef(new Map<string, File>());
  const dirtyRef = useRef(false);

  const compose = useCompose();
  const reply = useReply();
  const saveDraft = useSaveDraft();

  const signatureQuery = useQuery({
    queryKey: ["mailbox-signature", mailboxId],
    queryFn: () => apiRequest(`/oneops/mail/mailboxes?id=${mailboxId}`, mailboxDetailSchema),
    enabled: Boolean(mailboxId) && !preview,
    retry: false,
  });

  const signatureHtml = signatureQuery.data?.signature ?? "";

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    onDirtyChange?.(true);
  }, [onDirtyChange]);

  const resetFromDraft = useCallback(
    (source: Draft | null | undefined) => {
      setTo(joinAddressField(source?.to ?? []));
      setCc(joinAddressField(source?.cc ?? []));
      setBcc(joinAddressField(source?.bcc ?? []));
      setShowBcc((source?.bcc?.length ?? 0) > 0);
      setSubject(source?.subject ?? "");
      setBodyHtml(source?.bodyHtml?.trim() ? source.bodyHtml : "<p></p>");
      setDraftId(source?.id ?? null);
      setAttachments(
        (source?.attachmentIds ?? []).map((fileId) => ({
          fileId,
          filename: "Attachment",
          sizeBytes: 0,
          status: "ready" as const,
        })),
      );
      dirtyRef.current = false;
      onDirtyChange?.(false);
    },
    [onDirtyChange],
  );

  useEffect(() => {
    const ids = draft?.attachmentIds ?? [];
    if (!draft || ids.length === 0 || preview) return;
    let cancelled = false;
    void resolveDraftAttachmentRows(ids).then((rows) => {
      if (cancelled) return;
      setAttachments(
        rows.map((row) => ({
          fileId: row.fileId,
          filename: row.filename,
          sizeBytes: row.sizeBytes,
          status: "ready" as const,
        })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [draft?.id, draft?.attachmentIds?.join(","), preview]);

  useEffect(() => {
    if (draft) {
      resetFromDraft(draft);
      return;
    }
    if (!isReply) {
      resetFromDraft(null);
    }
  }, [draft, isReply, threadId, resetFromDraft]);

  useEffect(() => {
    if (draft || !isReply || !latestMessage || !replyMode) return;
    const fields = defaultReplyFields(replyMode, latestMessage, ourAddresses);
    setTo(fields.to);
    setCc(fields.cc);
    setBcc("");
    setShowBcc(false);
    setBodyHtml("<p></p>");
    setDraftId(null);
    setAttachments([]);
    dirtyRef.current = false;
    onDirtyChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, replyMode, latestMessage?.id]);

  useEffect(() => {
    if (!mailboxId || preview) return;
    if (isReply && replyMode === "FORWARD") return;
    if (!signatureHtml.trim()) return;
    setBodyHtml((prev) => appendSignatureHtml(prev, signatureHtml));
    // Signature is applied once when the mailbox signature loads; not on every body edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailboxId, signatureHtml, preview, isReply, replyMode]);

  const readyAttachmentIds = useMemo(
    () => attachments.filter((a) => a.status === "ready").map((a) => a.fileId),
    [attachments],
  );

  const hasContent = useMemo(() => {
    const text = bodyHtml.replace(/<[^>]+>/g, "").trim();
    return (
      to.trim().length > 0 ||
      subject.trim().length > 0 ||
      text.length > 0 ||
      readyAttachmentIds.length > 0
    );
  }, [bodyHtml, readyAttachmentIds.length, subject, to]);

  useEffect(() => {
    if (preview || !mailboxId || !hasContent) return;
    const timer = setTimeout(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      const parsed = dedupeRecipients({
        to: splitAddressField(to),
        cc: splitAddressField(cc),
        bcc: splitAddressField(bcc),
      });
      setAutosave("saving");
      saveDraft.mutate(
        {
          threadId,
          mailboxId,
          replyMode: isReply ? replyMode : undefined,
          to: parsed.to,
          cc: parsed.cc,
          bcc: parsed.bcc,
          subject: subject.trim() || undefined,
          bodyHtml: bodyHtml.trim() === "<p></p>" ? undefined : bodyHtml,
          attachmentIds: readyAttachmentIds,
        },
        {
          onSuccess: (saved) => {
            setDraftId(saved.id);
            setAutosave("saved");
            dirtyRef.current = false;
            onDirtyChange?.(false);
          },
          onError: () => setAutosave("error"),
        },
      );
    }, 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    preview,
    mailboxId,
    threadId,
    replyMode,
    isReply,
    to,
    cc,
    bcc,
    subject,
    bodyHtml,
    readyAttachmentIds.join(","),
    hasContent,
  ]);

  const uploadFile = useCallback(async (file: File, tempId: string) => {
    retryFiles.current.set(tempId, file);
    setAttachments((rows) =>
      rows.map((row) =>
        row.fileId === tempId ? { ...row, status: "uploading", percent: 0, error: undefined } : row,
      ),
    );
    try {
      const pending: PendingAttachment = await uploadMailAttachment(file, (progress) => {
        setAttachments((rows) =>
          rows.map((row) =>
            row.fileId === tempId ? { ...row, percent: progress.percent } : row,
          ),
        );
      });
      retryFiles.current.delete(tempId);
      setAttachments((rows) =>
        rows.map((row) =>
          row.fileId === tempId
            ? {
                fileId: pending.fileId,
                filename: pending.filename,
                sizeBytes: pending.sizeBytes,
                status: "ready",
              }
            : row,
        ),
      );
      markDirty();
    } catch (err) {
      setAttachments((rows) =>
        rows.map((row) =>
          row.fileId === tempId
            ? { ...row, status: "error", error: getApiErrorMessage(err) }
            : row,
        ),
      );
    }
  }, [markDirty]);

  const onPickFiles = useCallback(
    (files: FileList) => {
      for (const file of Array.from(files)) {
        const tempId = `pending-${crypto.randomUUID()}`;
        setAttachments((rows) => [
          ...rows,
          {
            fileId: tempId,
            filename: file.name,
            sizeBytes: file.size,
            status: "uploading",
            percent: 0,
          },
        ]);
        markDirty();
        void uploadFile(file, tempId);
      }
    },
    [markDirty, uploadFile],
  );

  const removeAttachment = useCallback(
    (fileId: string) => {
      setAttachments((rows) => rows.filter((row) => row.fileId !== fileId));
      markDirty();
      if (!fileId.startsWith("pending-")) {
        void deletePendingAttachment(fileId).catch(() => undefined);
      }
    },
    [markDirty],
  );

  const validation = useMemo(() => {
    const parsed = dedupeRecipients({
      to: splitAddressField(to),
      cc: splitAddressField(cc),
      bcc: splitAddressField(bcc),
    });
    const badTo = invalidAddresses(parsed.to);
    const badCc = invalidAddresses(parsed.cc);
    const badBcc = invalidAddresses(parsed.bcc);
    const uploading = attachments.some((a) => a.status === "uploading");
    const bodyText = bodyHtml.replace(/<[^>]+>/g, "").trim();
    const needsRecipients = isReply
      ? replyMode === "FORWARD"
        ? parsed.to.length > 0
        : true
      : parsed.to.length > 0;
    return {
      parsed,
      badTo,
      badCc,
      badBcc,
      uploading,
      canSend:
        !disabled &&
        !preview &&
        !uploading &&
        needsRecipients &&
        badTo.length === 0 &&
        badCc.length === 0 &&
        badBcc.length === 0 &&
        (bodyText.length > 0 || readyAttachmentIds.length > 0),
    };
  }, [
    attachments,
    bcc,
    bodyHtml,
    cc,
    disabled,
    isReply,
    preview,
    readyAttachmentIds.length,
    replyMode,
    to,
  ]);

  const send = () => {
    if (!validation.canSend || !mailboxId) return;
    if (isReply && threadId) {
      setError(null);
      reply.mutate(
        {
          threadId,
          replyMode: replyMode ?? "REPLY",
          to: validation.parsed.to,
          cc: validation.parsed.cc,
          bcc: validation.parsed.bcc,
          bodyHtml,
          attachmentIds: readyAttachmentIds,
        },
        {
          onSuccess: () => {
            dirtyRef.current = false;
            onDirtyChange?.(false);
            setBodyHtml("<p></p>");
            setAttachments([]);
            onSent?.();
          },
          onError: (err) => setError(getApiErrorMessage(err)),
        },
      );
      return;
    }
    setError(null);
    compose.mutate(
      {
        mailboxId,
        to: validation.parsed.to,
        cc: validation.parsed.cc,
        bcc: validation.parsed.bcc,
        subject: subject.trim() || undefined,
        bodyHtml,
        attachmentIds: readyAttachmentIds,
        draftId: draftId ?? undefined,
      },
      {
        onSuccess: () => {
          dirtyRef.current = false;
          onDirtyChange?.(false);
          onSent?.();
        },
        onError: (err) => setError(getApiErrorMessage(err)),
      },
    );
  };

  const autosaveLabel =
    autosave === "saving"
      ? "Saving draft…"
      : autosave === "saved"
        ? "Draft saved"
        : autosave === "error"
          ? "Draft could not save"
          : draftId
            ? "Draft saves automatically"
            : "Drafts save automatically";

  const sending = compose.isPending || reply.isPending;

  return (
    <div
      className={cn("space-y-3", layout === "inline" && "mr-reply-compose")}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        if (event.dataTransfer.files.length) onPickFiles(event.dataTransfer.files);
      }}
    >
      {layout === "dialog" && onMailboxIdChange ? (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-text-muted">From</span>
          <select
            value={mailboxId}
            onChange={(event) => {
              markDirty();
              onMailboxIdChange(event.target.value);
            }}
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm"
            disabled={disabled || preview}
          >
            <option value="">Choose an address…</option>
            {mailboxes.map((mailbox) => (
              <option key={mailbox.id} value={mailbox.id}>
                {mailbox.name} · {mailbox.address}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <RecipientFields
        to={to}
        cc={cc}
        bcc={bcc}
        showBcc={showBcc}
        onToggleBcc={() => setShowBcc(true)}
        disabled={disabled || preview}
        toError={
          validation.badTo.length
            ? `Invalid address${validation.badTo.length > 1 ? "es" : ""}: ${validation.badTo.join(", ")}`
            : undefined
        }
        ccError={
          validation.badCc.length ? `Invalid Cc: ${validation.badCc.join(", ")}` : undefined
        }
        bccError={
          validation.badBcc.length ? `Invalid Bcc: ${validation.badBcc.join(", ")}` : undefined
        }
        onToChange={(value) => {
          markDirty();
          setTo(value);
        }}
        onCcChange={(value) => {
          markDirty();
          setCc(value);
        }}
        onBccChange={(value) => {
          markDirty();
          setBcc(value);
        }}
      />

      {layout === "dialog" ? (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-text-muted">Subject</span>
          <Input
            value={subject}
            disabled={disabled || preview}
            onChange={(event) => {
              markDirty();
              setSubject(event.target.value);
            }}
          />
        </label>
      ) : null}

      <div
        className={cn(
          "rounded-md border border-border",
          dragOver && "ring-2 ring-[var(--mr-accent)] ring-offset-1",
        )}
      >
        <Suspense
          fallback={
            <div className="mr-rich-editor mr-rich-editor--loading min-h-[120px]" aria-busy="true" />
          }
        >
          <RichTextEditor
            html={bodyHtml}
            disabled={disabled || preview}
            ariaLabel={isReply ? "Reply message" : "Message body"}
            placeholder={
              isReply && replyMode === "FORWARD" ? "Add a note, then send…" : "Write your message…"
            }
            onChange={(html) => {
              markDirty();
              setBodyHtml(html);
            }}
          />
        </Suspense>
      </div>

      <AttachmentStrip
        items={attachments}
        disabled={disabled || preview}
        onPick={onPickFiles}
        onRemove={removeAttachment}
        onRetry={(fileId) => {
          const file = retryFiles.current.get(fileId);
          if (file) void uploadFile(file, fileId);
        }}
      />

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={send} disabled={!validation.canSend || sending}>
          <Send className="size-4" />
          {sending ? "Sending…" : "Send"}
        </Button>
        {isReply && onReplyModeChange ? (
          <>
            <ModeButton active={replyMode === "REPLY"} onClick={() => onReplyModeChange("REPLY")}>
              Reply
            </ModeButton>
            <ModeButton active={replyMode === "REPLY_ALL"} onClick={() => onReplyModeChange("REPLY_ALL")}>
              Reply all
            </ModeButton>
            <ModeButton active={replyMode === "FORWARD"} onClick={() => onReplyModeChange("FORWARD")}>
              Forward
            </ModeButton>
          </>
        ) : null}
        <span className="text-xs text-text-muted" aria-live="polite">
          {autosaveLabel}
        </span>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: import("react").ReactNode;
}) {
  return (
    <Button size="sm" variant={active ? "secondary" : "ghost"} onClick={onClick} type="button">
      {children}
    </Button>
  );
}
