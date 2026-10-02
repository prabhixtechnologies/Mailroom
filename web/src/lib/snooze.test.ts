import { describe, expect, it } from "vitest";
import { snoozePresets, snoozeUntilIso } from "./snooze";

describe("snoozePresets", () => {
  it("returns three quick choices in order", () => {
    const presets = snoozePresets(new Date("2026-10-02T10:00:00Z"));
    expect(presets.map((p) => p.id)).toEqual(["later-today", "tomorrow", "next-week"]);
    expect(presets[0]!.until().getTime()).toBeGreaterThan(Date.now() - 60_000);
  });
});

describe("snoozeUntilIso", () => {
  it("serialises in UTC", () => {
    const iso = snoozeUntilIso(new Date("2026-10-02T12:30:00.000Z"));
    expect(iso).toBe("2026-10-02T12:30:00.000Z");
  });
});
