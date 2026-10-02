import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useThreadSelection } from "./useThreadSelection";

describe("useThreadSelection", () => {
  it("selects and clears only the visible page", () => {
    const { result, rerender } = renderHook(
      ({ ids, scope }) => useThreadSelection(ids, scope),
      { initialProps: { ids: ["a", "b"], scope: "folder-1" } },
    );

    act(() => result.current.toggle("a"));
    expect(result.current.selectedCount).toBe(1);

    act(() => result.current.toggleAllVisible());
    expect(result.current.allVisibleSelected).toBe(true);

    act(() => result.current.toggleAllVisible());
    expect(result.current.selectedCount).toBe(0);

    rerender({ ids: ["c"], scope: "folder-2" });
    expect(result.current.selectedCount).toBe(0);
  });
});
