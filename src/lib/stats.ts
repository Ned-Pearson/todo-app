import type { Task } from "../types";
import { formatDate, datePartOf } from "./date";

// Shared by StatsView (the full charts/breakdowns page) and the "My Day"
// dashboard's small stats-glance strip, so both read completion counts and
// streaks the same way instead of two slightly different implementations
// drifting apart.

export function lastNDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    days.push(formatDate(d));
  }
  return days;
}

export function buildDailyCounts(tasks: Task[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (!t.completed || !t.completedAt) continue;
    const day = datePartOf(t.completedAt);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return counts;
}

// Consecutive-day streaks, Duolingo-style: an empty *today* doesn't zero out
// an in-progress streak (the day isn't over yet), but any other empty day
// does. Longest streak is bounded to whatever window `days` covers, so it
// reads as "in the last N days" rather than an all-time claim.
export function computeStreaks(counts: Map<string, number>, days: string[]): { current: number; longest: number } {
  let longest = 0;
  let running = 0;
  for (const day of days) {
    if ((counts.get(day) ?? 0) > 0) {
      running += 1;
      longest = Math.max(longest, running);
    } else {
      running = 0;
    }
  }

  let current = 0;
  let idx = days.length - 1;
  if ((counts.get(days[idx]) ?? 0) === 0) idx -= 1;
  for (; idx >= 0; idx--) {
    if ((counts.get(days[idx]) ?? 0) > 0) {
      current += 1;
    } else {
      break;
    }
  }
  return { current, longest };
}

export function weekStartOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - date.getDay());
  return formatDate(date);
}

export function buildWeeklyCounts(counts: Map<string, number>, days: string[]): Map<string, number> {
  const weekly = new Map<string, number>();
  for (const day of days) {
    const week = weekStartOf(day);
    weekly.set(week, (weekly.get(week) ?? 0) + (counts.get(day) ?? 0));
  }
  return weekly;
}
