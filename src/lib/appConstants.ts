export type View =
  | "my-day"
  | "all"
  | "today"
  | "this-week"
  | "no-date"
  | "calendar"
  | "history"
  | "stats"
  | "archive"
  | "backlog"
  | "trash";

export const VIEW_LABELS: Record<View, string> = {
  "my-day": "My Day",
  all: "All",
  today: "Today",
  "this-week": "This Week",
  "no-date": "No due date",
  calendar: "Calendar",
  history: "History",
  stats: "Stats",
  archive: "Archive",
  backlog: "Backlog",
  trash: "Trash",
};

export type Theme = "light" | "dark";

// The light/dark stylesheet defaults from index.css — used as the color
// picker's starting value while no custom accent is set, so it opens on
// something sensible instead of an arbitrary color.
export const DEFAULT_ACCENT: Record<Theme, string> = { light: "#3d4f3a", dark: "#7fa374" };

export const SNOOZE_OPTIONS_MINUTES = [15, 30, 60, 120, 240];

export const SNOOZE_LABELS: Record<number, string> = {
  15: "15 minutes",
  30: "30 minutes",
  60: "1 hour",
  120: "2 hours",
  240: "4 hours",
};

export const TRASH_RETENTION_DEFAULT_DAYS = 30;
export const TRASH_RETENTION_OPTIONS_DAYS = [7, 14, 30, 60, 90];

export const TRASH_RETENTION_LABELS: Record<number, string> = {
  7: "7 days",
  14: "14 days",
  30: "30 days",
  60: "60 days",
  90: "90 days",
};

// The Config dropdown (see Sidebar.tsx) is a fixed 240px wide, inset 20px
// from the sidebar's left edge (12px root padding + 8px wrapper padding) —
// so it needs at least 260px of sidebar to avoid touching the right edge at
// all, and 280px to have the same 20px of breathing room on both sides.
export const SIDEBAR_WIDTH_DEFAULT = 280;
export const SIDEBAR_WIDTH_MIN = 200;
export const SIDEBAR_WIDTH_MAX = 500;

export const PANEL_WIDTH_DEFAULT = 380;
export const PANEL_WIDTH_MIN = 300;
export const PANEL_WIDTH_MAX = 700;
