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
