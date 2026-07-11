import type { Task } from "../types";

// Builds the parent/child tree over whichever set of tasks is currently
// visible (a view/tag/priority filter, a day's worth of history, etc.), so
// every filtered list nests subtasks the same way the All view does. A task
// whose parent isn't in the given set (e.g. filtered out) is promoted to a
// root within that set.
export function buildTaskTree(list: Task[]): { topLevel: Task[]; childrenByParent: Map<number, Task[]> } {
  const ids = new Set(list.map((t) => t.id));
  const childrenByParent = new Map<number, Task[]>();
  for (const t of list) {
    if (t.parentId != null && ids.has(t.parentId)) {
      const siblings = childrenByParent.get(t.parentId) ?? [];
      siblings.push(t);
      childrenByParent.set(t.parentId, siblings);
    }
  }
  const topLevel = list.filter((t) => t.parentId == null || !ids.has(t.parentId));
  return { topLevel, childrenByParent };
}
