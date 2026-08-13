import type { Task } from "../types";

// A fully-populated default Task, overridable per field — shared by the
// lib/ test files that need fake tasks (tree, taskMarkdown, stats) so each
// one isn't repeating the same long default object. Not itself a test file
// (no `.test.ts` suffix), so Vitest never tries to run it directly.
export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 0,
    title: "Untitled",
    description: null,
    dueDate: null,
    dueTime: null,
    parentId: null,
    completed: false,
    completedAt: null,
    createdAt: "2026-01-01 00:00",
    recurrence: null,
    tags: [],
    inheritedTags: [],
    priority: null,
    attachments: [],
    pinned: false,
    dependsOn: [],
    relatedTasks: [],
    listId: null,
    list: null,
    archived: false,
    reminderAt: null,
    reminderNotified: false,
    reminderRepeat: null,
    highlightColor: null,
    inProgress: false,
    backlog: false,
    deletedAt: null,
    timeSpentSeconds: 0,
    timerStartedAt: null,
    estimatedMinutes: null,
    collapsed: false,
    ...overrides,
  };
}
