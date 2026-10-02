import { useQuery } from "@tanstack/react-query";
import { Download, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-client";
import { downloadMailAttachment, listMessageAttachments } from "@/lib/mail-attachments";

export function MessageAttachments({
  messageId,
  attachmentCount,
}: {
  messageId: string;
  attachmentCount: number;
}) {
  const query = useQuery({
    queryKey: ["mailbox", "attachments", messageId],
    queryFn: () => listMessageAttachments(messageId),
    enabled: attachmentCount > 0,
  });

  if (attachmentCount <= 0) return null;

  if (query.isLoading) {
    return <p className="mt-4 text-xs text-text-muted">Loading attachments…</p>;
  }

  if (query.isError) {
    return (
      <p className="mt-4 text-xs text-destructive">
        Attachments could not load: {getApiErrorMessage(query.error)}
      </p>
    );
  }

  const items = query.data ?? [];
  if (items.length === 0) {
    return (
      <p className="mt-4 text-xs text-text-muted">
        {attachmentCount} file{attachmentCount === 1 ? "" : "s"} attached
      </p>
    );
  }

  return (
    <ul className="mt-4 space-y-2" aria-label="Attachments">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center gap-2 rounded-md border border-border/70 bg-surface-muted px-3 py-2 text-xs"
        >
          <Paperclip className="size-3.5 shrink-0 text-text-muted" aria-hidden />
          <span className="min-w-0 flex-1 truncate font-medium">{item.filename}</span>
          <span className="tabular shrink-0 text-text-muted">{formatBytes(item.sizeBytes)}</span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label={`Download ${item.filename}`}
            onClick={() =>
              void downloadMailAttachment({ attachmentId: item.id, filename: item.filename })
            }
          >
            <Download className="size-3.5" />
            Download
          </Button>
        </li>
      ))}
    </ul>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
