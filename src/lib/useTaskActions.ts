import { useEffect, useRef, useState } from "react";
import type { CustomTab, Priority, Task } from "../types";
import type { View } from "./appConstants";
import { addInterval, isOverdue, nowTimestamp, todayStr } from "./date";
import { nextRecurrenceDate, type RecurrenceInput } from "./recurrence";
import {
  createTask,
  addTagToTask,
  removeTagFromTask,
  createRecurrenceRule,
  updateRecurrenceRule,
  decrementRecurrenceOccurrences,
  setTaskRecurrenceId,
  clearTaskRecurrence,
  setTaskCompleted,
  deleteTask,
  moveTaskToTrash,
  restoreTaskFromTrash,
  emptyTrash,
  startTaskTimer,
  stopTaskTimer,
  resetTaskTimer,
  updateTaskTitle,
  updateTaskDescription,
  updateTaskDueDate,
  updateTaskPriority,
  updateTaskPinned,
  addAttachmentToTask,
  removeAttachment,
  updateTaskSortOrder,
  duplicateTask,
  saveTaskAsTemplate,
  createTaskFromTemplate,
  deleteTaskTemplate,
  addTaskDependency,
  removeTaskDependency,
  addRelatedTask,
  removeRelatedTask,
  updateTaskArchived,
  updateTaskReminder,
  updateTaskHighlightColor,
  updateTaskEstimate,
  updateTaskInProgress,
  updateTaskParent,
  updateTaskBacklog,
  updateTaskList,
  updateTaskCollapsed,
} from "./db";
import type { RecurrenceFrequency } from "../types";

interface UseTaskActionsOptions {
  tasks: Task[];
  archivedTasks: Task[];
  trashedTasks: Task[];
  customTabs: CustomTab[];
  activeListId: number | null;
  view: View;
  dueDate: string;
  reload: () => Promise<void>;
  setDueDate: (date: string) => void;
  setShowAddModal: (show: boolean) => void;
  setShowTemplatesPicker: (show: boolean) => void;
  setSelectedTask: (task: Task | null) => void;
}

