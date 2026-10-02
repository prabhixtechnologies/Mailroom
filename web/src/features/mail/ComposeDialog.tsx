import { useCallback, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComposeSurface } from "./compose/ComposeSurface";
import { type Draft, type MailboxSummary } from "@/lib/mailbox";

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
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMailboxId(draft?.mailboxId ?? initialMailboxId ?? mailboxes[0]?.id ?? "");
    setDirty(false);
  }, [open, draft, initialMailboxId, mailboxes]);

  useEffect(() => {
    if (!open || !dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [open, dirty]);

  const requestClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && dirty) {
        const leave = window.confirm("Discard this unsaved message?");
        if (!leave) return;
      }
      if (!nextOpen) setDirty(false);
      onOpenChange(nextOpen);
    },
    [dirty, onOpenChange],
  );

  const activeMailbox = mailboxes.find((m) => m.id === mailboxId) ?? mailboxes[0];
  const ourAddresses = activeMailbox ? [activeMailbox.address] : [];

  return (
    <Dialog.Root open={open} onOpenChange={requestClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content className="mr-compose-panel fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[min(720px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <Dialog.Title asChild>
              <h2>Compose</h2>
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin">
            {open ? (
              <ComposeSurface
                layout="dialog"
                mailboxes={mailboxes}
                mailboxId={mailboxId || initialMailboxId || mailboxes[0]?.id || ""}
                onMailboxIdChange={setMailboxId}
                draft={draft}
                ourAddresses={ourAddresses}
                onDirtyChange={setDirty}
                onSent={() => requestClose(false)}
              />
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
