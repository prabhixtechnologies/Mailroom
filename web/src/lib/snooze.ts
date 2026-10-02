import { addDays, nextMonday, setHours, setMinutes, setSeconds } from "date-fns";

export type SnoozePreset = {
  id: string;
  label: string;
  until: () => Date;
};

function atLocal(hour: number, minute: number, base: Date): Date {
  return setSeconds(setMinutes(setHours(base, hour), minute), 0);
}

/** Presets meant for quick snooze choices in the bulk and single-thread menus. */
export function snoozePresets(now = new Date()): SnoozePreset[] {
  const laterToday = atLocal(18, 0, now);
  const laterTodayUntil =
    laterToday.getTime() > now.getTime() + 30 * 60_000
      ? laterToday
      : new Date(now.getTime() + 3 * 60 * 60_000);

  const tomorrow = addDays(now, 1);
  const tomorrowMorning = atLocal(9, 0, tomorrow);

  const nextWeek = atLocal(9, 0, nextMonday(addDays(now, 1)));

  return [
    { id: "later-today", label: "Later today", until: () => laterTodayUntil },
    { id: "tomorrow", label: "Tomorrow morning", until: () => tomorrowMorning },
    { id: "next-week", label: "Next Monday", until: () => nextWeek },
  ];
}

export function snoozeUntilIso(date: Date): string {
  return date.toISOString();
}
