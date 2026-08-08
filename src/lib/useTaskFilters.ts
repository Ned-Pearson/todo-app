import type { Priority, Task } from "../types";
import { withDescendants } from "./tree";

export interface TaskFilterCriteria {
  activeListId: number | null;
  activeTagFilter: number | null;
  priorityFilter: Priority | null;
  searchQuery: string;
}

// Not a React hook in the strict sense — it calls no hooks itself, just
// computes a derived filtered list fresh on every call, the same way the
// function this was extracted from did inline in App.tsx. Kept the `use`
// prefix anyway since it's meant to be called from a component's render
// body the same way a hook would be. Shared by the main (non-archived),
// archived, and trashed task lists (each calls this separately), so the
// tag/priority/search/list filters reach all three instead of any one of
// them silently showing everything regardless of whatever filter is
// currently active.
export function useTaskFilters(tasks: Task[], criteria: TaskFilterCriteria): Task[] {
  const { activeListId, activeTagFilter, priorityFilter, searchQuery } = criteria;

  // Viewing a list keeps only tasks assigned to it, plus every one of their
  // descendants (regardless of the descendant's own list) so a matching
  // task's subtree stays intact — same reasoning as the priority filter
  // below. A subtask's listId is only ever copied from its parent at
  // creation time (not live-inherited like tags), so without this a subtask
  // added before this feature, or dragged in from elsewhere, would
  // otherwise silently vanish from its own parent's list.
  const listFiltered = activeListId == null ? tasks : withDescendants(tasks, (t) => t.listId === activeListId);

  const tagFiltered =
    activeTagFilter == null
      ? listFiltered
      : listFiltered.filter(
          (t) =>
            t.tags.some((tag) => tag.id === activeTagFilter) || t.inheritedTags.some((tag) => tag.id === activeTagFilter)
        );

  // Selecting a priority keeps only tasks flagged with it, plus every one of
  // their descendants (regardless of the descendant's own priority) so a
  // matching task's subtree stays intact. Tasks with no priority set (and
  // no matching ancestor) are dropped entirely rather than just reordered.
  const priorityFiltered = !priorityFilter
    ? tagFiltered
    : withDescendants(tagFiltered, (t) => t.priority === priorityFilter);

  const q = searchQuery.trim().toLowerCase();
  if (!q) return priorityFiltered;
  return priorityFiltered.filter(
    (t) => t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q)
  );
}
