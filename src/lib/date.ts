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

export function isOverdue(dueDate: string | null, completed: boolean): boolean {
  return dueDate != null && dueDate < todayStr() && !completed;
}

// The Sunday-through-Saturday range containing today, matching the
// calendar view's week layout (which also starts on Sunday).
export function getWeekRange(): [string, string] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return [formatDate(start), formatDate(end)];
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
