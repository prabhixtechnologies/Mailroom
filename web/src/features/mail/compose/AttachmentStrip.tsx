import { Paperclip, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AttachmentRow = {
  fileId: string;
  filename: string;
  sizeBytes: number;
  status: "uploading" | "ready" | "error";
  percent?: number;
  error?: string;
};

export function AttachmentStrip({
  items,
  onPick,
  onRemove,
  onRetry,
  disabled,
}: {
  items: AttachmentRow[];
  onPick: (files: FileList) => void;
  onRemove: (fileId: string) => void;
  onRetry: (fileId: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-text-muted hover:text-text">
          <Paperclip className="size-3.5" aria-hidden />
          <span>Attach files</span>
          <input
            type="file"
            className="sr-only"
            aria-label="Attach files"
            multiple
            disabled={disabled}
            onChange={(event) => {
              const files = event.target.files;
              if (files?.length) onPick(files);
              event.target.value = "";
            }}
          />
        </label>
        <span className="text-xs text-text-muted">or drop files on the message area</span>
      </div>
      {items.length > 0 ? (
        <ul className="space-y-1.5" aria-label="Attachments">
          {items.map((item) => (
            <li
              key={item.fileId}
              className={cn(
                "flex items-center gap-2 rounded-md border border-border/70 bg-surface-muted px-2 py-1.5 text-xs",
                item.status === "error" && "border-destructive/40",
              )}
            >
              <span className="min-w-0 flex-1 truncate font-medium">{item.filename}</span>
              <span className="tabular shrink-0 text-text-muted">{formatBytes(item.sizeBytes)}</span>
              {item.status === "uploading" ? (
                <span className="tabular shrink-0 text-text-muted">{item.percent ?? 0}%</span>
              ) : null}
              {item.status === "error" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Retry ${item.filename}`}
                  onClick={() => onRetry(item.fileId)}
                >
                  <RefreshCw className="size-3.5" />
                </Button>
              ) : null}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label={`Remove ${item.filename}`}
                disabled={disabled || item.status === "uploading"}
                onClick={() => onRemove(item.fileId)}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
