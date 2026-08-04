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
  tagId: number;
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
}
