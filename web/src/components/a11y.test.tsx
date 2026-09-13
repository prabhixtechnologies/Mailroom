import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { LogoMark } from "@/components/LogoMark";
import { SignInPage } from "@/features/auth/SignInPage";
import { SkipLink } from "@/components/SkipLink";

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

  it("names the sign-in surface", async () => {
    const { container, getByRole } = render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>,
    );
    expect(getByRole("heading")).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
  });
});
