import type { Task } from "../types";
import { PRIORITY_LABELS } from "./priority";

// Renders one task (and its whole subtask subtree) as a standalone Markdown
// document for sharing outside the app — a readable snapshot, not a data
// dump like the JSON backup export. Only fields that still make sense once
// they've left the app are included (title, due date, priority, tags,
// description, and the subtask tree as a nested checklist); internal
// bookkeeping (pinned, in-progress, backlog, archived, reminders,
// dependencies, attachments' local file paths, highlight color) is
// deliberately left out.
export function taskToMarkdown(task: Task, childrenByParent: Map<number, Task[]>): string {
  const lines: string[] = [`# ${task.title}`, ""];

  const meta: string[] = [];
  if (task.dueDate) meta.push(`**Due:** ${task.dueDate}${task.dueTime ? ` ${task.dueTime}` : ""}`);
  if (task.priority) meta.push(`**Priority:** ${PRIORITY_LABELS[task.priority]}`);
  const allTags = [...task.tags, ...task.inheritedTags];
  if (allTags.length > 0) meta.push(`**Tags:** ${allTags.map((t) => t.name).join(", ")}`);
  if (meta.length > 0) {
    lines.push(...meta.map((m) => `- ${m}`), "");
  }

  if (task.description) {
    lines.push(task.description, "");
  }

  function renderSubtree(id: number, depth: number): string[] {
    const children = childrenByParent.get(id) ?? [];
    const out: string[] = [];
    for (const child of children) {
      const indent = "  ".repeat(depth);
      out.push(`${indent}- [${child.completed ? "x" : " "}] ${child.title}`);
      out.push(...renderSubtree(child.id, depth + 1));
    }
    return out;
  }

  const subtaskLines = renderSubtree(task.id, 0);
  if (subtaskLines.length > 0) {
    lines.push("## Subtasks", "", ...subtaskLines, "");
  }

  return lines.join("\n").trimEnd() + "\n";
}

// The whole-list counterpart to taskToMarkdown above — every task that
// belongs to the list, as one combined checklist rather than a document per
// task. `tasks` is expected to already be resolved to exactly the list's
// visible set (see handleExportListMarkdown in App.tsx): every task whose
// own listId matches, plus their descendants regardless of a descendant's
// own listId — the same "list membership" rule the app uses when the list
// is actually open, so the export matches what browsing the list shows.
// A task renders as a top-level checklist item unless its parent is also
// in `tasks`, in which case it nests under that parent instead — so it's
// never listed twice. Per-task metadata (due/priority/tags) rides along
// inline in parens rather than as its own bullet list like the single-task
// export does, to keep a multi-task document scannable as a checklist;
// per-task descriptions are left out for the same reason.
export function listToMarkdown(listName: string, description: string | null, tasks: Task[]): string {
  const lines: string[] = [`# ${listName}`, ""];
  if (description) lines.push(description, "");

  const ids = new Set(tasks.map((t) => t.id));
  const childrenByParent = new Map<number, Task[]>();
  for (const t of tasks) {
    if (t.parentId == null || !ids.has(t.parentId)) continue;
    const arr = childrenByParent.get(t.parentId) ?? [];
    arr.push(t);
    childrenByParent.set(t.parentId, arr);
  }
  const roots = tasks.filter((t) => t.parentId == null || !ids.has(t.parentId));

  function renderTask(task: Task, depth: number): string[] {
    const indent = "  ".repeat(depth);
    const meta: string[] = [];
    if (task.dueDate) meta.push(`Due: ${task.dueDate}${task.dueTime ? ` ${task.dueTime}` : ""}`);
    if (task.priority) meta.push(`${PRIORITY_LABELS[task.priority]} priority`);
    const allTags = [...task.tags, ...task.inheritedTags];
    if (allTags.length > 0) meta.push(`tags: ${allTags.map((t) => t.name).join(", ")}`);
    const suffix = meta.length > 0 ? ` (${meta.join(" · ")})` : "";
    const out = [`${indent}- [${task.completed ? "x" : " "}] ${task.title}${suffix}`];
    for (const child of childrenByParent.get(task.id) ?? []) {
      out.push(...renderTask(child, depth + 1));
    }
    return out;
  }

  if (roots.length === 0) {
    lines.push("_No tasks in this list yet._", "");
  } else {
    lines.push(...roots.flatMap((t) => renderTask(t, 0)), "");
  }

  return lines.join("\n").trimEnd() + "\n";
}
