import { useEffect, useRef, type RefObject } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { Thread } from "@/lib/mailbox";

export type MailShortcutHandlers = {
  onFocusSearch: () => void;
  onToggleShortcutSheet: () => void;
  onCompose: () => void;
  onArchive?: () => void;
  onTrash?: () => void;
  onSnooze?: () => void;
  onMarkRead?: () => void;
  onToggleStar?: () => void;
  onToggleSelect?: () => void;
};

/**
 * Window-level mail shortcuts. Keys are bound here so ShortcutSheet can be tested against
 * one file rather than the whole page shell.
 */
export function useMailKeyboardShortcuts(
  searchRef: RefObject<HTMLInputElement | null>,
  selectedThread: Thread | null,
  setFlags: UseMutationResult<unknown, Error, { threadId: string; read?: boolean; starred?: boolean }>,
  handlers: MailShortcutHandlers,
) {
  const liveThread = useRef<Thread | null>(null);
  liveThread.current = selectedThread;
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onWindowKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const h = handlersRef.current;

      if (event.key === "/") {
        event.preventDefault();
        h.onFocusSearch();
        searchRef.current?.focus();
        return;
      }
      if (event.key === "?") {
        event.preventDefault();
        h.onToggleShortcutSheet();
        return;
      }
      if (event.key === "c") {
        event.preventDefault();
        h.onCompose();
        return;
      }

      const thread = liveThread.current;

      if (event.key === "x" && thread) {
        event.preventDefault();
        h.onToggleSelect?.();
        return;
      }

      if (!thread) return;

      if (event.key === "s") {
        event.preventDefault();
        if (h.onToggleStar) h.onToggleStar();
        else setFlags.mutate({ threadId: thread.id, starred: !thread.starred });
        return;
      }
      if (event.key === "u") {
        event.preventDefault();
        if (h.onMarkRead) h.onMarkRead();
        else setFlags.mutate({ threadId: thread.id, read: !thread.read });
        return;
      }
      if (event.key === "r") {
        event.preventDefault();
        setFlags.mutate({ threadId: thread.id, read: true });
        return;
      }
      if (event.key === "e") {
        event.preventDefault();
        h.onArchive?.();
        return;
      }
      if (event.key === "#" || event.key === "Delete") {
        event.preventDefault();
        h.onTrash?.();
        return;
      }
      if (event.key === "b") {
        event.preventDefault();
        h.onSnooze?.();
      }
    };
    window.addEventListener("keydown", onWindowKey);
    return () => window.removeEventListener("keydown", onWindowKey);
  }, [searchRef, setFlags]);
}
