import { formatDate } from "./date";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export interface NaturalDateMatch {
  // The exact substrings matched in the original text, so they can be
  // stripped back out of the title once applied. `timeMatch`/`time` are only
  // present when a time phrase was found alongside the date phrase — time is
  // never detected on its own, since "due" only means anything once there's
  // a date to attach it to.
  dateMatch: string;
  date: string;
  timeMatch?: string;
  time?: string;
}

function daysUntilWeekday(base: Date, targetDay: number): number {
  return (targetDay - base.getDay() + 7) % 7;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

// Ordered most-specific-first, since e.g. "next monday" must be checked
// before bare "monday" or the "next " part would be left behind in the title.
const DATE_PATTERNS: Array<{ regex: RegExp; resolveDays: (m: RegExpMatchArray, today: Date) => number }> = [
  { regex: /\btoday\b/i, resolveDays: () => 0 },
  { regex: /\btomorrow\b/i, resolveDays: () => 1 },
  { regex: /\bin (\d+) days?\b/i, resolveDays: (m) => Number(m[1]) },
  { regex: /\bin (\d+) weeks?\b/i, resolveDays: (m) => Number(m[1]) * 7 },
  { regex: /\bnext week\b/i, resolveDays: () => 7 },
  {
    regex: /\bnext (sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
    resolveDays: (m, today) => daysUntilWeekday(today, WEEKDAYS.indexOf(m[1].toLowerCase())) + 7,
  },
  {
    regex: /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
    resolveDays: (m, today) => daysUntilWeekday(today, WEEKDAYS.indexOf(m[1].toLowerCase())),
  },
];

// Converts a parsed hour/minute/meridiem into 24-hour "HH:MM". An explicit
// 13-23 hour (e.g. "15:30") is already unambiguous and passed through as-is.
// Otherwise, with no am/pm given, 1-7 is assumed pm and 8-12 (and 0) is
// assumed am — a guess, but the closer one for how people casually write
// times without a marker ("call at 3" almost always means 3pm).
function to24Hour(hour: number, minute: number, meridiem: "am" | "pm" | null): string {
  if (hour > 12) {
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
  let h = hour % 12;
  const effectiveMeridiem = meridiem ?? (hour >= 1 && hour <= 7 ? "pm" : "am");
  if (effectiveMeridiem === "pm") h += 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const TIME_PATTERNS: Array<{ regex: RegExp; resolve: (m: RegExpMatchArray) => string }> = [
  // "at " is optional but consumed when present, so it doesn't get left
  // dangling in the title after the rest of the phrase is stripped out.
  { regex: /\b(?:at )?noon\b/i, resolve: () => "12:00" },
  { regex: /\b(?:at )?midnight\b/i, resolve: () => "00:00" },
  {
    regex: /\bat (\d{1,2}):(\d{2})\s*(am|pm)?\b/i,
    resolve: (m) => to24Hour(Number(m[1]), Number(m[2]), (m[3]?.toLowerCase() as "am" | "pm") ?? null),
  },
  {
    regex: /\bat (\d{1,2})\s*(am|pm)\b/i,
    resolve: (m) => to24Hour(Number(m[1]), 0, m[2].toLowerCase() as "am" | "pm"),
  },
  { regex: /\bat (\d{1,2})\b/i, resolve: (m) => to24Hour(Number(m[1]), 0, null) },
];

function parseNaturalTime(text: string): { match: string; time: string } | null {
  for (const { regex, resolve } of TIME_PATTERNS) {
    const m = text.match(regex);
    if (m) return { match: m[0], time: resolve(m) };
  }
  return null;
}

// Finds the first recognized date phrase in free-typed text (e.g. a task
// title) and resolves it to an actual calendar date, relative to `today`
// (defaults to now — overridable for testing). A bare weekday name means the
// next occurrence of that day *including today* (typing "friday" on a Friday
// means today); "next <weekday>" always skips the nearest occurrence and
// lands on the one after, whether that's today or later in the week. If a
// time phrase ("at 3pm", "noon", "at 15:30") is also present, it's resolved
// too — but only alongside a date match, never on its own.
export function parseNaturalDate(text: string, today: Date = new Date()): NaturalDateMatch | null {
  for (const { regex, resolveDays } of DATE_PATTERNS) {
    const m = text.match(regex);
    if (m) {
      const result: NaturalDateMatch = { dateMatch: m[0], date: formatDate(addDays(today, resolveDays(m, today))) };
      const timeResult = parseNaturalTime(text);
      if (timeResult) {
        result.timeMatch = timeResult.match;
        result.time = timeResult.time;
      }
      return result;
    }
  }
  return null;
}
