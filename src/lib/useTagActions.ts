import type { Task } from "../types";
import { createTag, addTagToTask, updateTagName, updateTagColor, deleteTag } from "./db";

interface UseTagActionsOptions {
  selectedTask: Task | null;
  activeTagFilter: number | null;
  reload: () => Promise<void>;
  setActiveTagFilter: (id: number | null) => void;
}

// Tag CRUD (create/rename/recolor/delete) — distinct from a task's own
// tag *assignments* (add/remove/toggle a tag on one task), which stayed in
// useTaskActions since those mutate a task, not the tag itself.
export function useTagActions(options: UseTagActionsOptions) {
  const { selectedTask, activeTagFilter, reload, setActiveTagFilter } = options;

  // Only ever invoked from the task detail modal's "create a new tag" flow
  // — creating one with no task open wouldn't have anywhere to assign it,
  // so this both creates the tag and immediately attaches it to whichever
  // task is currently selected in one step.
  async function handleCreateTag(name: string, color: string) {
    if (!selectedTask) return;
    const tagId = await createTag(name, color);
    await addTagToTask(selectedTask.id, tagId);
    await reload();
  }

  async function handleRenameTag(id: number, name: string) {
    await updateTagName(id, name);
    await reload();
  }

  async function handleRecolorTag(id: number, color: string) {
    await updateTagColor(id, color);
    await reload();
  }

  async function handleDeleteTag(id: number) {
    await deleteTag(id);
    if (activeTagFilter === id) setActiveTagFilter(null);
    await reload();
  }

  return { handleCreateTag, handleRenameTag, handleRecolorTag, handleDeleteTag };
}
