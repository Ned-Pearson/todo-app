import type { RecurrenceFrequency } from "../types";

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
export interface RecurrenceInput {
  frequency: RecurrenceFrequency;
  interval: number;
  endDate: string;
  occurrences: number | null;
}
