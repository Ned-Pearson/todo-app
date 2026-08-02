import type { Recurrence, RecurrenceFrequency } from "../types";
import { addInterval, nextWeekdayOccurrence } from "./date";

export type RepeatOption = "none" | RecurrenceFrequency;

export const REPEAT_LABELS: Record<RepeatOption, string> = {
  none: "Doesn't repeat",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

// What the Add Task modal and the detail modal's Repeat section both hand
// back to App.tsx — endDate and occurrences can be set independently or
// together; whichever bound the series hits first stops it.
// Index matches Date#getDay() (0=Sun..6=Sat).
export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface RecurrenceInput {
  frequency: RecurrenceFrequency;
  interval: number;
  endDate: string;
  occurrences: number | null;
  weekdays: number[] | null;
}

// The single place that decides how a recurring task's next due date is
// computed — weekday mode (specific days of the week) and plain interval
// mode are mutually exclusive, so every call site that needs to advance a
// series (completing, skipping, projecting future occurrences on the
// calendar) goes through here instead of re-deciding which one applies.
export function nextRecurrenceDate(baseDate: string, recurrence: Recurrence): string {
  if (recurrence.frequency === "weekly" && recurrence.weekdays && recurrence.weekdays.length > 0) {
    return nextWeekdayOccurrence(baseDate, recurrence.weekdays);
  }
  return addInterval(baseDate, recurrence.frequency, recurrence.interval);
}

// Previews the next `count` occurrences a not-yet-committed rule would
// produce, anchored off the due date currently being set up — the same
// projection logic (and occurrences/end-date bounds) the Calendar view's
// ghost-occurrence projection uses for an already-live recurrence, just
// starting from an input still being edited rather than a stored Recurrence
// row. `occurrences` counts the anchor date itself, so once it's down to 1
// there's nothing left to project beyond it.
export function previewOccurrences(anchorDate: string, input: RecurrenceInput, count: number): string[] {
  if (!anchorDate) return [];
  const dates: string[] = [];
  let current = anchorDate;
  let occurrencesLeft = input.occurrences;
  for (let i = 0; i < count; i++) {
    if (occurrencesLeft != null && occurrencesLeft <= 1) break;
    current =
      input.frequency === "weekly" && input.weekdays && input.weekdays.length > 0
        ? nextWeekdayOccurrence(current, input.weekdays)
        : addInterval(current, input.frequency, input.interval);
    if (occurrencesLeft != null) occurrencesLeft -= 1;
    if (input.endDate && current > input.endDate) break;
    dates.push(current);
  }
  return dates;
}
