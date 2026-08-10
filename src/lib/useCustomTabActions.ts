import type { CustomTab, Task } from "../types";
import type { View } from "./appConstants";
import { withDescendants } from "./tree";
import { listToMarkdown } from "./taskMarkdown";
import { exportTaskAsMarkdown } from "./backup";
import {
  createCustomTab,
  deleteCustomTab,
  updateCustomTabColor,
  updateCustomTabDescription,
  updateCustomTabDefaultTag,
  updateCustomTabIcon,
  updateCustomTabSortOrder,
  applyTagToAllTasksInList,
  updateTaskList,
} from "./db";

interface UseCustomTabActionsOptions {
  customTabs: CustomTab[];
  activeListId: number | null;
  tasks: Task[];
  archivedTasks: Task[];
  trashedTasks: Task[];
  reload: () => Promise<void>;
  setShowAddTabModal: (show: boolean) => void;
  setView: (view: View) => void;
  setActiveListId: (id: number | null) => void;
  setActiveTagFilter: (id: number | null) => void;
  setPriorityFilter: (priority: null) => void;
}

// Custom tabs are this app's user-defined "Lists" — every handler here
// mutates the `custom_tabs` table (or, for handleChangeTaskList/
// handleApplyTagToAllTasksInList, a task's membership in one) rather than a
// task's own core fields, which is what keeps this a separate hook from
// useTaskActions instead of folded into it.
export function useCustomTabActions(options: UseCustomTabActionsOptions) {
  const { customTabs, activeListId, tasks, archivedTasks, trashedTasks, reload } = options;
  const { setShowAddTabModal, setView, setActiveListId, setActiveTagFilter, setPriorityFilter } = options;

  async function handleCreateCustomTab(tabName: string) {
    const newId = await createCustomTab(tabName);
    setShowAddTabModal(false);
    await reload();
    setView("all");
    setActiveListId(newId);
    // Entering a list is a fresh, dedicated destination — an invisible
    // leftover tag/priority filter would silently hide tasks in it with no
    // visible cue why, since list mode hides the filter chips/banner that'd
    // normally explain that.
    setActiveTagFilter(null);
    setPriorityFilter(null);
  }

  function handleSelectCustomTab(tab: CustomTab) {
    setView("all");
    setActiveListId(tab.id);
    setActiveTagFilter(null);
    setPriorityFilter(null);
  }

  async function handleDeleteCustomTab(id: number) {
    await deleteCustomTab(id);
    if (activeListId === id) setActiveListId(null);
    await reload();
  }

  async function handleUpdateCustomTabColor(id: number, color: string | null) {
    await updateCustomTabColor(id, color);
    await reload();
  }

  async function handleUpdateCustomTabDescription(id: number, description: string | null) {
    await updateCustomTabDescription(id, description);
    await reload();
  }

  async function handleUpdateCustomTabDefaultTag(id: number, tagId: number | null) {
    await updateCustomTabDefaultTag(id, tagId);
    await reload();
  }

  async function handleUpdateCustomTabIcon(id: number, icon: string | null) {
    await updateCustomTabIcon(id, icon);
    await reload();
  }

  async function handleApplyTagToAllTasksInList(listId: number, tagId: number) {
    await applyTagToAllTasksInList(listId, tagId);
    await reload();
  }

  async function handleChangeTaskList(taskId: number, listId: number | null) {
    await updateTaskList(taskId, listId);
    await reload();
  }

  // Same before/after splice-insertion shape as task reordering (see
  // useTaskActions' handleReorder), just without the reparent branch — lists
  // are always a single flat group, no hierarchy to worry about.
  async function handleReorderCustomTab(draggedId: number, targetId: number, position: "before" | "after") {
    if (draggedId === targetId) return;
    const dragged = customTabs.find((t) => t.id === draggedId);
    if (!dragged) return;
    const reordered = customTabs.filter((t) => t.id !== draggedId);
    const targetIndex = reordered.findIndex((t) => t.id === targetId);
    if (targetIndex === -1) return;
    reordered.splice(position === "after" ? targetIndex + 1 : targetIndex, 0, dragged);
    await Promise.all(reordered.map((t, i) => updateCustomTabSortOrder(t.id, i)));
    await reload();
  }

  // Every task belonging to this list, across active/archived/trashed alike
  // (unlike the app's usual "current list" filtering, which is scoped to
  // whichever one's active and uses the app's own shared withDescendants()
  // call elsewhere), since an export triggered from a list's popover should
  // cover that list's tasks regardless of where each one currently lives.
  async function handleExportListMarkdown(listId: number) {
    const list = customTabs.find((t) => t.id === listId);
    if (!list) return;
    const everyTask = [...tasks, ...archivedTasks, ...trashedTasks];
    const listTasks = withDescendants(everyTask, (t) => t.listId === listId);
    const markdown = listToMarkdown(list.name, list.description, listTasks);
    try {
      const exported = await exportTaskAsMarkdown(list.name, markdown);
      if (exported) window.alert("List exported.");
    } catch (err) {
      console.error("Failed to export list as Markdown:", err);
      window.alert(`Couldn't export list: ${err}`);
    }
  }

  return {
    handleCreateCustomTab,
    handleSelectCustomTab,
    handleDeleteCustomTab,
    handleUpdateCustomTabColor,
    handleUpdateCustomTabDescription,
    handleUpdateCustomTabDefaultTag,
    handleUpdateCustomTabIcon,
    handleApplyTagToAllTasksInList,
    handleChangeTaskList,
    handleReorderCustomTab,
    handleExportListMarkdown,
  };
}
