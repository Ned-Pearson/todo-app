import type { CSSProperties } from "react";
import type { CustomTab, Tag, Task } from "../types";
import { formatDate, datePartOf, todayStr, formatDateDisplay } from "../lib/date";

interface Props {
  tasks: Task[];
  customTabs: CustomTab[];
  tags: Tag[];
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

interface BreakdownEntry {
  key: string;
  label: string;
  count: number;
  color: string | null;
}

// Horizontal, since list/tag names vary a lot in length and there can be
// more of them than would fit as readable vertical bars (unlike the fixed
// 30/12-wide daily/weekly charts above, which are always the same length).
function BreakdownBars({ entries }: { entries: BreakdownEntry[] }) {
  const max = Math.max(1, ...entries.map((e) => e.count));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {entries.map((e) => (
        <div key={e.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            title={e.label}
            style={{
              width: 110,
              flexShrink: 0,
              fontSize: 12,
              color: "var(--color-text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {e.label}
          </div>
          <div
            style={{
              flex: 1,
              height: 8,
              background: "var(--color-surface-sunken)",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(e.count / max) * 100}%`,
                height: "100%",
                background: e.color ?? "var(--color-accent)",
                borderRadius: 4,
              }}
            />
          </div>
          <div style={{ width: 24, textAlign: "right", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{e.count}</div>
        </div>
      ))}
    </div>
  );
}

export default function StatsView({ tasks, customTabs, tags }: Props) {
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

  // All-time (not windowed like the two charts above), matching "Total
  // completed" — these are a snapshot of where completions have landed, not
  // a recent-activity view. A task counts toward every tag it carries
  // (directly or via an ancestor), same as the tag filter chips elsewhere,
  // so the per-tag total can exceed the per-list/overall total.
  const listBreakdown: BreakdownEntry[] =
    customTabs.length === 0
      ? []
      : [
          ...customTabs.map((tab) => ({
            key: `list-${tab.id}`,
            label: tab.icon ? `${tab.icon} ${tab.name}` : tab.name,
            count: tasks.filter((t) => t.completed && t.listId === tab.id).length,
            color: tab.color,
          })),
          {
            key: "list-none",
            label: "No list",
            count: tasks.filter((t) => t.completed && t.listId == null).length,
            color: null,
          },
        ].sort((a, b) => b.count - a.count);

  const tagBreakdown: BreakdownEntry[] =
    tags.length === 0
      ? []
      : [
          ...tags.map((tag) => ({
            key: `tag-${tag.id}`,
            label: tag.name,
            count: tasks.filter(
              (t) => t.completed && (t.tags.some((x) => x.id === tag.id) || t.inheritedTags.some((x) => x.id === tag.id))
            ).length,
            color: tag.color,
          })),
          {
            key: "tag-none",
            label: "Untagged",
            count: tasks.filter((t) => t.completed && t.tags.length === 0 && t.inheritedTags.length === 0).length,
            color: null,
          },
        ].sort((a, b) => b.count - a.count);

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
          marginBottom: listBreakdown.length > 0 || tagBreakdown.length > 0 ? 20 : 0,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Last 12 weeks</div>
        <BarChart entries={weeklyEntries} barTitle={(week, count) => `${count} completed the week of ${formatDateDisplay(week)}`} />
      </div>

      {listBreakdown.length > 0 && (
        <div
          style={{
            padding: 16,
            marginBottom: tagBreakdown.length > 0 ? 20 : 0,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Completed by list (all-time)</div>
          <BreakdownBars entries={listBreakdown} />
        </div>
      )}

      {tagBreakdown.length > 0 && (
        <div
          style={{
            padding: 16,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Completed by tag (all-time)</div>
          <BreakdownBars entries={tagBreakdown} />
        </div>
      )}
    </div>
  );
}
