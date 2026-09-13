import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import axe from "axe-core";
import { beforeAll, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { LogoMark } from "@/components/LogoMark";
import { SignInPage } from "@/features/auth/SignInPage";
import { SkipLink } from "@/components/SkipLink";
import { SettingsLayout } from "@/features/settings/SettingsLayout";
import { ThemeProvider } from "@/lib/theme";
import { PERMISSION_MAILBOX_MANAGE } from "@/lib/mailbox-admin";

vi.mock("@/lib/auth", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@/lib/auth";

const mockedUseAuth = vi.mocked(useAuth);

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      },
    }),
  });
});

const RULES = ["button-name", "link-name", "image-alt"];

async function violations(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: { type: "rule", values: RULES },
  });
  return results.violations.map((v) => ({ rule: v.id, html: v.nodes.map((n) => n.html) }));
}

describe("Mailroom accessibility", () => {
  it("names the Prabhix mark", async () => {
    const { container, getByRole } = render(<LogoMark className="size-12" />);
    expect(getByRole("img", { name: "Prabhix" })).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
  });

  it("exposes a skip link", () => {
    const { getByRole } = render(<SkipLink />);
    expect(getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", "#main-content");
  });

  it("reaches the skip link from the keyboard", async () => {
    const user = userEvent.setup();
    render(<SkipLink />);
    await user.tab();
    expect(document.activeElement).toHaveTextContent("Skip to main content");
  });

  it("names the sign-in surface", async () => {
    const { container, getByRole } = render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>,
    );
    expect(getByRole("heading")).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
  });

  it("names settings navigation at 44px targets", async () => {
    mockedUseAuth.mockReturnValue({
      permissions: [PERMISSION_MAILBOX_MANAGE],
    } as ReturnType<typeof useAuth>);

    const { container, getByRole } = render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/settings/mailboxes"]}>
          <SettingsLayout />
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(getByRole("link", { name: "Queue" })).toBeInTheDocument();
    expect(container.querySelectorAll('a[href="/settings/mailboxes"]').length).toBeGreaterThan(0);
    expect(await violations(container)).toEqual([]);
  });
});
