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

// Expands whichever tasks in `pool` satisfy `matches` to also include every
// one of their descendants (regardless of a descendant's own attributes),
// so a match never leaves part of its own subtree behind — e.g. filtering
// to one list/tag/priority shouldn't strand a matching task's subtasks
// outside the result. Shared by the list/priority filters and the
// whole-list Markdown export in App.tsx, which all apply this exact same
// "keep matches plus their full subtree" rule over different pools.
export function withDescendants(pool: Task[], matches: (t: Task) => boolean): Task[] {
  const visibleIds = new Set(pool.filter(matches).map((t) => t.id));
  function addDescendants(id: number) {
    for (const t of pool) {
      if (t.parentId === id && !visibleIds.has(t.id)) {
        visibleIds.add(t.id);
        addDescendants(t.id);
      }
    }
  }
  for (const id of [...visibleIds]) addDescendants(id);
  return pool.filter((t) => visibleIds.has(t.id));
}
