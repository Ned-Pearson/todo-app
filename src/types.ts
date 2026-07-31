export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type Priority = "low" | "medium" | "high";

export interface Recurrence {
  id: number;
  frequency: RecurrenceFrequency;
  interval: number;
  endDate: string | null;
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
}
