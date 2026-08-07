import type { RecurrenceFrequency } from "../types";

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayStr(): string {
  return formatDate(new Date());
}

// Local date + 24-hour time, e.g. "2026-07-11 21:34" — used for completion
// timestamps. Kept as "<date> <time>" (space-separated) so the date portion
// can still be pulled out for day-grouping via `datePartOf`.
export function nowTimestamp(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${formatDate(now)} ${h}:${min}`;
}

export function datePartOf(timestamp: string): string {
  return timestamp.split(" ")[0];
}

// Converts an internal "YYYY-MM-DD" (optionally followed by " HH:MM[:SS]",
// e.g. a completedAt/deletedAt/reminderAt timestamp) into the display format
// "DD:MM:YYYY", leaving any trailing time portion untouched. This is purely
// a rendering concern — every comparison, sort, and `<input type="date">`
// value in the app stays on the raw ISO string above, since that's what
// makes plain string comparison equivalent to chronological comparison
// (today/this-week filtering, Trash retention, etc. all depend on it).
// Anything that doesn't start with an ISO date (e.g. the "Unknown date"
// group-header sentinel) passes through unchanged.
export function formatDateDisplay(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
  if (!match) return value;
  const [, y, m, d, rest] = match;
  return `${d}:${m}:${y}${rest}`;
}

export function isOverdue(dueDate: string | null, dueTime: string | null, completed: boolean): boolean {
  if (dueDate == null || completed) return false;
  const today = todayStr();
  if (dueDate < today) return true;
  if (dueDate > today || !dueTime) return false;
  // Due today with a specific time — only overdue once that time has passed.
  const now = new Date();
  const nowHM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return dueTime < nowHM;
}

// The 7-day range containing today, starting on `weekStartsOn` (0=Sunday,
// 1=Monday — matching Date#getDay()) and matching whatever the Calendar
// view's week layout is currently configured to use.
export function getWeekRange(weekStartsOn: 0 | 1 = 0): [string, string] {
  const now = new Date();
  const offset = (now.getDay() - weekStartsOn + 7) % 7;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return [formatDate(start), formatDate(end)];
}

// The next date strictly after `dateStr` whose day-of-week (0=Sun..6=Sat,
// matching Date#getDay) is in `weekdays` — used for "every Mon/Wed/Fri"
// style weekly recurrence instead of the plain every-N-weeks interval.
// Bounded to 7 lookahead days since weekdays is assumed non-empty, so a
// match always exists within one week.
export function nextWeekdayOccurrence(dateStr: string, weekdays: number[]): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  for (let i = 0; i < 7; i++) {
    date.setDate(date.getDate() + 1);
    if (weekdays.includes(date.getDay())) return formatDate(date);
  }
  return formatDate(date);
}

// Advances a just-fired "<date> <time>" reminder to its next occurrence at
// least strictly after `now` — looping past any occurrences missed while the
// app was closed instead of replaying each one as a separate notification
// on the next 60-second tick, which is what a single `addInterval` step
// would otherwise do if the gap since the last fire is more than one
// interval. Always terminates since every step strictly advances the date.
export function nextReminderAfter(reminderAt: string, frequency: RecurrenceFrequency, now: string): string {
  const time = reminderAt.split(" ")[1] ?? "09:00";
  let next = reminderAt;
  do {
    next = `${addInterval(datePartOf(next), frequency, 1)} ${time}`;
  } while (next <= now);
  return next;
}

export function addInterval(dateStr: string, frequency: RecurrenceFrequency, interval: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  switch (frequency) {
    case "daily":
      date.setDate(date.getDate() + interval);
      break;
    case "weekly":
      date.setDate(date.getDate() + interval * 7);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + interval);
      break;
    case "yearly":
      date.setFullYear(date.getFullYear() + interval);
      break;
  }
  return formatDate(date);
}
