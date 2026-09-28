import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { ShortcutSheet } from "@/features/mail/ShortcutSheet";

/*
  The sheet is the only thing that makes the rest of the keyboard verbs real, so it gets the
  same treatment as anything else people have to be able to reach: it must be reachable,
  dismissible, and readable by a screen reader.
*/

function open() {
  const onClose = vi.fn();
  render(<ShortcutSheet open onClose={onClose} />);
  return onClose;
}

describe("ShortcutSheet", () => {
  it("renders nothing while closed", () => {
    render(<ShortcutSheet open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is a labelled modal dialog", () => {
    open();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Keyboard shortcuts");
  });

  it("documents no key that MailPage does not handle", () => {
    open();

    // A key printed here and bound nowhere is worse than an undocumented one, because it is
    // a promise. Read against the page rather than a second hand-written list, which would
    // only move the place the two can disagree.
    // From the package root: vitest runs with cwd there, and `import.meta.url` under jsdom
    // is an http URL rather than a file one.
    const page = readFileSync(resolve("src/features/mail/MailPage.tsx"), "utf8");
    const bound = new Set(
      [...page.matchAll(/event\.key === "([^"]+)"/g)].map((match) => match[1]),
    );
    // The arrow glyphs and "Esc" are how a person reads them, not how the DOM names them.
    const asEventKey: Record<string, string> = {
      "↓": "ArrowDown",
      "↑": "ArrowUp",
      Esc: "Escape",
    };

    const printed = screen.getAllByRole("definition").length;
    expect(printed).toBeGreaterThan(0);

    const undocumented = [...document.querySelectorAll("kbd")]
      .map((el) => el.textContent ?? "")
      .map((key) => asEventKey[key] ?? key)
      .filter((key) => !bound.has(key));

    expect(undocumented).toEqual([]);
  });

  it("moves focus into the sheet so a keyboard is not left behind it", () => {
    open();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = open();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on the button", async () => {
    const user = userEvent.setup();
    const onClose = open();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close on a click inside the panel", async () => {
    const user = userEvent.setup();
    const onClose = open();
    await user.click(screen.getByText("Keyboard shortcuts"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("has no axe violations", async () => {
    const { container } = render(<ShortcutSheet open onClose={vi.fn()} />);
    const results = await axe.run(container, {
      rules: {
        "color-contrast": { enabled: false },
        region: { enabled: false },
        "landmark-one-main": { enabled: false },
        "page-has-heading-one": { enabled: false },
      },
    });
    await waitFor(() => expect(results.violations.map((v) => v.id)).toEqual([]));
  });
});
