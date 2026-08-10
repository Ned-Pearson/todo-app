import type { Priority, SavedView } from "../types";
import { createSavedView, deleteSavedView } from "./db";

interface UseSavedViewsOptions {
  activeTagFilter: number | null;
  priorityFilter: Priority | null;
  searchQuery: string;
  reload: () => Promise<void>;
  setActiveTagFilter: (id: number | null) => void;
  setPriorityFilter: (priority: Priority | null) => void;
  setSearchQuery: (query: string) => void;
}

// A saved view is just a shortcut for the tag/priority/search combo — it
// doesn't touch which view (All/Today/Calendar/etc.) is currently open, so
// "show me high-priority Work tasks" applies whether you're checking Today
// or All rather than also forcing a page jump.
export function useSavedViews(options: UseSavedViewsOptions) {
  const { activeTagFilter, priorityFilter, searchQuery, reload } = options;
  const { setActiveTagFilter, setPriorityFilter, setSearchQuery } = options;

  function isSavedViewActive(view: SavedView): boolean {
    return (
      activeTagFilter === view.tagId && priorityFilter === view.priority && searchQuery === (view.searchQuery ?? "")
    );
  }

  function handleApplySavedView(view: SavedView) {
    if (isSavedViewActive(view)) {
      setActiveTagFilter(null);
      setPriorityFilter(null);
      setSearchQuery("");
    } else {
      setActiveTagFilter(view.tagId);
      setPriorityFilter(view.priority);
      setSearchQuery(view.searchQuery ?? "");
    }
  }

  async function handleSaveCurrentView() {
    const name = window.prompt("Name this view:");
    if (!name || !name.trim()) return;
    await createSavedView(name.trim(), activeTagFilter, priorityFilter, searchQuery);
    await reload();
  }

  async function handleDeleteSavedView(id: number) {
    await deleteSavedView(id);
    await reload();
  }

  return { isSavedViewActive, handleApplySavedView, handleSaveCurrentView, handleDeleteSavedView };
}
