import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { SnoozeMenu } from "./SnoozeMenu";

describe("SnoozeMenu", () => {
  it("offers presets", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onPick = vi.fn();
    render(
      <SnoozeMenu
        label="Snooze conversation"
        anchor={{ x: 100, y: 100 }}
        onClose={onClose}
        onPick={onPick}
      />,
    );
    expect(screen.getByRole("menu", { name: "Snooze conversation" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: /Later today/i }));
    expect(onPick).toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <SnoozeMenu
        label="Snooze again"
        anchor={{ x: 100, y: 100 }}
        onClose={onClose}
        onPick={vi.fn()}
      />,
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
