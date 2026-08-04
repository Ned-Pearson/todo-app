export type View =
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
