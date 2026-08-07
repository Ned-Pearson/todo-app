export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type Priority = "low" | "medium" | "high";

export interface Recurrence {
  id: number;
  frequency: RecurrenceFrequency;
  interval: number;
  endDate: string | null;
  // How many occurrences remain, *including* the current pending one — e.g.
  // 1 means this is the last instance the series will ever produce. Null
  // means no occurrence limit (only endDate, if set, bounds the series).
  occurrencesLeft: number | null;
  // Only meaningful for frequency "weekly": which days of the week (0=Sun..
  // 6=Sat, matching JS Date#getDay) this repeats on, e.g. [1, 3, 5] for Mon/
  // Wed/Fri. Null means the plain interval-based behavior (every N weeks on
  // the same weekday as the anchor due date) — the two modes are mutually
  // exclusive, not combined.
  weekdays: number[] | null;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface Attachment {
  id: number;
  path: string;
}

export interface SavedView {
  id: number;
  name: string;
  tagId: number | null;
  priority: Priority | null;
  searchQuery: string | null;
}

export interface CustomTab {
  id: number;
  name: string;
  // Legacy — lists used to just be a shortcut for "filter All by this tag."
  // No longer read for membership (that's tasks.listId now) and no longer
  // required when creating a list; kept nullable rather than dropped so a
  // pre-existing tab's old binding isn't silently destroyed.
  tagId: number | null;
  // Overrides --color-accent/--color-accent-soft while this tab is active,
  // taking precedence over the app-wide custom accent — gives each project
  // tab its own visual identity instead of sharing one global accent.
  color: string | null;
  // General free-text info about the list itself (what it's for, conventions
  // to follow, etc.) — independent of any task in it.
  description: string | null;
  // Applied automatically to a new task added while this list is open, and
  // available to bulk-apply to every task already in it — distinct from the
  // legacy `tagId` above, which never meant this and is never read anymore.
  defaultTagId: number | null;
  // A single emoji shown next to the list's name, alongside its color dot.
  // Purely cosmetic — nothing else reads it.
  icon: string | null;
}

// The stored blueprint for a task template — a static tree (title/priority/
// tags + nested subtasks), independent of any real task row. Kept as one
// JSON blob rather than a parallel relational tree, since unlike real tasks
// it never needs to be filtered, sorted, or joined against — only read and
// instantiated whole.
export interface TemplateNode {
  title: string;
  priority: Priority | null;
  tagIds: number[];
  subtasks: TemplateNode[];
}

export interface TaskTemplate {
  id: number;
  name: string;
  data: TemplateNode;
}

// A lightweight stand-in for a prerequisite task — just enough to show what
// a task is waiting on and whether it's cleared, not a full Task.
export interface TaskDependency {
  id: number;
  title: string;
  completed: boolean;
}

// A "See also" cross-reference — structurally identical to TaskDependency
// (just enough to show and link to the other task) but semantically
// unrelated: unlike a dependency, linking to one never gates completion.
// The relationship is symmetric (linking A to B always means B is also
// linked to A), unlike dependencies which are one-directional.
export interface RelatedTask {
  id: number;
  title: string;
  completed: boolean;
}

// Just enough of a task's list to render a badge/title without needing the
// full CustomTab array on hand at every call site.
export interface TaskListRef {
  id: number;
  name: string;
  color: string | null;
  icon: string | null;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  dueTime: string | null;
  parentId: number | null;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  recurrence: Recurrence | null;
  tags: Tag[];
  inheritedTags: Tag[];
  priority: Priority | null;
  attachments: Attachment[];
  pinned: boolean;
  dependsOn: TaskDependency[];
  relatedTasks: RelatedTask[];
  // Which list this task belongs to, if any — independent of tags entirely
  // (a task can be in a list without carrying any tag at all). `list` is the
  // denormalized name/color for display; `listId` alone is what's read/
  // written for membership.
  listId: number | null;
  list: TaskListRef | null;
  archived: boolean;
  // A standalone time-based nudge, independent of dueDate/dueTime — doesn't
  // imply the task is "due", just that a notification should fire at this
  // moment. Same "<date> <time>" format as completedAt.
  reminderAt: string | null;
  reminderNotified: boolean;
  // A per-task row tint, independent of tags/priority — purely a personal
  // visual marker, not tied to any filtering/grouping logic.
  highlightColor: string | null;
  // Tri-state status beyond plain complete/incomplete: completed is still
  // the one source of truth for "done" (drives dependencies, recurrence,
  // notifications, History/Archive, etc., all unchanged) — this only
  // distinguishes "not started" from "in progress" for an incomplete task,
  // toggled independently of completing it.
  inProgress: boolean;
  // "Someday" — hides the task from All/Today/This Week without archiving
  // or deleting it. Independent of completed/archived; Calendar (if it has
  // a due date) and History (if it's completed) still show it.
  backlog: boolean;
  // Set the moment a task is soft-deleted (moved to Trash); null otherwise.
  // Purged for good — hard DELETE — once it's older than the retention
  // window, independent of the separate 5-second delete-Undo toast.
  deletedAt: string | null;
  // Accumulated time from every past start/stop cycle, not counting
  // whatever's elapsed on the *current* run if one is active.
  timeSpentSeconds: number;
  // A precise ISO timestamp (not the app's usual minute-precision "date
  // time" strings) for whenever the timer is currently running; null
  // otherwise. Elapsed time is always computed against real wall-clock time
  // (Date.now() vs. this timestamp), not app uptime, so it stays correct
  // across the app being closed and reopened mid-timer.
  timerStartedAt: string | null;
}