// Every handler here that mutates a task ends the same way — call the
// db.ts write, then `reload()` — rather than optimistically patching local
// state, since `reload` already re-fetches everything in one batch and
// nothing in this app is high-frequency enough (task counts are small,
// desktop-local SQLite) for that extra round trip to be felt.
export function useTaskActions(options: UseTaskActionsOptions) {
  const { tasks, archivedTasks, trashedTasks, customTabs, activeListId, view, dueDate, reload } = options;
  const { setDueDate, setShowAddModal, setShowTemplatesPicker, setSelectedTask } = options;

  const activeList = activeListId != null ? (customTabs.find((t) => t.id === activeListId) ?? null) : null;

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkTagPicker, setShowBulkTagPicker] = useState(false);
  const [showBulkListPicker, setShowBulkListPicker] = useState(false);
  const [showBulkPostponePicker, setShowBulkPostponePicker] = useState(false);
  const [bulkPostponeDays, setBulkPostponeDays] = useState("1");
  // Bumping the version (rather than just toggling `collapsed`) is what
  // makes two consecutive clicks of the *same* Expand/Collapse-all button
  // both take effect — see the matching effect in TaskRow.tsx, which every
  // already-mounted row watches for the immediate visual update, on top of
  // the DB writes handleExpandAll/handleCollapseAll below also make.
  const [collapseSignal, setCollapseSignal] = useState<{ collapsed: boolean; version: number } | null>(null);

  // Deleting doesn't hit the database right away: the task(s) (and their
  // subtasks) are just hidden from the UI for a few seconds while a toast
  // offers "Undo". Only once that window elapses without being cancelled
  // does the task actually move to Trash (moveTaskToTrash cascades to
  // descendants itself) — a real DELETE only ever happens from within Trash
  // ("Delete forever") or once something's been there past the retention
  // window. `rootIds` are the tasks the user actually deleted; `allIds` is
  // the full set hidden from the UI in the meantime.
  const [pendingDelete, setPendingDelete] = useState<{ rootIds: number[]; allIds: number[]; label: string } | null>(
    null
  );
  const pendingDeleteTimeout = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pendingDeleteTimeout.current != null) window.clearTimeout(pendingDeleteTimeout.current);
    };
  }, []);

  async function handleAddTask(
    title: string,
    description: string,
    taskDueDate: string,
    dueTime: string,
    priority: Priority | null,
    recurrence: RecurrenceInput | null
  ) {
    try {
      const recurrenceId = recurrence
        ? await createRecurrenceRule(
            recurrence.frequency,
            recurrence.interval,
            recurrence.endDate,
            recurrence.occurrences,
            recurrence.weekdays
          )
        : undefined;
      // Adding a task while a list is open should land it directly in that
      // list, not just in the untagged everyday view.
      const newTaskId = await createTask(
        title,
        taskDueDate,
        undefined,
        recurrenceId,
        priority ?? undefined,
        taskDueDate ? dueTime : undefined,
        activeListId ?? undefined,
        description
      );
      // A list's default tag (distinct from list membership itself) applies
      // the same way — only to new tasks added while that list is open, not
      // retroactively; that's what the explicit "apply to all" action is for.
      if (activeList?.defaultTagId != null) {
        await addTagToTask(newTaskId, activeList.defaultTagId);
      }
      // Today keeps defaulting to today's date, Calendar keeps whatever day is
      // selected — only clear the field when neither has a sensible default
      // to fall back to.
      if (view === "today" || view === "my-day") {
        setDueDate(todayStr());
      } else if (view !== "calendar") {
        setDueDate("");
      }
      setShowAddModal(false);
      await reload();
    } catch (err) {
      console.error("Failed to add task:", err);
      window.alert(`Couldn't add task: ${err}`);
    }
  }

  function getDescendantIds(id: number): number[] {
    const children = tasks.filter((t) => t.parentId === id).map((t) => t.id);
    return children.flatMap((childId) => [childId, ...getDescendantIds(childId)]);
  }

  // Shared by single-task and bulk completion: marks a task and its
  // descendants complete/incomplete, and — only when completing — spawns the
  // next instance of any recurring task in that set. Doesn't reload on its
  // own so bulk completion can do a single reload after the whole batch.
  async function applyCompletion(id: number, completed: boolean) {
    if (completed) {
      // Blocked tasks can't be completed — the checkbox is already disabled
      // for this in TaskRow, but bulk-complete bypasses that UI entirely, so
      // this is the one choke point both paths go through where it's worth
      // guarding again rather than trusting the UI alone.
      const task = tasks.find((t) => t.id === id);
      if (task?.dependsOn.some((d) => !d.completed)) return;
    }
    const idsToUpdate = completed ? [id, ...getDescendantIds(id)] : [id];
    const completedAt = completed ? nowTimestamp() : null;
    for (const taskId of idsToUpdate) {
      // A timer left running after its task is done would just keep
      // accumulating meaningless time in the background — fold it into the
      // total the same way explicitly clicking "Stop" would.
      if (completed) {
        const task = tasks.find((t) => t.id === taskId);
        if (task?.timerStartedAt) await stopTaskTimer(taskId);
      }
      await setTaskCompleted(taskId, completed, completedAt);
    }

    if (completed) {
      for (const taskId of idsToUpdate) {
        const task = tasks.find((t) => t.id === taskId);
        if (!task?.recurrence) continue;
        const baseDate = task.dueDate ?? todayStr();
        const nextDue = nextRecurrenceDate(baseDate, task.recurrence);
        const withinEnd = !task.recurrence.endDate || nextDue <= task.recurrence.endDate;
        const withinCount = task.recurrence.occurrencesLeft == null || task.recurrence.occurrencesLeft > 1;
        if (withinEnd && withinCount) {
          await createTask(
            task.title,
            nextDue,
            task.parentId ?? undefined,
            task.recurrence.id,
            undefined,
            undefined,
            task.listId ?? undefined
          );
          await decrementRecurrenceOccurrences(task.recurrence.id);
          await clearTaskRecurrence(task.id);
        }
      }
    }
  }

  async function handleToggle(id: number, completed: boolean) {
    await applyCompletion(id, completed);
    await reload();
  }

  function schedulePendingDelete(pending: { rootIds: number[]; allIds: number[]; label: string }) {
    setPendingDelete(pending);
    pendingDeleteTimeout.current = window.setTimeout(() => {
      // Passed explicitly rather than read back off `pendingDelete` state:
      // this closure was created (and captured whatever `pendingDelete` was)
      // at the moment `schedulePendingDelete` ran, which is *before* the
      // `setPendingDelete(pending)` above ever commits to a render — reading
      // the state here would always see the pre-delete value (null), so
      // `rootIds` would be empty and nothing would actually get trashed.
      commitPendingDelete(pending);
    }, 5000);
  }

  async function commitPendingDelete(pending?: { rootIds: number[]; allIds: number[]; label: string }) {
    if (pendingDeleteTimeout.current != null) {
      window.clearTimeout(pendingDeleteTimeout.current);
      pendingDeleteTimeout.current = null;
    }
    const rootIds = (pending ?? pendingDelete)?.rootIds ?? [];
    setPendingDelete(null);
    for (const id of rootIds) {
      await moveTaskToTrash(id);
    }
    await reload();
  }

  async function handleRestoreFromTrash(id: number) {
    await restoreTaskFromTrash(id);
    await reload();
  }

  async function handleDeleteForever(id: number) {
    const task = trashedTasks.find((t) => t.id === id);
    if (!window.confirm(`Permanently delete "${task?.title ?? "this task"}"? This can't be undone.`)) return;
    await deleteTask(id);
    await reload();
  }

  async function handleEmptyTrash() {
    if (trashedTasks.length === 0) return;
    if (!window.confirm(`Permanently delete all ${trashedTasks.length} task(s) in Trash? This can't be undone.`)) {
      return;
    }
    await emptyTrash();
    await reload();
  }

  async function handleDelete(id: number) {
    if (pendingDelete) await commitPendingDelete();

    const task = tasks.find((t) => t.id === id);
    const allIds = [id, ...getDescendantIds(id)];
    schedulePendingDelete({
      rootIds: [id],
      allIds,
      label: `"${task?.title ?? "Task"}" deleted${allIds.length > 1 ? ` (with ${allIds.length - 1} subtask(s))` : ""}`,
    });
  }

  function handleUndoDelete() {
    if (pendingDeleteTimeout.current != null) {
      window.clearTimeout(pendingDeleteTimeout.current);
      pendingDeleteTimeout.current = null;
    }
    setPendingDelete(null);
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
    setShowBulkTagPicker(false);
    setShowBulkPostponePicker(false);
  }

  function handleToggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleBulkComplete() {
    for (const id of selectedIds) {
      await applyCompletion(id, true);
    }
    exitSelectMode();
    await reload();
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (pendingDelete) await commitPendingDelete();

    const rootIds = [...selectedIds];
    const allIds = [...new Set(rootIds.flatMap((id) => [id, ...getDescendantIds(id)]))];
    schedulePendingDelete({
      rootIds,
      allIds,
      label: `${rootIds.length} task${rootIds.length > 1 ? "s" : ""} deleted`,
    });
    exitSelectMode();
  }

  async function handleBulkAddTag(tagId: number) {
    for (const id of selectedIds) {
      await addTagToTask(id, tagId);
    }
    await reload();
  }

  // Unlike handleBulkAddTag (additive — a task can pick up several tags in
  // a row without losing the selection), a task only ever belongs to one
  // list at a time, so this is closer in spirit to Postpone/Complete/Delete
  // below: one decision that resolves the batch, so it exits select mode
  // afterward rather than leaving the selection open for another pick.
  async function handleBulkChangeList(listId: number | null) {
    for (const id of selectedIds) {
      await updateTaskList(id, listId);
    }
    exitSelectMode();
    await reload();
  }

  // Same eligibility as the single-task Postpone button (has a due date,
  // isn't recurring — Skip is the recurring equivalent), plus the "overdue"
  // qualifier the bulk action is specifically for: a selected task that
  // isn't actually overdue is silently left untouched rather than treated
  // as an error, since selection in bulk mode isn't itself a promise that
  // every selected task is eligible for whatever action gets applied next.
  async function handleBulkPostpone(days: number) {
    for (const id of selectedIds) {
      const task = tasks.find((t) => t.id === id);
      if (!task?.dueDate || task.recurrence) continue;
      if (!isOverdue(task.dueDate, task.dueTime, task.completed)) continue;
      const nextDue = addInterval(task.dueDate, "daily", days);
      await updateTaskDueDate(id, nextDue, task.dueTime ?? "");
    }
    exitSelectMode();
    await reload();
  }

  async function handleAddSubtask(parentId: number, title: string) {
    const parent = tasks.find((t) => t.id === parentId);
    await createTask(
      title,
      parent?.dueDate ?? undefined,
      parentId,
      undefined,
      undefined,
      parent?.dueTime ?? undefined,
      parent?.listId ?? undefined
    );
    await reload();
  }

  async function handleDuplicateTask(id: number) {
    await duplicateTask(id);
    await reload();
  }

  // Advances a recurring task's own due date to the next occurrence in
  // place, without touching `completed`/`completed_at` or spawning a new
  // row — the series' single live row just moves forward a beat, so this
  // occurrence is skipped rather than marked done. If the next date would
  // fall past the rule's end date, there's nothing left to skip to, so the
  // recurrence is simply dropped instead (same as what happens when a normal
  // completion runs out the end date).
  async function handleSkipOccurrence(id: number) {
    const task = tasks.find((t) => t.id === id);
    if (!task?.recurrence) return;
    const baseDate = task.dueDate ?? todayStr();
    const nextDue = nextRecurrenceDate(baseDate, task.recurrence);
    const withinEnd = !task.recurrence.endDate || nextDue <= task.recurrence.endDate;
    const withinCount = task.recurrence.occurrencesLeft == null || task.recurrence.occurrencesLeft > 1;
    if (withinEnd && withinCount) {
      await decrementRecurrenceOccurrences(task.recurrence.id);
      await updateTaskDueDate(id, nextDue, task.dueTime ?? "");
    } else {
      await clearTaskRecurrence(id);
    }
    await reload();
  }

  // The non-recurring counterpart to "Skip" — just pushes a task's own due
  // date forward a day in place, reusing addInterval's "daily" step so the
  // date math stays in one place rather than duplicating it.
  async function handlePostpone(id: number) {
    const task = tasks.find((t) => t.id === id);
    if (!task?.dueDate || task.recurrence) return;
    const nextDue = addInterval(task.dueDate, "daily", 1);
    await updateTaskDueDate(id, nextDue, task.dueTime ?? "");
    await reload();
  }

  async function handleTogglePin(id: number) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    await updateTaskPinned(id, !task.pinned);
    await reload();
  }

  async function handleToggleInProgress(id: number) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    await updateTaskInProgress(id, !task.inProgress);
    await reload();
  }

  // The row itself already knows the exact new value it's about to show
  // locally (see TaskRow's own collapsed state), so this takes that value
  // explicitly rather than re-deriving "toggle from task.collapsed" here —
  // avoids any chance of the two disagreeing.
  async function handleSetCollapsed(id: number, collapsed: boolean) {
    await updateTaskCollapsed(id, collapsed);
    await reload();
  }

  // Every task that's someone's parent, regardless of whether it (or its
  // children) happen to be visible under whatever filter/search is
  // currently active — Expand/Collapse-all is a blanket reset of a real,
  // persisted preference, not scoped to only what the current view shows.
  function tasksWithChildren(): number[] {
    const parentIds = new Set(tasks.map((t) => t.parentId).filter((id): id is number => id != null));
    return [...parentIds];
  }

  async function handleExpandAll() {
    setCollapseSignal((prev) => ({ collapsed: false, version: (prev?.version ?? 0) + 1 }));
    await Promise.all(tasksWithChildren().map((id) => updateTaskCollapsed(id, false)));
    await reload();
  }

  async function handleCollapseAll() {
    setCollapseSignal((prev) => ({ collapsed: true, version: (prev?.version ?? 0) + 1 }));
    await Promise.all(tasksWithChildren().map((id) => updateTaskCollapsed(id, true)));
    await reload();
  }

  async function handleToggleTimer(id: number) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    if (task.timerStartedAt) {
      await stopTaskTimer(id);
    } else {
      await startTaskTimer(id);
      // One-directional: starting the timer means you're actively working
      // on this right now, so it's a reasonable moment to also mark it in
      // progress. The reverse doesn't hold — stopping the timer (a break,
      // done for the day, ...) doesn't imply the task is no longer in
      // progress, so that flag is left alone on stop.
      if (!task.inProgress) await updateTaskInProgress(id, true);
    }
    await reload();
  }

  async function handleResetTimer(id: number) {
    if (!window.confirm("Reset this task's logged time back to 0:00? This can't be undone.")) return;
    await resetTaskTimer(id);
    await reload();
  }

  async function handleArchive(id: number) {
    await updateTaskArchived(id, true);
    await reload();
  }

  async function handleUnarchive(id: number) {
    await updateTaskArchived(id, false);
    await reload();
  }

  async function handleBacklog(id: number) {
    await updateTaskBacklog(id, true);
    await reload();
  }

  async function handleUnbacklog(id: number) {
    await updateTaskBacklog(id, false);
    await reload();
  }

  async function handleSaveAsTemplate(id: number) {
    const task = tasks.find((t) => t.id === id);
    const name = window.prompt("Name this template:", task?.title ?? "");
    if (!name || !name.trim()) return;
    await saveTaskAsTemplate(id, name.trim());
    await reload();
  }

  // Stamps out a fresh task (and its whole subtask subtree) from a saved
  // template, using whatever due date is currently pending for the add form
  // — the same default a manually-added task on this view would get.
  async function handleUseTemplate(templateId: number) {
    await createTaskFromTemplate(templateId, dueDate || undefined);
    setShowTemplatesPicker(false);
    await reload();
  }

  async function handleDeleteTemplate(id: number) {
    await deleteTaskTemplate(id);
    await reload();
  }

  // Reordering only makes sense among true siblings (same parent), and
  // operates on the full sibling group rather than whatever subset the
  // current view/filter happens to show, so a hidden sibling's position
  // doesn't get scrambled by a drag made within a filtered view.
  // Dropping onto a target always inserts the dragged task just before it
  // among the target's real siblings — same as before when they already
  // share a parent, but now also reparenting the dragged task to the
  // target's parent when they don't. Dropping onto any top-level task's row
  // is how a subtask gets promoted to top-level, since a top-level task's
  // parentId is already null. Dropping onto anything inside the dragged
  // task's own subtree is rejected — that would make it its own ancestor.
  async function handleReorder(draggedId: number, targetId: number, position: "before" | "after" = "before") {
    if (draggedId === targetId) return;
    const dragged = tasks.find((t) => t.id === draggedId);
    const target = tasks.find((t) => t.id === targetId);
    if (!dragged || !target) return;
    if (getDescendantIds(draggedId).includes(targetId)) return;

    const newParentId = target.parentId;
    if (dragged.parentId === newParentId) {
      const siblings = tasks.filter((t) => t.parentId === dragged.parentId);
      const reordered = siblings.filter((t) => t.id !== draggedId);
      const targetIndex = reordered.findIndex((t) => t.id === targetId);
      reordered.splice(position === "after" ? targetIndex + 1 : targetIndex, 0, dragged);
      await Promise.all(reordered.map((t, i) => updateTaskSortOrder(t.id, i)));
    } else {
      const oldSiblings = tasks.filter((t) => t.parentId === dragged.parentId && t.id !== draggedId);
      const newSiblings = tasks.filter((t) => t.parentId === newParentId && t.id !== draggedId);
      const targetIndex = newSiblings.findIndex((t) => t.id === targetId);
      newSiblings.splice(position === "after" ? targetIndex + 1 : targetIndex, 0, dragged);

      await updateTaskParent(draggedId, newParentId);
      await Promise.all([
        ...oldSiblings.map((t, i) => updateTaskSortOrder(t.id, i)),
        ...newSiblings.map((t, i) => updateTaskSortOrder(t.id, i)),
      ]);
    }
    await reload();
  }

  // The keyboard-operable equivalent of dragging a row's ⠿ handle — Alt+↑/↓
  // on a focused row (wired below, alongside the plain ↑/↓ row-navigation
  // shortcut) swaps it with its immediate sibling instead of requiring a
  // mouse drag. Reuses handleReorder's own same-parent branch (never
  // reparents, since the target here is always a true sibling already).
  async function handleMoveTask(id: number, direction: "up" | "down") {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const siblings = tasks.filter((t) => t.parentId === task.parentId);
    const index = siblings.findIndex((t) => t.id === id);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;
    await handleReorder(id, siblings[targetIndex].id, direction === "up" ? "before" : "after");
  }

  async function handleSaveTitle(id: number, title: string) {
    await updateTaskTitle(id, title);
    await reload();
  }

  async function handleSaveDescription(id: number, description: string) {
    await updateTaskDescription(id, description);
    await reload();
  }

  async function handleSaveDueDate(id: number, taskDueDate: string, dueTime: string) {
    await updateTaskDueDate(id, taskDueDate, dueTime);
    await reload();
  }

  async function handleSavePriority(id: number, priority: Priority | null) {
    await updateTaskPriority(id, priority);
    await reload();
  }

  async function handleSaveReminder(id: number, reminderAt: string | null, reminderRepeat: RecurrenceFrequency | null) {
    await updateTaskReminder(id, reminderAt, reminderRepeat);
    await reload();
  }

  async function handleSaveHighlightColor(id: number, color: string | null) {
    await updateTaskHighlightColor(id, color);
    await reload();
  }

  async function handleSaveEstimate(id: number, estimatedMinutes: number | null) {
    await updateTaskEstimate(id, estimatedMinutes);
    await reload();
  }

  async function handleSaveRecurrence(id: number, recurrence: RecurrenceInput | null) {
    const task = tasks.find((t) => t.id === id);
    if (!recurrence) {
      if (task?.recurrence) await clearTaskRecurrence(id);
    } else if (task?.recurrence) {
      await updateRecurrenceRule(
        task.recurrence.id,
        recurrence.frequency,
        recurrence.interval,
        recurrence.endDate,
        recurrence.occurrences,
        recurrence.weekdays
      );
    } else {
      const recurrenceId = await createRecurrenceRule(
        recurrence.frequency,
        recurrence.interval,
        recurrence.endDate,
        recurrence.occurrences,
        recurrence.weekdays
      );
      await setTaskRecurrenceId(id, recurrenceId);
    }
    await reload();
  }

  async function handleAddAttachment(taskId: number, path: string) {
    await addAttachmentToTask(taskId, path);
    await reload();
  }

  async function handleRemoveAttachment(attachmentId: number) {
    await removeAttachment(attachmentId);
    await reload();
  }

  async function handleAddDependency(taskId: number, dependsOnId: number) {
    try {
      await addTaskDependency(taskId, dependsOnId);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
      return;
    }
    await reload();
  }

  async function handleRemoveDependency(taskId: number, dependsOnId: number) {
    await removeTaskDependency(taskId, dependsOnId);
    await reload();
  }

  async function handleAddRelatedTask(taskId: number, relatedTaskId: number) {
    try {
      await addRelatedTask(taskId, relatedTaskId);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
      return;
    }
    await reload();
  }

  async function handleRemoveRelatedTask(taskId: number, relatedTaskId: number) {
    await removeRelatedTask(taskId, relatedTaskId);
    await reload();
  }

  function handleSelectRelatedTask(taskId: number) {
    const everyTask = [...tasks, ...archivedTasks, ...trashedTasks];
    const task = everyTask.find((t) => t.id === taskId);
    if (task) setSelectedTask(task);
  }

  async function handleToggleTag(taskId: number, tagId: number, assign: boolean) {
    if (assign) {
      await addTagToTask(taskId, tagId);
    } else {
      await removeTagFromTask(taskId, tagId);
    }
    await reload();
  }

  return {
    pendingDelete,
    collapseSignal,
    selectMode,
    setSelectMode,
    selectedIds,
    showBulkTagPicker,
    setShowBulkTagPicker,
    showBulkListPicker,
    setShowBulkListPicker,
    showBulkPostponePicker,
    setShowBulkPostponePicker,
    bulkPostponeDays,
    setBulkPostponeDays,
    exitSelectMode,
    handleAddTask,
    handleToggle,
    handleRestoreFromTrash,
    handleDeleteForever,
    handleEmptyTrash,
    handleDelete,
    handleUndoDelete,
    handleToggleSelect,
    handleBulkComplete,
    handleBulkDelete,
    handleBulkAddTag,
    handleBulkChangeList,
    handleBulkPostpone,
    handleAddSubtask,
    handleDuplicateTask,
    handleSkipOccurrence,
    handlePostpone,
    handleTogglePin,
    handleToggleInProgress,
    handleSetCollapsed,
    handleExpandAll,
    handleCollapseAll,
    handleToggleTimer,
    handleResetTimer,
    handleArchive,
    handleUnarchive,
    handleBacklog,
    handleUnbacklog,
    handleSaveAsTemplate,
    handleUseTemplate,
    handleDeleteTemplate,
    handleReorder,
    handleMoveTask,
    handleSaveTitle,
    handleSaveDescription,
    handleSaveDueDate,
    handleSavePriority,
    handleSaveReminder,
    handleSaveHighlightColor,
    handleSaveEstimate,
    handleSaveRecurrence,
    handleAddAttachment,
    handleRemoveAttachment,
    handleAddDependency,
    handleRemoveDependency,
    handleAddRelatedTask,
    handleRemoveRelatedTask,
    handleSelectRelatedTask,
    handleToggleTag,
  };
}
