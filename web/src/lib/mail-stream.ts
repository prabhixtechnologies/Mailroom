import { useEffect, useRef } from "react";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { getApiAuthHeaders, refreshApiSession } from "./api-client";
import { API_V1 } from "./config";
import { invalidateMailboxAfterStreamEvent } from "./mailbox";

export type MailStreamConnectionState = "connecting" | "connected" | "disconnected" | "error";

export const mailStreamEventSchema = z.object({
  type: z.string(),
  payload: z.unknown(),
});

export type MailStreamEvent = z.infer<typeof mailStreamEventSchema>;

const newMessagePayloadSchema = z.object({
  threadId: z.string(),
  messageId: z.string(),
});

export type MailStreamListener = (event: MailStreamEvent) => void;

const DEFAULT_BASE_RECONNECT_MS = 1_000;
const DEFAULT_MAX_RECONNECT_MS = 30_000;

interface ConnectMailStreamOptions {
  onEvent: MailStreamListener;
  onError?: (error: Error) => void;
  onStateChange?: (state: MailStreamConnectionState) => void;
  baseReconnectMs?: number;
  maxReconnectMs?: number;
}

function parseMailStreamEvent(raw: unknown): MailStreamEvent | null {
  const parsed = mailStreamEventSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Authenticated fetch-based SSE (EventSource cannot send Authorization). Reconnects with exponential
 * backoff until {@link disconnect} is called.
 */
export function connectMailStream({
  onEvent,
  onError,
  onStateChange,
  baseReconnectMs = DEFAULT_BASE_RECONNECT_MS,
  maxReconnectMs = DEFAULT_MAX_RECONNECT_MS,
}: ConnectMailStreamOptions): () => void {
  const controller = new AbortController();
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let reconnectAttempt = 0;
  let visibilityWait: (() => void) | undefined;

  const setState = (state: MailStreamConnectionState) => onStateChange?.(state);

  const waitUntilVisible = (): Promise<void> => {
    if (typeof document === "undefined" || !document.hidden) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const onVisible = () => {
        if (!document.hidden) {
          document.removeEventListener("visibilitychange", onVisible);
          if (visibilityWait === onVisible) visibilityWait = undefined;
          resolve();
        }
      };
      visibilityWait = onVisible;
      document.addEventListener("visibilitychange", onVisible);
    });
  };

  const scheduleReconnect = () => {
    if (stopped) return;
    const delay = Math.min(maxReconnectMs, baseReconnectMs * 2 ** reconnectAttempt);
    reconnectAttempt += 1;
    setState("disconnected");
    reconnectTimer = setTimeout(() => void run(), delay);
  };

  const run = async () => {
    if (stopped) return;
    await waitUntilVisible();
    if (stopped) return;
    setState("connecting");

    try {
      const response = await fetch(`${API_V1}/oneops/mail/stream`, {
        headers: getApiAuthHeaders({ Accept: "text/event-stream" }),
        signal: controller.signal,
        credentials: "include",
      });

      if (response.status === 401) {
        if (await refreshApiSession()) {
          reconnectAttempt = 0;
          return run();
        }
        throw new Error("Mail stream unauthorized");
      }

      if (!response.ok || !response.body) {
        throw new Error(`Mail stream failed (${response.status})`);
      }

      reconnectAttempt = 0;
      setState("connected");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!stopped) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const raw: unknown = JSON.parse(line.slice(6));
            const event = parseMailStreamEvent(raw);
            if (event) onEvent(event);
          } catch {
            // ignore malformed events
          }
        }
      }

      if (!stopped) scheduleReconnect();
    } catch (err) {
      if (controller.signal.aborted || stopped) return;
      setState("error");
      if (onError && err instanceof Error) onError(err);
      scheduleReconnect();
    }
  };

  void run();

  return () => {
    stopped = true;
    controller.abort();
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (visibilityWait && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", visibilityWait);
      visibilityWait = undefined;
    }
    setState("disconnected");
  };
}

export function handleMailStreamEvent(
  queryClient: QueryClient,
  event: MailStreamEvent,
  context: { selectedThreadId?: string | null; activeFolderId?: string | null },
): void {
  if (event.type === "new-message") {
    const payload = newMessagePayloadSchema.safeParse(event.payload);
    invalidateMailboxAfterStreamEvent(queryClient, {
      threadId: payload.success ? payload.data.threadId : undefined,
      activeFolderId: context.activeFolderId,
      selectedThreadId: context.selectedThreadId,
    });
    return;
  }
  // Helpdesk presence — Mailroom does not subscribe to UI for it yet.
}

export function useMailStream(options: {
  enabled?: boolean;
  selectedThreadId?: string | null;
  activeFolderId?: string | null;
}): void {
  const queryClient = useQueryClient();
  const selectedThreadIdRef = useRef(options.selectedThreadId);
  selectedThreadIdRef.current = options.selectedThreadId;
  const activeFolderIdRef = useRef(options.activeFolderId);
  activeFolderIdRef.current = options.activeFolderId;

  useEffect(() => {
    if (options.enabled === false) return;
    return connectMailStream({
      onEvent: (event) => {
        handleMailStreamEvent(queryClient, event, {
          selectedThreadId: selectedThreadIdRef.current,
          activeFolderId: activeFolderIdRef.current,
        });
      },
    });
  }, [queryClient, options.enabled]);
}

/** Test hook: whether a stream event should touch the open thread's messages query. */
export function shouldRefetchOpenThreadMessages(
  threadId: string | undefined,
  selectedThreadId: string | null | undefined,
): boolean {
  return !!threadId && !!selectedThreadId && threadId === selectedThreadId;
}
