import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CustomTab, Priority, RecurrenceFrequency, SavedView, Tag, Task, TaskTemplate } from "./types";
import {
  getAllTasks,
  getAllTags,
  createTask,
  createTag,
  addTagToTask,
  removeTagFromTask,
  updateTagName,
  updateTagColor,
  deleteTag,
  createRecurrenceRule,
  updateRecurrenceRule,
  decrementRecurrenceOccurrences,
  setTaskRecurrenceId,
  clearTaskRecurrence,
  setTaskCompleted,
  deleteTask,
  getTrashedTasks,
  moveTaskToTrash,
  restoreTaskFromTrash,
  purgeExpiredTrash,
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
  getAllSavedViews,
  createSavedView,
  deleteSavedView,
  duplicateTask,
  getAllCustomTabs,
  createCustomTab,
  deleteCustomTab,
  updateCustomTabColor,
  updateCustomTabDescription,
  updateCustomTabDefaultTag,
  updateCustomTabIcon,
  updateCustomTabSortOrder,
  applyTagToAllTasksInList,
  getAllTaskTemplates,
  saveTaskAsTemplate,
  createTaskFromTemplate,
  deleteTaskTemplate,
  addTaskDependency,
  removeTaskDependency,
  addRelatedTask,
  removeRelatedTask,
  getArchivedTasks,
  updateTaskArchived,
  updateTaskReminder,
  updateTaskHighlightColor,
  updateTaskEstimate,
  updateTaskInProgress,
  updateTaskParent,
  updateTaskBacklog,
  updateTaskList,
} from "./lib/db";
import TaskDetailModal from "./components/TaskDetailModal";
import CommandPalette, { type PaletteCommand } from "./components/CommandPalette";
import AddTaskModal from "./components/AddTaskModal";
import AddCustomTabModal from "./components/AddCustomTabModal";
import TaskRow from "./components/TaskRow";
import CalendarView from "./components/CalendarView";
import HistoryView from "./components/HistoryView";
import ArchiveView from "./components/ArchiveView";
import BacklogView from "./components/BacklogView";
import TrashView from "./components/TrashView";
import StatsView from "./components/StatsView";
import ManageTagsModal from "./components/ManageTagsModal";
import Sidebar from "./components/Sidebar";
import { SettingsProvider, type SettingsContextValue } from "./lib/SettingsContext";
import { addInterval, getWeekRange, isOverdue, nowTimestamp, todayStr, formatDateDisplay } from "./lib/date";
import { lastNDays, buildDailyCounts, computeStreaks, weekStartOf, buildWeeklyCounts } from "./lib/stats";
import {
  type View,
  VIEW_LABELS,
  type Theme,
  SNOOZE_OPTIONS_MINUTES,
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
  PANEL_WIDTH_DEFAULT,
  PANEL_WIDTH_MIN,
  PANEL_WIDTH_MAX,
  TRASH_RETENTION_DEFAULT_DAYS,
  TRASH_RETENTION_OPTIONS_DAYS,
  OVERDUE_CHECK_INTERVAL_MS,
  type SortOption,
} from "./lib/appConstants";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "./lib/priority";
import { buildTaskTree, withDescendants } from "./lib/tree";
import { hexToRgba, DANGER_COLOR } from "./lib/color";
import { CARD_STYLE, POPOVER_STYLE } from "./lib/sharedStyles";
import { exportToFile, importFromFile, exportTaskAsMarkdown } from "./lib/backup";
import { taskToMarkdown, listToMarkdown } from "./lib/taskMarkdown";
import { nextRecurrenceDate, type RecurrenceInput } from "./lib/recurrence";
import { useClickOutside } from "./lib/useClickOutside";
import { useReminders } from "./lib/useReminders";
import { useKeyboardShortcuts } from "./lib/useKeyboardShortcuts";
import { useTaskFilters } from "./lib/useTaskFilters";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

// The full set of fields the task detail modal's Save button commits at
// once — undo/redo for edits treats that whole click as a single step
// (reverting/reapplying every field together) rather than one step per
// field, since that's what the user actually did in one action.
interface EditSnapshot {
  title: string;
  description: string;
  dueDate: string;
  dueTime: string;
  priority: Priority | null;
  recurrence: RecurrenceInput | null;
  reminderAt: string | null;
  reminderRepeat: RecurrenceFrequency | null;
  highlightColor: string | null;
  estimatedMinutes: number | null;
}

