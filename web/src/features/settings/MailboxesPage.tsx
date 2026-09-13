import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { AlertTriangle, Inbox, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, EmptyState, Skeleton } from "@/components/ui/misc";
import * as Dialog from "@radix-ui/react-dialog";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  useAdminMailboxes,
  useCreateMailbox,
  useDeleteMailbox,
  type MailboxAdminSummary,
} from "@/lib/mailbox-admin";
import { adminErrorHint } from "./SettingsLayout";

export function MailboxesPage() {
  const mailboxes = useAdminMailboxes();
  const create = useCreateMailbox();
  const remove = useDeleteMailbox();
  const navigate = useNavigate();

  const [showCreate, setShowCreate] = useState(false);
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState<MailboxAdminSummary>();

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    try {
      const created = await create.mutateAsync({
        address: address.trim(),
        name: name.trim(),
      });
      setShowCreate(false);
      setAddress("");
      setName("");
      navigate(`/settings/mailboxes/${created.id}`);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setError(undefined);
    try {
      await remove.mutateAsync(confirmDelete.id);
      setConfirmDelete(undefined);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight">Mailboxes</h1>
          <p className="mt-1 text-sm text-text-muted">
            Shared inboxes your team works from the queue.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
          <Plus className="size-4" />
          Add mailbox
        </Button>
      </div>

      {error ? (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {showCreate ? (
        <form
          onSubmit={(e) => void submitCreate(e)}
          className="mb-6 space-y-3 rounded-lg border border-border p-4"
        >
          <h2 className="text-sm font-medium">New shared mailbox</h2>
          <div>
            <label className="mb-1 block text-xs text-text-muted" htmlFor="mb-address">
              Address
            </label>
            <Input
              id="mb-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="support@yourcompany.com"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted" htmlFor="mb-name">
              Display name
            </label>
            <Input
              id="mb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Support"
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {mailboxes.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : mailboxes.isError ? (
        <EmptyState
          icon={<AlertTriangle className="size-8" />}
          title="Mailboxes could not be loaded"
          hint={adminErrorHint(mailboxes.error) ?? getApiErrorMessage(mailboxes.error)}
        />
      ) : (mailboxes.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-8" />}
          title="No mailboxes yet"
          hint="Add a shared mailbox to start receiving mail in the queue."
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {(mailboxes.data ?? []).map((mb) => (
            <li key={mb.id} className="flex items-center gap-3 px-4 py-3">
              <Link
                to={`/settings/mailboxes/${mb.id}`}
                className="min-w-0 flex-1 hover:text-primary"
              >
                <div className="truncate text-sm font-medium">{mb.name}</div>
                <div className="truncate text-xs text-text-muted">{mb.address}</div>
              </Link>
              <Badge tone="muted">{mb.kind.toLowerCase()}</Badge>
              <span className="shrink-0 text-xs text-text-muted">
                {mb.openThreadCount} open
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${mb.name}`}
                onClick={() => setConfirmDelete(mb)}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {confirmDelete ? (
        <ConfirmDialog
          title={`Delete ${confirmDelete.name}?`}
          hint="The mailbox will be archived. Existing threads stay in the database but no new mail is accepted."
          busy={remove.isPending}
          onCancel={() => setConfirmDelete(undefined)}
          onConfirm={() => void doDelete()}
        />
      ) : null}
    </div>
  );
}

export function ConfirmDialog({
  title,
  hint,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  hint?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-5">
          <Dialog.Title className="text-sm font-semibold">{title}</Dialog.Title>
          <Dialog.Description className={hint ? "mt-2 text-xs text-text-muted" : "sr-only"}>
            {hint ?? "This cannot be undone."}
          </Dialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={onConfirm} disabled={busy}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
