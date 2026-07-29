import type { RecurrenceFrequency } from "../types";

export type RepeatOption = "none" | RecurrenceFrequency;

export const REPEAT_LABELS: Record<RepeatOption, string> = {
  none: "Doesn't repeat",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};
