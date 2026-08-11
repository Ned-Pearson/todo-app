import type { Task } from "../types";
import { buildTaskTree } from "./tree";
import { taskToMarkdown } from "./taskMarkdown";
import { exportToFile, importFromFile, exportTaskAsMarkdown } from "./backup";

interface UseBackupOptions {
  tasks: Task[];
  archivedTasks: Task[];
  trashedTasks: Task[];
  reload: () => Promise<void>;
  setSelectedTask: (task: Task | null) => void;
  setActiveListId: (id: number | null) => void;
}

// Whole-app backup (export/import the entire database as one file) and
// per-task Markdown export — grouped together as "backup" since both are
// about getting data *out of* (or, for import, wholesale replacing) the
// app rather than mutating any one task or list. The whole-list Markdown
// export lives in useCustomTabActions instead, alongside the rest of the
// list-management handlers it's more closely related to.
export function useBackup(options: UseBackupOptions) {
  const { tasks, archivedTasks, trashedTasks, reload, setSelectedTask, setActiveListId } = options;

  async function handleExport() {
    try {
      const exported = await exportToFile();
      if (exported) window.alert("Backup saved.");
    } catch (err) {
      console.error("Failed to export backup:", err);
      window.alert(`Couldn't export backup: ${err}`);
    }
  }

  // A task can be exported from any view — including Archive/Backlog/Trash,
  // wherever "Export .md" is passed — so the subtree lookup spans all three
  // task lists rather than just the everyday `tasks` array, otherwise an
  // archived or backlogged task's own children (which live in a different
  // list) would be missing from the export.
  async function handleExportTaskMarkdown(id: number) {
    const everyTask = [...tasks, ...archivedTasks, ...trashedTasks];
    const task = everyTask.find((t) => t.id === id);
    if (!task) return;
    const { childrenByParent } = buildTaskTree(everyTask);
    const markdown = taskToMarkdown(task, childrenByParent);
    try {
      const exported = await exportTaskAsMarkdown(task.title, markdown);
      if (exported) window.alert("Task exported.");
    } catch (err) {
      console.error("Failed to export task as Markdown:", err);
      window.alert(`Couldn't export task: ${err}`);
    }
  }

  async function handleImport() {
    if (
      !window.confirm(
        "Importing a backup replaces everything currently in this app — all tasks, tags, and recurrence rules will be deleted first. This can't be undone. Continue?"
      )
    ) {
      return;
    }
    try {
      const imported = await importFromFile();
      if (imported) {
        setSelectedTask(null);
        setActiveListId(null);
        await reload();
        window.alert("Backup restored.");
      }
    } catch (err) {
      console.error("Failed to import backup:", err);
      window.alert(`Couldn't import backup: ${err}`);
    }
  }

  return { handleExport, handleExportTaskMarkdown, handleImport };
}
