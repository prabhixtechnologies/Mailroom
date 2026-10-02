import { useId } from "react";
import { Input } from "@/components/ui/input";

export function RecipientFields({
  to,
  cc,
  bcc,
  onToChange,
  onCcChange,
  onBccChange,
  showBcc,
  onToggleBcc,
  toError,
  ccError,
  bccError,
  disabled,
}: {
  to: string;
  cc: string;
  bcc: string;
  onToChange: (value: string) => void;
  onCcChange: (value: string) => void;
  onBccChange: (value: string) => void;
  showBcc: boolean;
  onToggleBcc: () => void;
  toError?: string;
  ccError?: string;
  bccError?: string;
  disabled?: boolean;
}) {
  const toId = useId();
  const ccId = useId();
  const bccId = useId();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start gap-2">
        <label htmlFor={toId} className="w-10 shrink-0 pt-2 text-xs font-medium text-text-muted">
          To
        </label>
        <div className="min-w-0 flex-1">
          <Input
            id={toId}
            value={to}
            disabled={disabled}
            onChange={(event) => onToChange(event.target.value)}
            placeholder="someone@example.com"
            aria-invalid={Boolean(toError)}
            aria-describedby={toError ? `${toId}-err` : undefined}
          />
          {toError ? (
            <p id={`${toId}-err`} className="mt-1 text-xs text-destructive">
              {toError}
            </p>
          ) : null}
        </div>
        {!showBcc ? (
          <button
            type="button"
            className="shrink-0 pt-2 text-xs text-text-muted hover:text-text"
            onClick={onToggleBcc}
            disabled={disabled}
          >
            Bcc
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start gap-2">
        <label htmlFor={ccId} className="w-10 shrink-0 pt-2 text-xs font-medium text-text-muted">
          Cc
        </label>
        <div className="min-w-0 flex-1">
          <Input
            id={ccId}
            value={cc}
            disabled={disabled}
            onChange={(event) => onCcChange(event.target.value)}
            aria-invalid={Boolean(ccError)}
          />
          {ccError ? <p className="mt-1 text-xs text-destructive">{ccError}</p> : null}
        </div>
      </div>

      {showBcc ? (
        <div className="flex flex-wrap items-start gap-2">
          <label htmlFor={bccId} className="w-10 shrink-0 pt-2 text-xs font-medium text-text-muted">
            Bcc
          </label>
          <div className="min-w-0 flex-1">
            <Input
              id={bccId}
              value={bcc}
              disabled={disabled}
              onChange={(event) => onBccChange(event.target.value)}
              aria-invalid={Boolean(bccError)}
            />
            {bccError ? <p className="mt-1 text-xs text-destructive">{bccError}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
