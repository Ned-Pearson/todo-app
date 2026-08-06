import type { CSSProperties } from "react";
import type { Task } from "../types";
import { formatDate, datePartOf, todayStr, formatDateDisplay } from "../lib/date";

interface Props {
  tasks: Task[];
}

const WINDOW_DAYS = 84; // 12 weeks, so the weekly chart and the streak
// calculation both draw from the same consistent window.
const DAILY_CHART_DAYS = 30;

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    days.push(formatDate(d));
  }
  return days;
}

function buildDailyCounts(tasks: Task[]): Map<string, number> {
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
// does. Longest streak is bounded to the same window used everywhere else
// here, so it reads as "in the last 12 weeks" rather than an all-time claim.
function computeStreaks(counts: Map<string, number>, days: string[]): { current: number; longest: number } {
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

function weekStartOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - date.getDay());
  return formatDate(date);
}

function buildWeeklyCounts(counts: Map<string, number>, days: string[]): Map<string, number> {
  const weekly = new Map<string, number>();
  for (const day of days) {
    const week = weekStartOf(day);
    weekly.set(week, (weekly.get(week) ?? 0) + (counts.get(day) ?? 0));
  }
  return weekly;
}

function BarChart({ entries, barTitle }: { entries: [string, number][]; barTitle: (date: string, count: number) => string }) {
  const max = Math.max(1, ...entries.map(([, count]) => count));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 70 }}>
      {entries.map(([date, count]) => (
        <div
          key={date}
          title={barTitle(date, count)}
          style={{
            flex: 1,
            height: `${Math.max((count / max) * 100, count > 0 ? 6 : 2)}%`,
            background: count > 0 ? "var(--color-accent)" : "var(--color-border)",
            borderRadius: 2,
            minWidth: 2,
          }}
        />
      ))}
    </div>
  );
}

export default function StatsView({ tasks }: Props) {
  const days = lastNDays(WINDOW_DAYS);
  const dailyCounts = buildDailyCounts(tasks);
  const weeklyCounts = buildWeeklyCounts(dailyCounts, days);
  const { current, longest } = computeStreaks(dailyCounts, days);

  const today = todayStr();
  const completedToday = dailyCounts.get(today) ?? 0;
  const completedThisWeek = weeklyCounts.get(weekStartOf(today)) ?? 0;
  const totalCompleted = tasks.filter((t) => t.completed).length;

  const dailyEntries: [string, number][] = days.slice(-DAILY_CHART_DAYS).map((d) => [d, dailyCounts.get(d) ?? 0]);
  const weekStarts: string[] = [];
  for (let i = 0; i < WINDOW_DAYS; i += 7) weekStarts.push(weekStartOf(days[i]));
  const weeklyEntries: [string, number][] = weekStarts.map((w) => [w, weeklyCounts.get(w) ?? 0]);

  const statCardStyle: CSSProperties = {
    flex: 1,
    minWidth: 120,
    padding: "12px 14px",
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    boxShadow: "var(--shadow-card)",
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div style={statCardStyle}>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>Current streak</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{current}d</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>Longest streak (12wk)</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{longest}d</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>Completed today</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{completedToday}</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>This week</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{completedThisWeek}</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>Total completed</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{totalCompleted}</div>
        </div>
      </div>

      <div
        style={{
          padding: 16,
          marginBottom: 20,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Last {DAILY_CHART_DAYS} days</div>
        <BarChart entries={dailyEntries} barTitle={(date, count) => `${count} completed on ${formatDateDisplay(date)}`} />
      </div>

      <div
        style={{
          padding: 16,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Last 12 weeks</div>
        <BarChart entries={weeklyEntries} barTitle={(week, count) => `${count} completed the week of ${formatDateDisplay(week)}`} />
      </div>
    </div>
  );
}
