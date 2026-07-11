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

export interface Task {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  parentId: number | null;
  completed: boolean;
  createdAt: string;
  recurrence: Recurrence | null;
  tags: Tag[];
  inheritedTags: Tag[];
  priority: Priority | null;
  attachments: Attachment[];
}
