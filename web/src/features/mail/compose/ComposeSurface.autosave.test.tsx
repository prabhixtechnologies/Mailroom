import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { ComposeSurface } from "./ComposeSurface";

const saveMutate = vi.fn();

vi.mock("@/lib/mailbox", () => ({
  useCompose: () => ({ isPending: false, mutate: vi.fn() }),
  useReply: () => ({ isPending: false, mutate: vi.fn() }),
  useSaveDraft: () => ({ mutate: saveMutate, isPending: false }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => ({ data: undefined, isPending: false }),
  };
});

vi.mock("./RichTextEditor", () => ({
  RichTextEditor: ({
    onChange,
  }: {
    onChange: (html: string) => void;
  }) => (
    <textarea
      aria-label="Message body"
      onChange={(event) => onChange(`<p>${event.target.value}</p>`)}
    />
  ),
}));

describe("ComposeSurface autosave", () => {
  beforeEach(() => {
    saveMutate.mockReset();
  });

  it(
    "autosaves after the debounce window",
    async () => {
    const user = userEvent.setup();
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <ComposeSurface
          layout="dialog"
          mailboxes={[
            {
              id: "m1",
              address: "you@example.com",
              name: "You",
              kind: "PERSONAL",
              mine: true,
              folders: [],
            },
          ]}
          mailboxId="m1"
          ourAddresses={["you@example.com"]}
        />
      </QueryClientProvider>,
    );

    await user.type(screen.getByLabelText("To"), "friend@example.com");
    await user.type(screen.getByLabelText("Message body"), "Hello");

    await waitFor(
      () => {
        expect(saveMutate).toHaveBeenCalled();
      },
      { timeout: 8000 },
    );
  },
    10_000,
  );
});
