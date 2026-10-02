import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectMailStream } from "./mail-stream";

describe("connectMailStream reconnect", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("schedules a reconnect after the stream ends", async () => {
    const states: string[] = [];
    const body = {
      getReader: () => ({
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode("data: {}\n\n") })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      }),
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        body,
      })),
    );

    const disconnect = connectMailStream({
      onEvent: () => undefined,
      onStateChange: (state) => states.push(state),
      baseReconnectMs: 1000,
      maxReconnectMs: 1000,
    });

    await vi.runOnlyPendingTimersAsync();
    expect(states).toContain("connected");
    expect(states).toContain("disconnected");

    await vi.advanceTimersByTimeAsync(1000);
    expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThanOrEqual(2);

    disconnect();
  });
});
