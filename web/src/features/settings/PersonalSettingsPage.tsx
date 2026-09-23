import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SkipLink } from "@/components/SkipLink";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { apiRequest, getApiErrorMessage } from "@/lib/api-client";
import { ACCOUNT_URL } from "@/lib/config";
import { useAuth } from "@/lib/auth";
import {
  useAliases,
  useCreateAlias,
  useCreateFolder,
  useDeleteAlias,
  useDeleteFolder,
  useRenameFolder,
  useSidebar,
} from "@/lib/mailbox";

const mailboxDetailSchema = z.object({
  id: z.string(),
  signature: z.string().nullish(),
});

/**
 * Personal mail settings: aliases, signature, and folders for the mailbox you own.
 *
 * Shared-inbox administration (mailboxes, routing, tags, canned replies) lives in OneOps
 * Settings → Mail. This page never offers those.
 */
export function PersonalSettingsPage() {
  const { me } = useAuth();
  const sidebar = useSidebar();
  const personal = useMemo(
    () => (sidebar.data ?? []).find((m) => m.mine || m.kind === "PERSONAL") ?? (sidebar.data ?? [])[0],
    [sidebar.data],
  );

  return (
    <div className="mr-shell">
      <SkipLink />
      <header className="mr-top">
        <Link
          to="/"
          className="inline-flex size-11 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text"
          aria-label="Back to mail"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <span className="mr-top__name">Settings</span>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl space-y-10 p-6">
          {sidebar.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : !personal ? (
            <EmptyState
              title="No mailbox yet"
              hint="Somebody with mailbox admin needs to give you an address before there is anything to configure."
            />
          ) : (
            <>
              <p className="text-sm text-text-muted">
                {personal.address}
                {me?.email ? ` · signed in as ${me.email}` : ""}
              </p>
              {ACCOUNT_URL ? (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold">Prabhix account</h2>
                  <p className="text-xs text-text-muted">
                    Password, passkeys, and sessions live on Identity, not in Mailroom.
                  </p>
                  <Button asChild variant="outline">
                    <a href={ACCOUNT_URL}>Manage account</a>
                  </Button>
                </section>
              ) : null}
              <AliasesSection mailboxId={personal.id} />
              <SignatureSection mailboxId={personal.id} />
              <FoldersSection mailboxId={personal.id} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function AliasesSection({ mailboxId }: { mailboxId: string }) {
  const aliases = useAliases(mailboxId);
  const create = useCreateAlias();
  const remove = useDeleteAlias();
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string>();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    try {
      await create.mutateAsync({ mailboxId, address: address.trim() });
      setAddress("");
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Aliases</h2>
      <p className="text-xs text-text-muted">
        Extra addresses that deliver into this mailbox.
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {aliases.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : (aliases.data ?? []).length === 0 ? (
        <p className="text-sm text-text-muted">No aliases yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {(aliases.data ?? []).map((alias) => (
            <li key={alias.id} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm">{alias.address}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${alias.address}`}
                onClick={() =>
                  void remove
                    .mutateAsync({ mailboxId, aliasId: alias.id })
                    .catch((err) => setError(getApiErrorMessage(err)))
                }
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={(e) => void submit(e)} className="flex gap-2">
        <Input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="you+support@yourdomain.com"
          aria-label="New alias"
        />
        <Button type="submit" disabled={create.isPending || !address.trim()}>
          <Plus className="size-4" />
          Add
        </Button>
      </form>
    </section>
  );
}

function SignatureSection({ mailboxId }: { mailboxId: string }) {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["mailbox-signature", mailboxId],
    queryFn: () => apiRequest(`/mail/mailboxes/${mailboxId}`, mailboxDetailSchema),
    retry: false,
  });
  const update = useMutation({
    mutationFn: (signature: string) =>
      apiRequest(`/mail/mailboxes/${mailboxId}`, mailboxDetailSchema, {
        method: "PATCH",
        body: { signature },
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["mailbox-signature", mailboxId] }),
  });
  const [signature, setSignature] = useState("");
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (detail.data) setSignature(detail.data.signature ?? "");
  }, [detail.data]);

  const save = async () => {
    setError(undefined);
    setSaved(false);
    try {
      await update.mutateAsync(signature);
      setSaved(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Signature</h2>
      <p className="text-xs text-text-muted">Appended to mail you send from this mailbox. HTML is allowed.</p>
      {detail.isError ? (
        <p className="text-sm text-text-muted">
          Signature is edited under OneOps Settings → Mail when you do not have mailbox manage
          permission here.
        </p>
      ) : (
        <>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {saved ? <p className="text-sm text-success">Saved.</p> : null}
          <Textarea
            rows={4}
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            aria-label="Signature"
          />
          <Button onClick={() => void save()} disabled={update.isPending || detail.isPending}>
            {update.isPending ? "Saving…" : "Save signature"}
          </Button>
        </>
      )}
    </section>
  );
}

function FoldersSection({ mailboxId }: { mailboxId: string }) {
  const sidebar = useSidebar();
  const mailbox = (sidebar.data ?? []).find((m) => m.id === mailboxId);
  const create = useCreateFolder();
  const rename = useRenameFolder();
  const remove = useDeleteFolder();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string>();

  const custom = (mailbox?.folders ?? []).filter((f) => f.kind === "CUSTOM");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    try {
      await create.mutateAsync({ mailboxId, name: name.trim() });
      setName("");
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Folders</h2>
      <p className="text-xs text-text-muted">
        Inbox, Sent and the other system folders stay. Custom folders you add can be renamed or
        removed; threads in a deleted folder move back to the inbox.
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {custom.length === 0 ? (
        <p className="text-sm text-text-muted">No custom folders yet. You can also add them from the sidebar.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {custom.map((folder) => (
            <li key={folder.id} className="flex items-center gap-2 px-3 py-2">
              {editingId === folder.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    aria-label="Folder name"
                  />
                  <Button
                    size="sm"
                    disabled={rename.isPending || !editName.trim()}
                    onClick={() =>
                      void rename
                        .mutateAsync({ folderId: folder.id, name: editName.trim() })
                        .then(() => setEditingId(undefined))
                        .catch((err) => setError(getApiErrorMessage(err)))
                    }
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(undefined)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm">{folder.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingId(folder.id);
                      setEditName(folder.name);
                    }}
                  >
                    Rename
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${folder.name}`}
                    onClick={() =>
                      void remove.mutateAsync(folder.id).catch((err) => setError(getApiErrorMessage(err)))
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={(e) => void submit(e)} className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New folder"
          aria-label="New folder name"
        />
        <Button type="submit" disabled={create.isPending || !name.trim()}>
          <Plus className="size-4" />
          Add
        </Button>
      </form>
    </section>
  );
}