interface EditHistoryEntry {
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

const SORT_LABELS: Record<SortOption, string> = {
  manual: "Manual (drag order)",
  dueDate: "Due date",
  priority: "Priority",
  title: "Title",
};

function getInitialTheme(): Theme {
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialSnoozeMinutes(): number {
  const stored = Number(localStorage.getItem("notifySnoozeMinutes"));
  return SNOOZE_OPTIONS_MINUTES.includes(stored) ? stored : 60;
}

function getInitialWeekStartsOn(): 0 | 1 {
  return localStorage.getItem("weekStartsOn") === "1" ? 1 : 0;
}

function getInitialSidebarWidth(): number {
  const stored = Number(localStorage.getItem("sidebarWidth"));
  return stored >= SIDEBAR_WIDTH_MIN && stored <= SIDEBAR_WIDTH_MAX ? stored : SIDEBAR_WIDTH_DEFAULT;
}

function getInitialPanelWidth(): number {
  const stored = Number(localStorage.getItem("panelWidth"));
  return stored >= PANEL_WIDTH_MIN && stored <= PANEL_WIDTH_MAX ? stored : PANEL_WIDTH_DEFAULT;
}

function getInitialTrashRetentionDays(): number {
  const stored = Number(localStorage.getItem("trashRetentionDays"));
  return TRASH_RETENTION_OPTIONS_DAYS.includes(stored) ? stored : TRASH_RETENTION_DEFAULT_DAYS;
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [trashedTasks, setTrashedTasks] = useState<Task[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [showTemplatesPicker, setShowTemplatesPicker] = useState(false);
  const [showAddTabModal, setShowAddTabModal] = useState(false);
  const [activeTagFilter, setActiveTagFilter] = useState<number | null>(null);
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("manual");
  const [collapseSignal, setCollapseSignal] = useState<{ collapsed: boolean; version: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showManageTags, setShowManageTags] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [view, setView] = useState<View>("all");
  const [showMoreViews, setShowMoreViews] = useState(false);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [customAccent, setCustomAccent] = useState<string | null>(() => localStorage.getItem("accentColor"));
  const [colorPickerTabId, setColorPickerTabId] = useState<number | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showConfigMenu, setShowConfigMenu] = useState(false);
  const [notifySnoozeMinutes, setNotifySnoozeMinutes] = useState<number>(getInitialSnoozeMinutes);
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(getInitialWeekStartsOn);
  const [sidebarWidth, setSidebarWidth] = useState<number>(getInitialSidebarWidth);
  const [panelWidth, setPanelWidth] = useState<number>(getInitialPanelWidth);
  const [trashRetentionDays, setTrashRetentionDays] = useState<number>(getInitialTrashRetentionDays);
  const [dndEnabled, setDndEnabled] = useState<boolean>(() => localStorage.getItem("notifyDnd") === "true");
  const [pendingDelete, setPendingDelete] = useState<{ rootIds: number[]; allIds: number[]; label: string } | null>(
    null
  );
  const pendingDeleteTimeout = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastNotifiedAt = useRef<Map<number, number>>(new Map());
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkTagPicker, setShowBulkTagPicker] = useState(false);
  const [showBulkPostponePicker, setShowBulkPostponePicker] = useState(false);
  const [bulkPostponeDays, setBulkPostponeDays] = useState("1");
  const templatesPickerRef = useRef<HTMLDivElement>(null);
  const bulkTagPickerRef = useRef<HTMLDivElement>(null);
  const bulkPostponePickerRef = useRef<HTMLDivElement>(null);
  useClickOutside(templatesPickerRef, showTemplatesPicker, () => setShowTemplatesPicker(false));
  useClickOutside(bulkTagPickerRef, showBulkTagPicker, () => setShowBulkTagPicker(false));
  useClickOutside(bulkPostponePickerRef, showBulkPostponePicker, () => setShowBulkPostponePicker(false));
  const [showCompleted, setShowCompleted] = useState(false);
  const [undoStack, setUndoStack] = useState<EditHistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<EditHistoryEntry[]>([]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Persisted independently of whatever's currently applied to the DOM
  // below — a per-tab color can temporarily override the visual accent
  // without touching this saved app-wide preference.
  useEffect(() => {
    if (customAccent) localStorage.setItem("accentColor", customAccent);
    else localStorage.removeItem("accentColor");
  }, [customAccent]);

  // The active list's own color (if it has one) overrides the app-wide
  // custom accent while that list is open. Switching away restores the
  // app-wide accent (or the theme default) automatically, since
  // effectiveAccent is just derived state re-evaluated every render.
  const activeList = activeListId != null ? (customTabs.find((t) => t.id === activeListId) ?? null) : null;
  const effectiveAccent = activeList?.color ?? customAccent;

  // Overrides --color-accent/--color-accent-soft as inline styles on the
  // root element, which win over index.css's :root/[data-theme] rules
  // regardless of which theme is active. Clearing it back to null removes
  // the inline properties so the stylesheet's per-theme defaults take over
  // again — no need to track what those defaults are.
  useEffect(() => {
    const root = document.documentElement;
    if (effectiveAccent) {
      root.style.setProperty("--color-accent", effectiveAccent);
      root.style.setProperty("--color-accent-soft", hexToRgba(effectiveAccent, 0.15));
    } else {
      root.style.removeProperty("--color-accent");
      root.style.removeProperty("--color-accent-soft");
    }
  }, [effectiveAccent]);

  useEffect(() => {
    localStorage.setItem("notifySnoozeMinutes", String(notifySnoozeMinutes));
  }, [notifySnoozeMinutes]);

  useEffect(() => {
    localStorage.setItem("weekStartsOn", String(weekStartsOn));
  }, [weekStartsOn]);

  useEffect(() => {
    localStorage.setItem("sidebarWidth", String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem("panelWidth", String(panelWidth));
  }, [panelWidth]);

  useEffect(() => {
    localStorage.setItem("trashRetentionDays", String(trashRetentionDays));
  }, [trashRetentionDays]);

  useEffect(() => {
    localStorage.setItem("notifyDnd", String(dndEnabled));
  }, [dndEnabled]);

  useEffect(() => {
    return () => {
      if (pendingDeleteTimeout.current != null) window.clearTimeout(pendingDeleteTimeout.current);
    };
  }, []);

  // In-app shortcuts (n, /, arrows, Escape, undo/redo, command palette) plus
  // the Ctrl/⌘+Shift+N OS-level global shortcut — see
  // lib/useKeyboardShortcuts.ts for the actual key-handling logic.
  useKeyboardShortcuts({
    selectedTask,
    showManageTags,
    showAddModal,
    showCommandPalette,
    searchQuery,
    sortBy,
    tasks,
    undoStack,
    redoStack,
    setSelectedTask,
    setShowManageTags,
    setShowAddModal,
    setShowCommandPalette,
    setSearchQuery,
    searchInputRef,
    handleUndo,
    handleRedo,
    handleMoveTask,
  });

  // Desktop notifications for due/overdue tasks. Reuses the same isOverdue()
  // check the rest of the app already relies on — a task becomes "due" the
  // instant it turns overdue (right at its due time for a timed task, or at
  // midnight for a plain due-date one), so there's one unified moment to
  // notify at rather than two separate "due" vs "overdue" concepts. Rather
  // than firing once and going silent forever, an overdue task keeps
  // re-notifying every `notifySnoozeMinutes` for as long as it stays
  // overdue and incomplete — effectively an automatic "snooze" instead of a
  // one-shot alert. lastNotifiedAt tracks when each task last fired; a task
  // drops out of it the moment it's no longer overdue (completed, or its
  // due date/time pushed out), so the snooze clock restarts if it becomes
  // overdue again later.
  useEffect(() => {
    (async () => {
      const granted = await isPermissionGranted();
      if (!granted) {
        await requestPermission();
      }
    })().catch((err) => console.error("Failed to request notification permission:", err));
  }, []);

  useEffect(() => {
    async function checkOverdue() {
      // Do Not Disturb pauses the check entirely — not just the send, but
      // the snooze-clock bookkeeping too, so time spent with DND on doesn't
      // count against it. Turning DND back off re-evaluates on the very next
      // tick as if no time had passed while paused, rather than picking up a
      // stale countdown.
      if (dndEnabled) return;
      const granted = await isPermissionGranted().catch(() => false);
      if (!granted) return;
      const now = Date.now();
      const snoozeMs = notifySnoozeMinutes * 60_000;
      for (const task of tasks) {
        // A backlog task is deliberately not-yet-actionable — nagging with
        // overdue notifications would undermine the whole point of hiding
        // it from Today. Standalone reminders (a separate, explicit "notify
        // me at this time" action) aren't affected by this.
        const overdue = isOverdue(task.dueDate, task.dueTime, task.completed) && !task.backlog;
        if (overdue) {
          const last = lastNotifiedAt.current.get(task.id);
          if (last == null || now - last >= snoozeMs) {
            lastNotifiedAt.current.set(task.id, now);
            sendNotification({
              title: "Task overdue",
              body: task.dueTime
                ? `${task.title} — was due ${formatDateDisplay(task.dueDate ?? "")} ${task.dueTime}`
                : `${task.title} — was due ${formatDateDisplay(task.dueDate ?? "")}`,
            });
          }
        } else if (lastNotifiedAt.current.has(task.id)) {
          lastNotifiedAt.current.delete(task.id);
        }
      }
    }

    checkOverdue();
    const interval = window.setInterval(checkOverdue, OVERDUE_CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [tasks, notifySnoozeMinutes, dndEnabled]);

  // Standalone reminders — independent of the due-date/overdue machinery
  // above, so it never touches lastNotifiedAt or the snooze loop. See
  // lib/useReminders.ts for the actual check/re-notify/advance logic.
  useReminders(tasks, dndEnabled, reload);

  useEffect(() => {
    if (view === "today" || view === "my-day") setDueDate(todayStr());
    // Bulk select only applies to the list views, not Calendar/History/Stats/Archive/Backlog/Trash.
    if (
      view === "calendar" ||
      view === "history" ||
      view === "stats" ||
      view === "archive" ||
      view === "backlog" ||
      view === "trash"
    )
      exitSelectMode();
  }, [view]);

  async function reload() {
    const [
      updatedTasks,
      updatedArchivedTasks,
      updatedTrashedTasks,
      updatedTags,
      updatedSavedViews,
      updatedCustomTabs,
      updatedTemplates,
    ] = await Promise.all([
      getAllTasks(),
      getArchivedTasks(),
      getTrashedTasks(),
      getAllTags(),
      getAllSavedViews(),
      getAllCustomTabs(),
      getAllTaskTemplates(),
    ]);
    setTasks(updatedTasks);
    setArchivedTasks(updatedArchivedTasks);
    setTrashedTasks(updatedTrashedTasks);
    setTags(updatedTags);
    setSavedViews(updatedSavedViews);
    setCustomTabs(updatedCustomTabs);
    setTaskTemplates(updatedTemplates);
    setSelectedTask((prev) => (prev ? (updatedTasks.find((t) => t.id === prev.id) ?? null) : prev));
  }

  // Trash is purged once on startup rather than on a timer — a local
  // desktop app only needs to catch up on retention whenever it's actually
  // opened, not continuously while running. Deliberately still a one-time,
  // mount-only effect even though trashRetentionDays is configurable now —
  // changing the setting mid-session takes effect on the *next* launch
  // rather than immediately purging a batch of trash the moment you lower
  // it, which would be a surprising side effect of just changing a setting.
  useEffect(() => {
    purgeExpiredTrash(trashRetentionDays).then(reload);
    // Deliberately empty deps — see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Deleting doesn't hit the database right away: the task(s) (and their
  // subtasks) are just hidden from the UI for a few seconds while a toast
  // offers "Undo". Only once that window elapses without being cancelled
  // does the task actually move to Trash (moveTaskToTrash cascades to
  // descendants itself) — a real DELETE only ever happens from within Trash
  // ("Delete forever") or once something's been there past the retention
  // window. `rootIds` are the tasks the user actually deleted; `allIds` is
  // the full set hidden from the UI in the meantime.
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
    if (
      !window.confirm(
        `Permanently delete all ${trashedTasks.length} task(s) in Trash? This can't be undone.`
      )
    ) {
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

  // Same before/after splice-insertion shape as handleReorder above, just
  // without the reparent branch — lists are always a single flat group, no
  // hierarchy to worry about.
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

  async function handleSaveTitle(id: number, title: string) {
    await updateTaskTitle(id, title);
    await reload();
  }

  async function handleSaveDescription(id: number, description: string) {
    await updateTaskDescription(id, description);
    await reload();
  }

  async function handleSaveDueDate(id: number, dueDate: string, dueTime: string) {
    await updateTaskDueDate(id, dueDate, dueTime);
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

  function toEditSnapshot(task: Task): EditSnapshot {
    return {
      title: task.title,
      description: task.description ?? "",
      dueDate: task.dueDate ?? "",
      dueTime: task.dueTime ?? "",
      priority: task.priority,
      recurrence: task.recurrence
        ? {
            frequency: task.recurrence.frequency,
            interval: task.recurrence.interval,
            endDate: task.recurrence.endDate ?? "",
            occurrences: task.recurrence.occurrencesLeft,
            weekdays: task.recurrence.weekdays,
          }
        : null,
      reminderAt: task.reminderAt,
      reminderRepeat: task.reminderRepeat,
      highlightColor: task.highlightColor,
      estimatedMinutes: task.estimatedMinutes,
    };
  }

  async function applyEditSnapshot(id: number, snap: EditSnapshot) {
    await Promise.all([
      handleSaveTitle(id, snap.title),
      handleSaveDescription(id, snap.description),
      handleSaveDueDate(id, snap.dueDate, snap.dueTime),
      handleSavePriority(id, snap.priority),
      handleSaveRecurrence(id, snap.recurrence),
      handleSaveReminder(id, snap.reminderAt, snap.reminderRepeat),
      handleSaveHighlightColor(id, snap.highlightColor),
      handleSaveEstimate(id, snap.estimatedMinutes),
    ]);
  }

  // Committing a fresh edit invalidates whatever was in the redo stack, same
  // as any standard undo/redo — there's no sensible "redo" once a new edit
  // has branched off from that point in history.
  function pushEditHistory(entry: EditHistoryEntry) {
    setUndoStack((prev) => [...prev, entry]);
    setRedoStack([]);
  }

  async function handleUndo() {
    const entry = undoStack[undoStack.length - 1];
    if (!entry) return;
    setUndoStack((prev) => prev.slice(0, -1));
    await entry.undo();
    setRedoStack((prev) => [...prev, entry]);
  }

  async function handleRedo() {
    const entry = redoStack[redoStack.length - 1];
    if (!entry) return;
    setRedoStack((prev) => prev.slice(0, -1));
    await entry.redo();
    setUndoStack((prev) => [...prev, entry]);
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

  function handleClearAllFilters() {
    setActiveTagFilter(null);
    setPriorityFilter(null);
    setSearchQuery("");
  }

  // Bumping the version (rather than just toggling `collapsed`) is what
  // makes two consecutive clicks of the *same* button both take effect —
  // see the matching effect in TaskRow.tsx.
  function handleExpandAll() {
    setCollapseSignal((prev) => ({ collapsed: false, version: (prev?.version ?? 0) + 1 }));
  }

  function handleCollapseAll() {
    setCollapseSignal((prev) => ({ collapsed: true, version: (prev?.version ?? 0) + 1 }));
  }

  // A saved view is just a shortcut for the tag/priority/search combo — it
  // doesn't touch which view (All/Today/Calendar/etc.) is currently open, so
  // "show me high-priority Work tasks" applies whether you're checking Today
  // or All rather than also forcing a page jump.
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

  // The whole-list counterpart to handleExportTaskMarkdown above — same
  // "list membership" rule the app itself uses when the list is open
  // (filterByTagPriorityAndSearch's own listId + descendants rule, via the
  // shared withDescendants() helper), just recomputed here rather than
  // reused directly, since that one is scoped to whichever list is
  // *currently active* while this needs to work for whatever list's
  // popover the export was triggered from.
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

  // Tasks pending a delete-undo window are filtered out here, upstream of
  // every other filter, so they disappear from every view immediately while
  // still existing in the database until the undo window elapses. Applies
  // equally to the archived list — a pending-delete archived task should
  // vanish from Archive just as promptly as a non-archived one does
  // elsewhere.
  const activeTasks = pendingDelete ? tasks.filter((t) => !pendingDelete.allIds.includes(t.id)) : tasks;
  const activeArchivedTasks = pendingDelete
    ? archivedTasks.filter((t) => !pendingDelete.allIds.includes(t.id))
    : archivedTasks;

  // The pinned shortlist is deliberately independent of whatever tag/
  // priority/search/view filters are currently active — it's meant to be an
  // always-visible glance list, not one more thing subject to the current
  // filter context.
  const pinnedTasks = activeTasks.filter((t) => t.pinned);

  // Shared by the main (non-archived) list, Archive, and Trash, so the tag/
  // priority/search/list filters reach all three instead of any one of them
  // silently showing everything regardless of whatever filter is currently
  // active. See lib/useTaskFilters.ts for the actual filter pipeline.
  const filterCriteria = { activeListId, activeTagFilter, priorityFilter, searchQuery };
  const searchFilteredTasks = useTaskFilters(activeTasks, filterCriteria);
  const archivedSearchFilteredTasks = useTaskFilters(activeArchivedTasks, filterCriteria);
  // No pending-delete filter needed here — nothing in the 5-second undo
  // window has been moved to Trash yet by definition.
  const trashedSearchFilteredTasks = useTaskFilters(trashedTasks, filterCriteria);

  // "Manual" preserves the order the query already came back in (driven by
  // sort_order, i.e. drag order); the other options re-sort every sibling
  // group by that criterion instead. Sorting the flat list before
  // buildTaskTree is enough to sort every level of nesting, since grouping
  // by parent preserves relative order (Array.sort is stable).
  function compareTasks(a: Task, b: Task): number {
    switch (sortBy) {
      case "dueDate": {
        if (a.dueDate == null && b.dueDate == null) return 0;
        if (a.dueDate == null) return 1;
        if (b.dueDate == null) return -1;
        const cmp = a.dueDate.localeCompare(b.dueDate);
        return cmp !== 0 ? cmp : (a.dueTime ?? "").localeCompare(b.dueTime ?? "");
      }
      case "priority": {
        const rank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
        return (a.priority ? rank[a.priority] : 3) - (b.priority ? rank[b.priority] : 3);
      }
      case "title":
        return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      default:
        return 0;
    }
  }

  function sortTasks(list: Task[]): Task[] {
    return sortBy === "manual" ? list : [...list].sort(compareTasks);
  }

  const [weekStart, weekEnd] = getWeekRange(weekStartsOn);
  // Backlog tasks are hidden from All/Today/This Week specifically — not
  // from No due date, Calendar, or History, which still show them if they
  // have a due date or are completed. Someday-with-a-date isn't a
  // contradiction, and a completed task's backlog flag is moot history.
  const visibleTasks =
    view === "today" || view === "my-day"
      ? searchFilteredTasks.filter((t) => t.dueDate === todayStr() && !t.backlog)
      : view === "this-week"
        ? searchFilteredTasks.filter(
            (t) => t.dueDate != null && t.dueDate >= weekStart && t.dueDate <= weekEnd && !t.backlog
          )
        : view === "no-date"
          ? searchFilteredTasks.filter((t) => t.dueDate == null)
          : view === "all"
            ? searchFilteredTasks.filter((t) => !t.backlog)
            : searchFilteredTasks;
  const completedCount = visibleTasks.filter((t) => t.completed).length;

  const { topLevel: topLevelTasks, childrenByParent } = buildTaskTree(sortTasks(visibleTasks));
  // Split at the top level only — a completed subtask nested under an
  // incomplete parent still renders inline exactly as before (still part of
  // that parent's own "n/m done" subtree count); only completed *root* tasks
  // move into the collapsed footer below, matching how Microsoft To Do
  // tucks finished items out of the way without touching subtask nesting.
  const incompleteTopLevel = topLevelTasks.filter((t) => !t.completed);
  const completedTopLevel = topLevelTasks.filter((t) => t.completed);

  // Overdue tasks (due date in the past, not completed) would otherwise
  // disappear once their due date passes, since Today only shows dueDate ===
  // today. Surface them in their own section above the Today list instead.
  const overdueTasks =
    view === "today" || view === "my-day"
      ? searchFilteredTasks.filter((t) => isOverdue(t.dueDate, t.dueTime, t.completed) && !t.backlog)
      : [];

  const backlogFilteredTasks = searchFilteredTasks.filter((t) => t.backlog);
  const { topLevel: overdueTopLevel, childrenByParent: overdueChildrenByParent } = buildTaskTree(
    sortTasks(overdueTasks)
  );

  // My Day's stats glance deliberately reads from activeTasks (every
  // non-archived, non-trashed task) rather than searchFilteredTasks, so an
  // active tag/priority/search filter never makes a daily streak look like
  // it's changed — it's meant to be a stable overview, not one more thing
  // subject to whatever's currently being searched for.
  const myDayDays = lastNDays(84);
  const myDayDailyCounts = buildDailyCounts(activeTasks);
  const myDayStreak = computeStreaks(myDayDailyCounts, myDayDays).current;
  const myDayCompletedToday = myDayDailyCounts.get(todayStr()) ?? 0;
  const myDayCompletedThisWeek = buildWeeklyCounts(myDayDailyCounts, myDayDays).get(weekStartOf(todayStr())) ?? 0;

  // The six views with their own dedicated component get looked up here
  // instead of a long view === "x" ? <X/> : view === "y" ? <Y/> : ... chain.
  // Everything else (all/today/this-week/no-date/my-day) shares one main
  // task-list rendering below instead — there's no single "view" key they'd
  // each map to here, so it stays the fallback rather than five duplicate
  // entries pointing at the same JSX.
  const viewComponents: Partial<Record<View, ReactNode>> = {
    calendar: (
      <CalendarView
        tasks={searchFilteredTasks}
        priorityFilter={priorityFilter}
        onToggle={handleToggle}
        onDelete={handleDelete}
        onSelectTask={setSelectedTask}
        onAddSubtask={handleAddSubtask}
        onSelectDate={setDueDate}
        onDuplicate={handleDuplicateTask}
        onSkipOccurrence={handleSkipOccurrence}
        onPostpone={handlePostpone}
        onTogglePin={handleTogglePin}
        onSaveAsTemplate={handleSaveAsTemplate}
        onExportMarkdown={handleExportTaskMarkdown}
        onArchive={handleArchive}
        onToggleInProgress={handleToggleInProgress}
        onToggleTimer={handleToggleTimer}
        onResetTimer={handleResetTimer}
        onBacklog={handleBacklog}
        onUnbacklog={handleUnbacklog}
      />
    ),
    history: (
      <HistoryView
        tasks={searchFilteredTasks}
        priorityFilter={priorityFilter}
        onToggle={handleToggle}
        onDelete={handleDelete}
        onSelectTask={setSelectedTask}
        onAddSubtask={handleAddSubtask}
        onDuplicate={handleDuplicateTask}
        onSkipOccurrence={handleSkipOccurrence}
        onPostpone={handlePostpone}
        onTogglePin={handleTogglePin}
        onSaveAsTemplate={handleSaveAsTemplate}
        onExportMarkdown={handleExportTaskMarkdown}
        onArchive={handleArchive}
        onToggleInProgress={handleToggleInProgress}
        onToggleTimer={handleToggleTimer}
        onResetTimer={handleResetTimer}
        onBacklog={handleBacklog}
        onUnbacklog={handleUnbacklog}
      />
    ),
    stats: <StatsView tasks={searchFilteredTasks} customTabs={customTabs} tags={tags} />,
    archive: (
      <ArchiveView
        tasks={archivedSearchFilteredTasks}
        priorityFilter={priorityFilter}
        onToggle={handleToggle}
        onDelete={handleDelete}
        onSelectTask={setSelectedTask}
        onAddSubtask={handleAddSubtask}
        onDuplicate={handleDuplicateTask}
        onTogglePin={handleTogglePin}
        onSaveAsTemplate={handleSaveAsTemplate}
        onExportMarkdown={handleExportTaskMarkdown}
        onUnarchive={handleUnarchive}
      />
    ),
    backlog: (
      <BacklogView
        tasks={backlogFilteredTasks}
        priorityFilter={priorityFilter}
        onToggle={handleToggle}
        onDelete={handleDelete}
        onSelectTask={setSelectedTask}
        onAddSubtask={handleAddSubtask}
        onDuplicate={handleDuplicateTask}
        onSkipOccurrence={handleSkipOccurrence}
        onPostpone={handlePostpone}
        onTogglePin={handleTogglePin}
        onSaveAsTemplate={handleSaveAsTemplate}
        onExportMarkdown={handleExportTaskMarkdown}
        onArchive={handleArchive}
        onToggleInProgress={handleToggleInProgress}
        onToggleTimer={handleToggleTimer}
        onResetTimer={handleResetTimer}
        onUnbacklog={handleUnbacklog}
      />
    ),
    trash: (
      <TrashView
        tasks={trashedSearchFilteredTasks}
        priorityFilter={priorityFilter}
        onToggle={handleToggle}
        onDeleteForever={handleDeleteForever}
        onSelectTask={setSelectedTask}
        onAddSubtask={handleAddSubtask}
        onRestore={handleRestoreFromTrash}
        onEmptyTrash={handleEmptyTrash}
      />
    ),
  };

  const settings: SettingsContextValue = {
    theme,
    setTheme,
    customAccent,
    setCustomAccent,
    dndEnabled,
    setDndEnabled,
    notifySnoozeMinutes,
    setNotifySnoozeMinutes,
    weekStartsOn,
    setWeekStartsOn,
    trashRetentionDays,
    setTrashRetentionDays,
  };

  return (
    <SettingsProvider value={settings}>
    <div style={{ display: "flex", height: "100%" }}>
      <Sidebar
        view={view}
        setView={setView}
        showMoreViews={showMoreViews}
        setShowMoreViews={setShowMoreViews}
        width={sidebarWidth}
        setWidth={setSidebarWidth}
        customTabs={customTabs}
        activeListId={activeListId}
        setActiveListId={setActiveListId}
        handleSelectCustomTab={handleSelectCustomTab}
        handleReorderCustomTab={handleReorderCustomTab}
        colorPickerTabId={colorPickerTabId}
        setColorPickerTabId={setColorPickerTabId}
        handleUpdateCustomTabColor={handleUpdateCustomTabColor}
        handleUpdateCustomTabDescription={handleUpdateCustomTabDescription}
        handleUpdateCustomTabDefaultTag={handleUpdateCustomTabDefaultTag}
        handleUpdateCustomTabIcon={handleUpdateCustomTabIcon}
        handleApplyTagToAllTasksInList={handleApplyTagToAllTasksInList}
        handleExportListMarkdown={handleExportListMarkdown}
        tags={tags}
        handleDeleteCustomTab={handleDeleteCustomTab}
        setShowAddTabModal={setShowAddTabModal}
        showConfigMenu={showConfigMenu}
        setShowConfigMenu={setShowConfigMenu}
        handleExport={handleExport}
        handleImport={handleImport}
      />
      <div
        style={{
          flex: "1 1 0",
          overflowY: "auto",
          overflowX: "hidden",
          minWidth: 0,
          // Reserves room for the detail panel (fixed-positioned, so it
          // wouldn't otherwise affect this flex item's own size) so it can
          // never end up covering a task row underneath it — same reason
          // the sidebar never covers anything, just achieved differently
          // since that one's a normal flex sibling instead of a fixed panel.
          marginRight: selectedTask ? panelWidth : 0,
          transition: "margin-right 0.18s ease-out",
        }}
      >
        <div
          style={{
            maxWidth: view === "calendar" || view === "stats" ? 880 : 560,
            margin: "0 auto",
            padding: "40px 24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{activeList ? activeList.name : VIEW_LABELS[view]}</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{ position: "relative", display: "flex" }}
                onMouseEnter={() => setShowShortcuts(true)}
                onMouseLeave={() => setShowShortcuts(false)}
              >
                <button
                  type="button"
                  aria-label="Keyboard shortcuts"
                  aria-haspopup="true"
                  aria-expanded={showShortcuts}
                  style={{
                    width: 28,
                    height: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    border: "1px solid var(--color-border)",
                    borderRadius: "50%",
                    background: "var(--color-surface)",
                    color: "var(--color-text-muted)",
                    fontSize: 13,
                  }}
                >
                  i
                </button>
                {showShortcuts && (
                  <div
                    role="tooltip"
                    style={{
                      ...POPOVER_STYLE,
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      right: 0,
                      width: 240,
                      padding: "10px 12px",
                      fontSize: 12,
                      color: "var(--color-text-muted)",
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "var(--color-text)", marginBottom: 6 }}>Keyboard shortcuts</div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span>n</span>
                      <span>New task</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span>/</span>
                      <span>Focus search</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span>↑ / ↓</span>
                      <span>Move between tasks</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span>Alt+↑ / Alt+↓</span>
                      <span>Reorder focused task</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span>Enter</span>
                      <span>Submit / open task</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span>Esc</span>
                      <span>Close modal / clear or unfocus search</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span>Ctrl/⌘+Shift+N</span>
                      <span>New task (global)</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span>Ctrl/⌘+Z</span>
                      <span>Undo edit</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span>Ctrl/⌘+Shift+Z</span>
                      <span>Redo edit</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Ctrl/⌘+K</span>
                      <span>Command palette</span>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                title="Undo the last edit (Ctrl/⌘+Z)"
                aria-label="Undo the last edit"
                style={{
                  padding: "6px 10px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface)",
                  color: "var(--color-text-muted)",
                  fontSize: 14,
                  opacity: undoStack.length > 0 ? 1 : 0.4,
                  cursor: undoStack.length > 0 ? "pointer" : "default",
                }}
              >
                ↶
              </button>
              <button
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                title="Redo the last undone edit (Ctrl/⌘+Shift+Z)"
                aria-label="Redo the last undone edit"
                style={{
                  padding: "6px 10px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface)",
                  color: "var(--color-text-muted)",
                  fontSize: 14,
                  opacity: redoStack.length > 0 ? 1 : 0.4,
                  cursor: redoStack.length > 0 ? "pointer" : "default",
                }}
              >
                ↷
              </button>
            </div>
          </div>

      {activeList?.description && (
        <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: -12, marginBottom: 20 }}>
          {activeList.description}
        </div>
      )}

      {activeListId == null && (activeTagFilter != null || priorityFilter != null || searchQuery.trim() !== "") && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            marginBottom: 20,
            padding: "8px 12px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-accent)",
            background: "var(--color-accent-soft)",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-accent)" }}>
            Filtering:
          </span>
          {activeTagFilter != null &&
            (() => {
              const tag = tags.find((t) => t.id === activeTagFilter);
              return tag ? (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: tag.color,
                    color: "#fff",
                  }}
                >
                  {tag.name}
                </span>
              ) : null;
            })()}
          {priorityFilter != null && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                padding: "2px 8px",
                borderRadius: 999,
                background: PRIORITY_COLORS[priorityFilter],
                color: "#fff",
              }}
            >
              {PRIORITY_LABELS[priorityFilter]}
            </span>
          )}
          {searchQuery.trim() !== "" && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                padding: "2px 8px",
                borderRadius: 999,
                border: "1px solid var(--color-accent)",
                color: "var(--color-accent)",
              }}
            >
              "{searchQuery.trim()}"
            </span>
          )}
          <button
            type="button"
            onClick={handleClearAllFilters}
            style={{
              marginLeft: "auto",
              border: "none",
              background: "none",
              color: "var(--color-accent)",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "underline",
            }}
          >
            Clear all
          </button>
        </div>
      )}

      {view === "my-day" && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 20 }}>
          {[
            ["Current streak", `${myDayStreak}d`],
            ["Completed today", String(myDayCompletedToday)],
            ["This week", String(myDayCompletedThisWeek)],
          ].map(([label, value]) => (
            <div key={label} style={{ ...CARD_STYLE, flex: 1, minWidth: 110, padding: "10px 14px" }}>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{value}</div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setView("stats")}
            style={{ border: "none", background: "none", color: "var(--color-accent)", fontSize: 12, fontWeight: 600 }}
          >
            Full stats →
          </button>
        </div>
      )}

      {pinnedTasks.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#f2994a", marginBottom: 6 }}>★ Pinned</div>
          <div style={CARD_STYLE}>
            {pinnedTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                depth={0}
                childrenByParent={new Map()}
                activeListId={activeListId}
                collapseSignal={collapseSignal}
                priorityFilter={priorityFilter}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onSelect={setSelectedTask}
                onAddSubtask={handleAddSubtask}
                onDuplicate={handleDuplicateTask}
                onSkipOccurrence={handleSkipOccurrence}
                onPostpone={handlePostpone}
                onTogglePin={handleTogglePin}
                onSaveAsTemplate={handleSaveAsTemplate}
                onExportMarkdown={handleExportTaskMarkdown}
                onArchive={handleArchive}
                onToggleInProgress={handleToggleInProgress}
                onToggleTimer={handleToggleTimer}
                onResetTimer={handleResetTimer}
                onBacklog={handleBacklog}
                onUnbacklog={handleUnbacklog}
              />
            ))}
          </div>
        </div>
      )}

      <div style={{ position: "relative", marginBottom: 20 }}>
        <input
          ref={searchInputRef}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tasks… (/)"
          aria-label="Search tasks"
          style={{
            width: "100%",
            padding: "8px 30px 8px 10px",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontSize: 14,
          }}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            title="Clear search"
            aria-label="Clear search"
            style={{
              position: "absolute",
              right: 6,
              top: "50%",
              transform: "translateY(-50%)",
              border: "none",
              background: "none",
              color: "var(--color-text-faint)",
              fontSize: 13,
              padding: 4,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {view !== "calendar" &&
        view !== "history" &&
        view !== "stats" &&
        view !== "archive" &&
        view !== "backlog" &&
        view !== "trash" && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)" }}>Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            style={{
              padding: "4px 8px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-surface)",
              color: "var(--color-text)",
              fontSize: 12,
            }}
          >
            {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
              <option key={option} value={option}>
                {SORT_LABELS[option]}
              </option>
            ))}
          </select>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={handleExpandAll}
              style={{ border: "none", background: "none", color: "var(--color-text-faint)", fontSize: 12 }}
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={handleCollapseAll}
              style={{ border: "none", background: "none", color: "var(--color-text-faint)", fontSize: 12 }}
            >
              Collapse all
            </button>
          </div>
        </div>
      )}

      {activeListId == null && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", marginRight: 2 }}>
            Filter by priority:
          </span>
          {(["high", "medium", "low"] as Priority[]).map((level) => {
            const active = priorityFilter === level;
            return (
              <button
                key={level}
                onClick={() => setPriorityFilter(active ? null : level)}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: `1px solid ${PRIORITY_COLORS[level]}`,
                  background: active ? PRIORITY_COLORS[level] : "none",
                  color: active ? "#fff" : PRIORITY_COLORS[level],
                }}
              >
                {PRIORITY_LABELS[level]}
              </button>
            );
          })}
        </div>
      )}

      {activeListId == null && tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 20 }}>
          {tags.map((tag) => {
            const active = activeTagFilter === tag.id;
            return (
              <button
                key={tag.id}
                onClick={() => setActiveTagFilter(active ? null : tag.id)}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: active ? "1px solid transparent" : `1px solid ${tag.color}`,
                  background: active ? tag.color : "none",
                  color: active ? "#fff" : tag.color,
                }}
              >
                {tag.name}
              </button>
            );
          })}
          <button
            onClick={() => setShowManageTags(true)}
            style={{ border: "none", background: "none", color: "var(--color-text-faint)", fontSize: 12 }}
          >
            Edit tags
          </button>
        </div>
      )}

      {activeListId == null &&
        (savedViews.length > 0 || activeTagFilter != null || priorityFilter != null || searchQuery.trim() !== "") && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", marginRight: 2 }}>
            Saved views:
          </span>
          {savedViews.map((savedView) => {
            const active = isSavedViewActive(savedView);
            return (
              <div
                key={savedView.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 6px 4px 10px",
                  borderRadius: 999,
                  border: active ? "1px solid transparent" : "1px solid var(--color-border)",
                  background: active ? "var(--color-accent)" : "none",
                  color: active ? "#fff" : "var(--color-text-muted)",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleApplySavedView(savedView)}
                  style={{
                    border: "none",
                    background: "none",
                    color: "inherit",
                    fontSize: 12,
                    fontWeight: 500,
                    padding: 0,
                  }}
                >
                  {savedView.name}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSavedView(savedView.id)}
                  title="Delete this saved view"
                  aria-label={`Delete saved view "${savedView.name}"`}
                  style={{ border: "none", background: "none", color: "inherit", fontSize: 11, padding: 0, opacity: 0.7 }}
                >
                  ✕
                </button>
              </div>
            );
          })}
          {(activeTagFilter != null || priorityFilter != null || searchQuery.trim() !== "") && (
            <button
              type="button"
              onClick={handleSaveCurrentView}
              style={{ border: "none", background: "none", color: "var(--color-text-faint)", fontSize: 12 }}
            >
              + Save current filters
            </button>
          )}
        </div>
      )}

      {(view === "today" || view === "my-day" || view === "this-week") && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 6 }}>
            {completedCount} / {visibleTasks.length} completed
          </div>
          <div
            style={{
              height: 6,
              borderRadius: "var(--radius-sm)",
              background: "var(--color-surface-sunken)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: visibleTasks.length ? `${(completedCount / visibleTasks.length) * 100}%` : "0%",
                background: "var(--color-accent)",
                transition: "width 0.2s ease",
              }}
            />
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            textAlign: "left",
            padding: "10px 14px",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-surface)",
            color: "var(--color-accent)",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 700 }}>+</span>
          Add a task
        </button>
        <div ref={templatesPickerRef} style={{ position: "relative", display: "flex" }}>
          <button
            type="button"
            onClick={() => setShowTemplatesPicker((v) => !v)}
            aria-haspopup="true"
            aria-expanded={showTemplatesPicker}
            style={{
              padding: "8px 14px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: showTemplatesPicker ? "var(--color-accent-soft)" : "none",
              color: showTemplatesPicker ? "var(--color-accent)" : "var(--color-text-muted)",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Templates ▾
          </button>
          {showTemplatesPicker && (
            <div
              style={{
                ...POPOVER_STYLE,
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                minWidth: 220,
                padding: 6,
              }}
            >
              {taskTemplates.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--color-text-faint)", padding: "4px 6px" }}>
                  No templates yet — use "Save as template" on any task.
                </div>
              )}
              {taskTemplates.map((template) => (
                <div
                  key={template.id}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <button
                    type="button"
                    onClick={() => handleUseTemplate(template.id)}
                    style={{
                      flex: 1,
                      textAlign: "left",
                      padding: "6px 6px",
                      border: "none",
                      background: "none",
                      color: "var(--color-text)",
                      fontSize: 13,
                    }}
                  >
                    {template.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTemplate(template.id)}
                    title="Delete this template"
                    aria-label={`Delete template "${template.name}"`}
                    style={{ border: "none", background: "none", color: "var(--color-text-faint)", fontSize: 11 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {view !== "calendar" &&
        view !== "history" &&
        view !== "stats" &&
        view !== "archive" &&
        view !== "backlog" &&
        view !== "trash" && (
          <button
            type="button"
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            style={{
              padding: "8px 14px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: selectMode ? "var(--color-accent-soft)" : "none",
              color: selectMode ? "var(--color-accent)" : "var(--color-text-muted)",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {selectMode ? "Cancel select" : "Select"}
          </button>
        )}
      </div>

      {selectMode && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            marginBottom: 20,
            padding: "8px 12px",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-surface-sunken)",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{selectedIds.size} selected</span>
          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={handleBulkComplete}
            style={{
              padding: "6px 10px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "none",
              color: "var(--color-text)",
              fontSize: 13,
              opacity: selectedIds.size === 0 ? 0.5 : 1,
            }}
          >
            Complete
          </button>
          <div ref={bulkTagPickerRef} style={{ position: "relative" }}>
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => setShowBulkTagPicker((v) => !v)}
              aria-haspopup="true"
              aria-expanded={showBulkTagPicker}
              style={{
                padding: "6px 10px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                background: "none",
                color: "var(--color-text)",
                fontSize: 13,
                opacity: selectedIds.size === 0 ? 0.5 : 1,
              }}
            >
              Tag ▾
            </button>
            {showBulkTagPicker && (
              <div
                style={{
                  ...POPOVER_STYLE,
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  minWidth: 140,
                  padding: 6,
                }}
              >
                {tags.length === 0 && (
                  <div style={{ fontSize: 12, color: "var(--color-text-faint)", padding: "4px 6px" }}>
                    No tags yet.
                  </div>
                )}
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleBulkAddTag(tag.id)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "4px 6px",
                      border: "none",
                      background: "none",
                      color: tag.color,
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div ref={bulkPostponePickerRef} style={{ position: "relative" }}>
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => setShowBulkPostponePicker((v) => !v)}
              title="Push every selected overdue task's due date forward by N days"
              aria-haspopup="true"
              aria-expanded={showBulkPostponePicker}
              style={{
                padding: "6px 10px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                background: "none",
                color: "var(--color-text)",
                fontSize: 13,
                opacity: selectedIds.size === 0 ? 0.5 : 1,
              }}
            >
              Postpone ▾
            </button>
            {showBulkPostponePicker && (
              <div
                style={{
                  ...POPOVER_STYLE,
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  minWidth: 220,
                  padding: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Postpone overdue by</span>
                  <input
                    type="number"
                    min={1}
                    value={bulkPostponeDays}
                    onChange={(e) => setBulkPostponeDays(e.target.value)}
                    style={{
                      width: 50,
                      padding: "4px 6px",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--color-surface)",
                      color: "var(--color-text)",
                      fontSize: 13,
                    }}
                  />
                  <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>day(s)</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleBulkPostpone(Math.max(1, Number(bulkPostponeDays) || 1))}
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--color-accent)",
                    color: "#fff",
                    fontSize: 13,
                  }}
                >
                  Apply
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={handleBulkDelete}
            style={{
              padding: "6px 10px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "none",
              color: DANGER_COLOR,
              fontSize: 13,
              opacity: selectedIds.size === 0 ? 0.5 : 1,
            }}
          >
            Delete
          </button>
        </div>
      )}

      {viewComponents[view] ?? (
        <>
          {overdueTopLevel.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DANGER_COLOR, marginBottom: 6 }}>Overdue</div>
              <div style={{ ...CARD_STYLE, border: `1px solid ${DANGER_COLOR}` }}>
                {overdueTopLevel.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    depth={0}
                    childrenByParent={overdueChildrenByParent}
                    activeListId={activeListId}
                    collapseSignal={collapseSignal}
                    priorityFilter={priorityFilter}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onSelect={setSelectedTask}
                    onAddSubtask={handleAddSubtask}
                    onReorder={sortBy === "manual" ? handleReorder : undefined}
                    selectable={selectMode}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                    onDuplicate={handleDuplicateTask}
                    onSkipOccurrence={handleSkipOccurrence}
                    onPostpone={handlePostpone}
                    onTogglePin={handleTogglePin}
                    onSaveAsTemplate={handleSaveAsTemplate}
                    onExportMarkdown={handleExportTaskMarkdown}
                    onArchive={handleArchive}
                    onToggleInProgress={handleToggleInProgress}
                    onToggleTimer={handleToggleTimer}
                    onResetTimer={handleResetTimer}
                    onBacklog={handleBacklog}
                    onUnbacklog={handleUnbacklog}
                  />
                ))}
              </div>
            </div>
          )}

          <div style={CARD_STYLE}>
            {incompleteTopLevel.length === 0 && (
              <div style={{ padding: 20, color: "var(--color-text-faint)", fontSize: 13 }}>
                {searchQuery.trim()
                  ? "No tasks match your search."
                  : priorityFilter
                    ? `No ${priorityFilter} priority tasks.`
                    : view === "today" || view === "my-day"
                      ? "No tasks due today."
                      : view === "this-week"
                        ? "No tasks due this week."
                        : view === "no-date"
                          ? "No tasks without a due date."
                          : "No tasks yet."}
              </div>
            )}
            {incompleteTopLevel.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                depth={0}
                childrenByParent={childrenByParent}
                activeListId={activeListId}
                collapseSignal={collapseSignal}
                priorityFilter={priorityFilter}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onSelect={setSelectedTask}
                onAddSubtask={handleAddSubtask}
                onReorder={sortBy === "manual" ? handleReorder : undefined}
                selectable={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onDuplicate={handleDuplicateTask}
                onSkipOccurrence={handleSkipOccurrence}
                onPostpone={handlePostpone}
                onTogglePin={handleTogglePin}
                onSaveAsTemplate={handleSaveAsTemplate}
                onExportMarkdown={handleExportTaskMarkdown}
                onArchive={handleArchive}
                onToggleInProgress={handleToggleInProgress}
                onToggleTimer={handleToggleTimer}
                onResetTimer={handleResetTimer}
                onBacklog={handleBacklog}
                onUnbacklog={handleUnbacklog}
              />
            ))}
          </div>

          {completedTopLevel.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setShowCompleted((v) => !v)}
                aria-expanded={showCompleted}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  border: "none",
                  background: "none",
                  color: "var(--color-text-muted)",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 0",
                  marginBottom: showCompleted ? 6 : 0,
                }}
              >
                <span style={{ fontSize: 10 }} aria-hidden="true">
                  {showCompleted ? "▾" : "▸"}
                </span>
                Completed ({completedTopLevel.length})
              </button>
              {showCompleted && (
                <div style={CARD_STYLE}>
                  {completedTopLevel.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      depth={0}
                      childrenByParent={childrenByParent}
                      activeListId={activeListId}
                      collapseSignal={collapseSignal}
                      priorityFilter={priorityFilter}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                      onSelect={setSelectedTask}
                      onAddSubtask={handleAddSubtask}
                      selectable={selectMode}
                      selectedIds={selectedIds}
                      onToggleSelect={handleToggleSelect}
                      onDuplicate={handleDuplicateTask}
                      onTogglePin={handleTogglePin}
                      onSaveAsTemplate={handleSaveAsTemplate}
                      onExportMarkdown={handleExportTaskMarkdown}
                      onArchive={handleArchive}
                      onBacklog={handleBacklog}
                      onUnbacklog={handleUnbacklog}
                      showCompletedDate
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
        </div>
      </div>

      {showAddModal && (
        <AddTaskModal defaultDueDate={dueDate} onClose={() => setShowAddModal(false)} onAdd={handleAddTask} />
      )}

      {showCommandPalette &&
        (() => {
          const paletteCommands: PaletteCommand[] = [
            { id: "new-task", label: "New task", run: () => setShowAddModal(true) },
            { id: "focus-search", label: "Focus search", run: () => searchInputRef.current?.focus() },
            ...(Object.keys(VIEW_LABELS) as View[]).map((v) => ({
              id: `view-${v}`,
              label: `Go to ${VIEW_LABELS[v]}`,
              run: () => {
                setView(v);
                setActiveListId(null);
              },
            })),
            {
              id: "toggle-theme",
              label: theme === "light" ? "Switch to dark mode" : "Switch to light mode",
              run: () => setTheme((t) => (t === "light" ? "dark" : "light")),
            },
            { id: "manage-tags", label: "Manage tags", run: () => setShowManageTags(true) },
            { id: "export", label: "Export backup", run: handleExport },
            { id: "import", label: "Import backup", run: handleImport },
            { id: "undo", label: "Undo last edit", run: handleUndo },
            { id: "redo", label: "Redo last undone edit", run: handleRedo },
          ];
          return (
            <CommandPalette
              tasks={[...activeTasks, ...activeArchivedTasks]}
              commands={paletteCommands}
              onSelectTask={setSelectedTask}
              onClose={() => setShowCommandPalette(false)}
            />
          );
        })()}

      {selectedTask && (
        <TaskDetailModal
          // Forces React to treat each different task as a genuinely new
          // component instance (full unmount/remount) instead of reusing
          // this one and just patching its `task` prop — every field below
          // is local `useState` seeded from `task` only on first mount, so
          // without this, clicking a different task while one was already
          // open left every field showing the *previous* task's data, and
          // Save would then write that stale data onto the newly-clicked
          // task's id instead.
          key={selectedTask.id}
          task={selectedTask}
          width={panelWidth}
          setWidth={setPanelWidth}
          allTags={tags}
          allTasks={tasks}
          // A functional updater rather than a bare `setSelectedTask(null)`:
          // this modal's own outside-click handler saves-then-closes
          // asynchronously, so by the time it resolves the user may have
          // already clicked a *different* task open (a new instance of this
          // component, with its own onClose closing over that task instead).
          // Comparing against the id this closure was created for stops a
          // slow save from clobbering whatever's actually selected by then.
          onClose={() => setSelectedTask((prev) => (prev?.id === selectedTask.id ? null : prev))}
          onSave={(
            title,
            description,
            dueDate,
            dueTime,
            priority,
            recurrence,
            reminderAt,
            reminderRepeat,
            highlightColor,
            estimatedMinutes
          ) => {
            const id = selectedTask.id;
            const before = toEditSnapshot(selectedTask);
            const after: EditSnapshot = {
              title,
              description,
              dueDate,
              dueTime,
              priority,
              recurrence,
              reminderAt,
              reminderRepeat,
              highlightColor,
              estimatedMinutes,
            };
            return applyEditSnapshot(id, after).then(() => {
              if (JSON.stringify(before) !== JSON.stringify(after)) {
                pushEditHistory({
                  undo: () => applyEditSnapshot(id, before),
                  redo: () => applyEditSnapshot(id, after),
                });
              }
            });
          }}
          onToggleTag={(tagId, assign) => handleToggleTag(selectedTask.id, tagId, assign)}
          onCreateTag={handleCreateTag}
          onAddAttachment={(path) => handleAddAttachment(selectedTask.id, path)}
          onRemoveAttachment={handleRemoveAttachment}
          onAddDependency={(dependsOnId) => handleAddDependency(selectedTask.id, dependsOnId)}
          onRemoveDependency={(dependsOnId) => handleRemoveDependency(selectedTask.id, dependsOnId)}
          onAddRelatedTask={(relatedTaskId) => handleAddRelatedTask(selectedTask.id, relatedTaskId)}
          onRemoveRelatedTask={(relatedTaskId) => handleRemoveRelatedTask(selectedTask.id, relatedTaskId)}
          onSelectRelatedTask={handleSelectRelatedTask}
          customTabs={customTabs}
          onChangeList={(listId) => handleChangeTaskList(selectedTask.id, listId)}
        />
      )}

      {showManageTags && (
        <ManageTagsModal
          tags={tags}
          onClose={() => setShowManageTags(false)}
          onRename={handleRenameTag}
          onRecolor={handleRecolorTag}
          onDelete={handleDeleteTag}
        />
      )}

      {showAddTabModal && (
        <AddCustomTabModal onClose={() => setShowAddTabModal(false)} onCreate={handleCreateCustomTab} />
      )}

      {pendingDelete && (
        <div
          style={{
            ...CARD_STYLE,
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 40,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 16px",
            fontSize: 13,
            color: "var(--color-text)",
          }}
        >
          <span>{pendingDelete.label}</span>
          <button
            onClick={handleUndoDelete}
            style={{
              border: "none",
              background: "none",
              color: "var(--color-accent)",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
    </SettingsProvider>
  );
}
