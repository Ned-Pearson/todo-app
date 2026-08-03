import { useEffect, useRef, useState } from "react";
import type { CustomTab, Priority, SavedView, Tag, Task, TaskTemplate } from "./types";
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
  getAllTaskTemplates,
  saveTaskAsTemplate,
  createTaskFromTemplate,
  deleteTaskTemplate,
  addTaskDependency,
  removeTaskDependency,
  getArchivedTasks,
  updateTaskArchived,
  updateTaskReminder,
  markReminderNotified,
  updateTaskHighlightColor,
  updateTaskInProgress,
} from "./lib/db";
import TaskDetailModal from "./components/TaskDetailModal";
import AddTaskModal from "./components/AddTaskModal";
import AddCustomTabModal from "./components/AddCustomTabModal";
import TaskRow from "./components/TaskRow";
import CalendarView from "./components/CalendarView";
import HistoryView from "./components/HistoryView";
import ArchiveView from "./components/ArchiveView";
import StatsView from "./components/StatsView";
import ManageTagsModal from "./components/ManageTagsModal";
import { addInterval, getWeekRange, isOverdue, nowTimestamp, todayStr } from "./lib/date";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "./lib/priority";
import { buildTaskTree } from "./lib/tree";
import { hexToRgba } from "./lib/color";
import { exportToFile, importFromFile } from "./lib/backup";
import { nextRecurrenceDate, type RecurrenceInput } from "./lib/recurrence";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

const GLOBAL_QUICK_ADD_SHORTCUT = "CommandOrControl+Shift+N";
const OVERDUE_CHECK_INTERVAL_MS = 60_000;

type View = "all" | "today" | "this-week" | "no-date" | "calendar" | "history" | "stats" | "archive";

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
  highlightColor: string | null;
}

interface EditHistoryEntry {
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

const VIEW_LABELS: Record<View, string> = {
  all: "All",
  today: "Today",
  "this-week": "This Week",
  "no-date": "No due date",
  calendar: "Calendar",
  history: "History",
  stats: "Stats",
  archive: "Archive",
};

type SortOption = "manual" | "dueDate" | "priority" | "title";

const SORT_LABELS: Record<SortOption, string> = {
  manual: "Manual (drag order)",
  dueDate: "Due date",
  priority: "Priority",
  title: "Title",
};

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// The light/dark stylesheet defaults from index.css — used as the color
// picker's starting value while no custom accent is set, so it opens on
// something sensible instead of an arbitrary color.
const DEFAULT_ACCENT: Record<Theme, string> = { light: "#3d4f3a", dark: "#7fa374" };

const SNOOZE_OPTIONS_MINUTES = [15, 30, 60, 120, 240];

const SNOOZE_LABELS: Record<number, string> = {
  15: "15 minutes",
  30: "30 minutes",
  60: "1 hour",
  120: "2 hours",
  240: "4 hours",
};

function getInitialSnoozeMinutes(): number {
  const stored = Number(localStorage.getItem("notifySnoozeMinutes"));
  return SNOOZE_OPTIONS_MINUTES.includes(stored) ? stored : 60;
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [showTemplatesPicker, setShowTemplatesPicker] = useState(false);
  const [showAddTabModal, setShowAddTabModal] = useState(false);
  const [activeTagFilter, setActiveTagFilter] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("manual");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showManageTags, setShowManageTags] = useState(false);
  const [view, setView] = useState<View>("all");
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [customAccent, setCustomAccent] = useState<string | null>(() => localStorage.getItem("accentColor"));
  const [showAccentPicker, setShowAccentPicker] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [notifySnoozeMinutes, setNotifySnoozeMinutes] = useState<number>(getInitialSnoozeMinutes);
  const [dndEnabled, setDndEnabled] = useState<boolean>(() => localStorage.getItem("notifyDnd") === "true");
  const [showNotifySettings, setShowNotifySettings] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ rootIds: number[]; allIds: number[]; label: string } | null>(
    null
  );
  const pendingDeleteTimeout = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastNotifiedAt = useRef<Map<number, number>>(new Map());
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkTagPicker, setShowBulkTagPicker] = useState(false);
  const [undoStack, setUndoStack] = useState<EditHistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<EditHistoryEntry[]>([]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // A custom accent overrides --color-accent/--color-accent-soft as inline
  // styles on the root element, which win over index.css's :root/[data-
  // theme] rules regardless of which theme is active. Clearing it back to
  // null removes the inline properties so the stylesheet's per-theme
  // defaults take over again — no need to track what those defaults are.
  useEffect(() => {
    const root = document.documentElement;
    if (customAccent) {
      root.style.setProperty("--color-accent", customAccent);
      root.style.setProperty("--color-accent-soft", hexToRgba(customAccent, 0.15));
      localStorage.setItem("accentColor", customAccent);
    } else {
      root.style.removeProperty("--color-accent");
      root.style.removeProperty("--color-accent-soft");
      localStorage.removeItem("accentColor");
    }
  }, [customAccent]);

  useEffect(() => {
    localStorage.setItem("notifySnoozeMinutes", String(notifySnoozeMinutes));
  }, [notifySnoozeMinutes]);

  useEffect(() => {
    localStorage.setItem("notifyDnd", String(dndEnabled));
  }, [dndEnabled]);

  useEffect(() => {
    return () => {
      if (pendingDeleteTimeout.current != null) window.clearTimeout(pendingDeleteTimeout.current);
    };
  }, []);

  // Keyboard shortcuts: "n" opens the add-task modal, "/" focuses search,
  // arrow keys move focus between task rows, Enter opens whatever row
  // currently has focus (handled by TaskRow itself), and Escape closes
  // whichever modal is open or clears a focused, non-empty search field.
  // Everything except Escape is skipped while a modal is open or while
  // typing in any text field, so shortcuts never hijack normal typing —
  // Escape is the one shortcut that needs to work *while* a modal is open,
  // since that's how it closes one.
  useEffect(() => {
    function isTextEntry(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (selectedTask) {
          setSelectedTask(null);
        } else if (showManageTags) {
          setShowManageTags(false);
        } else if (showAddModal) {
          setShowAddModal(false);
        } else if (e.target === searchInputRef.current && searchQuery) {
          // Clear first; a second Escape (now that it's empty) falls through
          // to the blur below instead of doing nothing.
          setSearchQuery("");
        } else if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
          // Nothing left to close/clear — just drop focus from whatever's
          // currently focused (search box, a task row from arrow-key nav,
          // etc.) so Escape always has *something* to do.
          document.activeElement.blur();
        }
        return;
      }

      // Undo/redo works regardless of which modal (if any) is open, unlike
      // the shortcuts below — closing the detail modal via Save is exactly
      // when you'd want to undo it. It only backs off for a focused text
      // field, so it doesn't steal a text field's own native undo/redo.
      if ((e.ctrlKey || e.metaKey) && !isTextEntry(e.target)) {
        const key = e.key.toLowerCase();
        if (key === "z" && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
          return;
        }
        if ((key === "z" && e.shiftKey) || key === "y") {
          e.preventDefault();
          handleRedo();
          return;
        }
      }

      if (selectedTask || showManageTags || showAddModal) return;

      if (e.key === "n" && !isTextEntry(e.target)) {
        e.preventDefault();
        setShowAddModal(true);
        return;
      }

      if (e.key === "/" && !isTextEntry(e.target)) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      if (isTextEntry(e.target)) return;

      const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-task-row]"));
      if (rows.length === 0) return;
      const currentIndex = rows.indexOf(document.activeElement as HTMLElement);
      e.preventDefault();
      if (e.key === "ArrowDown") {
        rows[Math.min(currentIndex + 1, rows.length - 1)]?.focus();
      } else {
        rows[currentIndex === -1 ? 0 : Math.max(currentIndex - 1, 0)]?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTask, showManageTags, showAddModal, searchQuery, undoStack, redoStack]);

  // A global (OS-level) shortcut so quick-add works even when the app isn't
  // focused — pressing it brings the window to the front and opens the Add
  // Task modal, unlike "n" which only works while the app already has focus.
  useEffect(() => {
    register(GLOBAL_QUICK_ADD_SHORTCUT, async (event) => {
      if (event.state !== "Pressed") return;
      try {
        const win = getCurrentWindow();
        if (await win.isMinimized()) await win.unminimize();
        await win.show();
        await win.setFocus();
      } catch (err) {
        console.error("Failed to focus window from global shortcut:", err);
      }
      setShowAddModal(true);
    }).catch((err) => {
      console.error(`Failed to register global shortcut ${GLOBAL_QUICK_ADD_SHORTCUT}:`, err);
    });

    return () => {
      unregisterAll().catch(() => {});
    };
  }, []);

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
      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        granted = permission === "granted";
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
        const overdue = isOverdue(task.dueDate, task.dueTime, task.completed);
        if (overdue) {
          const last = lastNotifiedAt.current.get(task.id);
          if (last == null || now - last >= snoozeMs) {
            lastNotifiedAt.current.set(task.id, now);
            sendNotification({
              title: "Task overdue",
              body: task.dueTime
                ? `${task.title} — was due ${task.dueDate} ${task.dueTime}`
                : `${task.title} — was due ${task.dueDate}`,
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

  // Standalone reminders: a one-shot nudge at reminderAt, independent of the
  // due-date/overdue machinery above — it never implies the task is "due",
  // so it doesn't touch lastNotifiedAt or the snooze loop. Once fired it's
  // marked reminder_notified so it never re-fires; changing the reminder
  // time (via updateTaskReminder) resets that flag to schedule a fresh one.
  useEffect(() => {
    async function checkReminders() {
      if (dndEnabled) return;
      const granted = await isPermissionGranted().catch(() => false);
      if (!granted) return;
      const now = nowTimestamp();
      const due = tasks.filter(
        (t) => t.reminderAt && !t.reminderNotified && !t.completed && t.reminderAt <= now
      );
      if (due.length === 0) return;
      for (const task of due) {
        sendNotification({ title: "Reminder", body: task.title });
      }
      await Promise.all(due.map((t) => markReminderNotified(t.id)));
      await reload();
    }

    checkReminders();
    const interval = window.setInterval(checkReminders, OVERDUE_CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [tasks, dndEnabled]);

  useEffect(() => {
    if (view === "today") setDueDate(todayStr());
    // Bulk select only applies to the list views, not Calendar/History/Stats/Archive.
    if (view === "calendar" || view === "history" || view === "stats" || view === "archive") exitSelectMode();
  }, [view]);

  async function reload() {
    const [updatedTasks, updatedArchivedTasks, updatedTags, updatedSavedViews, updatedCustomTabs, updatedTemplates] =
      await Promise.all([
        getAllTasks(),
        getArchivedTasks(),
        getAllTags(),
        getAllSavedViews(),
        getAllCustomTabs(),
        getAllTaskTemplates(),
      ]);
    setTasks(updatedTasks);
    setArchivedTasks(updatedArchivedTasks);
    setTags(updatedTags);
    setSavedViews(updatedSavedViews);
    setCustomTabs(updatedCustomTabs);
    setTaskTemplates(updatedTemplates);
    setSelectedTask((prev) => (prev ? (updatedTasks.find((t) => t.id === prev.id) ?? null) : prev));
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleAddTask(
    title: string,
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
      await createTask(title, taskDueDate, undefined, recurrenceId, priority ?? undefined, taskDueDate ? dueTime : undefined);
      // Today keeps defaulting to today's date, Calendar keeps whatever day is
      // selected — only clear the field when neither has a sensible default
      // to fall back to.
      if (view === "today") {
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
          await createTask(task.title, nextDue, task.parentId ?? undefined, task.recurrence.id);
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
  // does the actual cascading DELETE happen — cascading delete on a parent
  // with subtasks is otherwise unforgiving. `rootIds` are the tasks the user
  // actually deleted (deleteTask cascades to their descendants itself);
  // `allIds` is the full set hidden from the UI in the meantime.
  function schedulePendingDelete(pending: { rootIds: number[]; allIds: number[]; label: string }) {
    setPendingDelete(pending);
    pendingDeleteTimeout.current = window.setTimeout(() => {
      commitPendingDelete();
    }, 5000);
  }

  async function commitPendingDelete() {
    if (pendingDeleteTimeout.current != null) {
      window.clearTimeout(pendingDeleteTimeout.current);
      pendingDeleteTimeout.current = null;
    }
    const rootIds = pendingDelete?.rootIds ?? [];
    setPendingDelete(null);
    for (const id of rootIds) {
      await deleteTask(id);
    }
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

  async function handleAddSubtask(parentId: number, title: string) {
    const parent = tasks.find((t) => t.id === parentId);
    await createTask(title, parent?.dueDate ?? undefined, parentId, undefined, undefined, parent?.dueTime ?? undefined);
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

  async function handleArchive(id: number) {
    await updateTaskArchived(id, true);
    await reload();
  }

  async function handleUnarchive(id: number) {
    await updateTaskArchived(id, false);
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
  async function handleReorder(draggedId: number, targetId: number) {
    if (draggedId === targetId) return;
    const dragged = tasks.find((t) => t.id === draggedId);
    const target = tasks.find((t) => t.id === targetId);
    if (!dragged || !target || dragged.parentId !== target.parentId) return;

    const siblings = tasks.filter((t) => t.parentId === dragged.parentId);
    const reordered = siblings.filter((t) => t.id !== draggedId);
    const targetIndex = reordered.findIndex((t) => t.id === targetId);
    reordered.splice(targetIndex, 0, dragged);

    await Promise.all(reordered.map((t, i) => updateTaskSortOrder(t.id, i)));
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

  async function handleSaveReminder(id: number, reminderAt: string | null) {
    await updateTaskReminder(id, reminderAt);
    await reload();
  }

  async function handleSaveHighlightColor(id: number, color: string | null) {
    await updateTaskHighlightColor(id, color);
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
      highlightColor: task.highlightColor,
    };
  }

  async function applyEditSnapshot(id: number, snap: EditSnapshot) {
    await Promise.all([
      handleSaveTitle(id, snap.title),
      handleSaveDescription(id, snap.description),
      handleSaveDueDate(id, snap.dueDate, snap.dueTime),
      handleSavePriority(id, snap.priority),
      handleSaveRecurrence(id, snap.recurrence),
      handleSaveReminder(id, snap.reminderAt),
      handleSaveHighlightColor(id, snap.highlightColor),
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

  // A custom tab is really just a shortcut for "switch to All and filter by
  // this tag" — clicking one sets exactly that pair of state, and it reads
  // as "active" whenever those two happen to already match (including via
  // the ordinary tag filter row), the same way saved views work.
  async function handleCreateCustomTab(tabName: string, tag: { id: number } | { name: string; color: string }) {
    const tagId = "id" in tag ? tag.id : await createTag(tag.name, tag.color);
    await createCustomTab(tabName, tagId);
    setShowAddTabModal(false);
    await reload();
    setView("all");
    setActiveTagFilter(tagId);
  }

  function handleSelectCustomTab(tab: CustomTab) {
    setView("all");
    setActiveTagFilter(tab.tagId);
  }

  async function handleDeleteCustomTab(id: number) {
    await deleteCustomTab(id);
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
  // still existing in the database until the undo window elapses.
  const activeTasks = pendingDelete ? tasks.filter((t) => !pendingDelete.allIds.includes(t.id)) : tasks;

  // The pinned shortlist is deliberately independent of whatever tag/
  // priority/search/view filters are currently active — it's meant to be an
  // always-visible glance list, not one more thing subject to the current
  // filter context.
  const pinnedTasks = activeTasks.filter((t) => t.pinned);

  const tagFilteredTasks =
    activeTagFilter == null
      ? activeTasks
      : activeTasks.filter(
          (t) =>
            t.tags.some((tag) => tag.id === activeTagFilter) ||
            t.inheritedTags.some((tag) => tag.id === activeTagFilter)
        );

  // Selecting a priority keeps only tasks flagged with it, plus every one of
  // their descendants (regardless of the descendant's own priority) so a
  // matching task's subtree stays intact. Tasks with no priority set (and no
  // matching ancestor) are dropped entirely rather than just reordered.
  const priorityFilteredTasks = (() => {
    if (!priorityFilter) return tagFilteredTasks;
    const visibleIdSet = new Set(tagFilteredTasks.filter((t) => t.priority === priorityFilter).map((t) => t.id));
    function addDescendants(id: number) {
      for (const t of tagFilteredTasks) {
        if (t.parentId === id && !visibleIdSet.has(t.id)) {
          visibleIdSet.add(t.id);
          addDescendants(t.id);
        }
      }
    }
    for (const id of [...visibleIdSet]) addDescendants(id);
    return tagFilteredTasks.filter((t) => visibleIdSet.has(t.id));
  })();

  const searchFilteredTasks = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return priorityFilteredTasks;
    return priorityFilteredTasks.filter(
      (t) => t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q)
    );
  })();

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

  const [weekStart, weekEnd] = getWeekRange();
  const visibleTasks =
    view === "today"
      ? searchFilteredTasks.filter((t) => t.dueDate === todayStr())
      : view === "this-week"
        ? searchFilteredTasks.filter((t) => t.dueDate != null && t.dueDate >= weekStart && t.dueDate <= weekEnd)
        : view === "no-date"
          ? searchFilteredTasks.filter((t) => t.dueDate == null)
          : searchFilteredTasks;
  const completedCount = visibleTasks.filter((t) => t.completed).length;

  const { topLevel: topLevelTasks, childrenByParent } = buildTaskTree(sortTasks(visibleTasks));

  // Overdue tasks (due date in the past, not completed) would otherwise
  // disappear once their due date passes, since Today only shows dueDate ===
  // today. Surface them in their own section above the Today list instead.
  const overdueTasks =
    view === "today" ? searchFilteredTasks.filter((t) => isOverdue(t.dueDate, t.dueTime, t.completed)) : [];
  const { topLevel: overdueTopLevel, childrenByParent: overdueChildrenByParent } = buildTaskTree(
    sortTasks(overdueTasks)
  );

  return (
    <div
      style={{
        maxWidth: view === "calendar" || view === "stats" ? 880 : 560,
        margin: "0 auto",
        padding: "40px 24px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Tasks</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{ position: "relative", display: "flex" }}
            onMouseEnter={() => setShowShortcuts(true)}
            onMouseLeave={() => setShowShortcuts(false)}
          >
            <button
              type="button"
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
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  zIndex: 30,
                  width: 240,
                  padding: "10px 12px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface)",
                  boxShadow: "var(--shadow-card)",
                  fontSize: 12,
                  color: "var(--color-text-muted)",
                }}
              >
                <div style={{ fontWeight: 600, color: "var(--color-text)", marginBottom: 6 }}>
                  Keyboard shortcuts
                </div>
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
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Ctrl/⌘+Shift+Z</span>
                  <span>Redo edit</span>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            title="Undo the last edit (Ctrl/⌘+Z)"
            style={{
              padding: "6px 10px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-surface)",
              color: "var(--color-text-muted)",
              fontSize: 14,
              opacity: undoStack.length === 0 ? 0.4 : 1,
              cursor: undoStack.length === 0 ? "default" : "pointer",
            }}
          >
            ↶
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="Redo the last undone edit (Ctrl/⌘+Shift+Z)"
            style={{
              padding: "6px 10px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-surface)",
              color: "var(--color-text-muted)",
              fontSize: 14,
              opacity: redoStack.length === 0 ? 0.4 : 1,
              cursor: redoStack.length === 0 ? "default" : "pointer",
            }}
          >
            ↷
          </button>
          <button
            onClick={handleExport}
            title="Export a backup of everything to a JSON file"
            style={{
              padding: "6px 10px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-surface)",
              color: "var(--color-text-muted)",
              fontSize: 13,
            }}
          >
            Export
          </button>
          <button
            onClick={handleImport}
            title="Restore from a backup JSON file (replaces everything currently in the app)"
            style={{
              padding: "6px 10px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-surface)",
              color: "var(--color-text-muted)",
              fontSize: 13,
            }}
          >
            Import
          </button>
          <div style={{ position: "relative", display: "flex" }}>
            <button
              type="button"
              onClick={() => setShowNotifySettings((v) => !v)}
              title={dndEnabled ? "Notifications paused (Do Not Disturb)" : "Overdue notification settings"}
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
              {dndEnabled ? "🔕" : "🔔"}
            </button>
            {showNotifySettings && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  zIndex: 30,
                  width: 200,
                  padding: "10px 12px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface)",
                  boxShadow: "var(--shadow-card)",
                  fontSize: 12,
                  color: "var(--color-text-muted)",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: 600,
                    color: "var(--color-text)",
                    marginBottom: 10,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={dndEnabled}
                    onChange={(e) => setDndEnabled(e.target.checked)}
                    style={{ accentColor: "var(--color-accent)" }}
                  />
                  Do Not Disturb
                </label>
                <div style={{ opacity: dndEnabled ? 0.5 : 1 }}>
                  <div style={{ fontWeight: 600, color: "var(--color-text)", marginBottom: 6 }}>
                    Remind me again every
                  </div>
                  <select
                    value={notifySnoozeMinutes}
                    onChange={(e) => setNotifySnoozeMinutes(Number(e.target.value))}
                    disabled={dndEnabled}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--color-surface)",
                      color: "var(--color-text)",
                      fontSize: 13,
                    }}
                  >
                    {SNOOZE_OPTIONS_MINUTES.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {SNOOZE_LABELS[minutes]}
                      </option>
                    ))}
                  </select>
                  <div style={{ marginTop: 6, color: "var(--color-text-faint)" }}>
                    for as long as a task stays overdue
                  </div>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            style={{
              padding: "6px 10px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-surface)",
              color: "var(--color-text-muted)",
              fontSize: 14,
            }}
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          <div style={{ position: "relative", display: "flex" }}>
            <button
              type="button"
              onClick={() => setShowAccentPicker((v) => !v)}
              title="Custom accent color"
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
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "var(--color-accent)",
                  display: "block",
                }}
              />
            </button>
            {showAccentPicker && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  zIndex: 30,
                  width: 180,
                  padding: "10px 12px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface)",
                  boxShadow: "var(--shadow-card)",
                  fontSize: 12,
                  color: "var(--color-text-muted)",
                }}
              >
                <div style={{ fontWeight: 600, color: "var(--color-text)", marginBottom: 6 }}>Accent color</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: customAccent ? 6 : 0 }}>
                  <input
                    type="color"
                    value={customAccent ?? DEFAULT_ACCENT[theme]}
                    onChange={(e) => setCustomAccent(e.target.value)}
                    style={{
                      width: 40,
                      height: 28,
                      padding: 0,
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-sm)",
                      background: "none",
                    }}
                  />
                  <span style={{ fontSize: 12 }}>{customAccent ?? "Theme default"}</span>
                </div>
                {customAccent && (
                  <button
                    type="button"
                    onClick={() => setCustomAccent(null)}
                    style={{ border: "none", background: "none", color: "var(--color-accent)", fontSize: 12 }}
                  >
                    Reset to theme default
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {pinnedTasks.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#f2994a", marginBottom: 6 }}>★ Pinned</div>
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            {pinnedTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                depth={0}
                childrenByParent={new Map()}
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
                onArchive={handleArchive}
                onToggleInProgress={handleToggleInProgress}
              />
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, marginBottom: 20 }}>
        {(["all", "today", "this-week", "no-date", "calendar", "history", "stats", "archive"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: "6px 12px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: view === v ? "var(--color-accent-soft)" : "none",
              color: view === v ? "var(--color-accent)" : "var(--color-text-muted)",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
        {customTabs.map((tab) => {
          const active = view === "all" && activeTagFilter === tab.tagId;
          return (
            <div
              key={tab.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "6px 6px 6px 12px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                background: active ? "var(--color-accent-soft)" : "none",
              }}
            >
              <button
                onClick={() => handleSelectCustomTab(tab)}
                style={{
                  border: "none",
                  background: "none",
                  color: active ? "var(--color-accent)" : "var(--color-text-muted)",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                {tab.name}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCustomTab(tab.id)}
                title="Delete this tab"
                style={{
                  border: "none",
                  background: "none",
                  color: active ? "var(--color-accent)" : "var(--color-text-faint)",
                  fontSize: 11,
                  opacity: 0.7,
                  padding: 0,
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setShowAddTabModal(true)}
          title="Add a custom tab for a project/tag"
          style={{
            padding: "6px 12px",
            border: "1px dashed var(--color-border)",
            borderRadius: "var(--radius-sm)",
            background: "none",
            color: "var(--color-text-faint)",
            fontSize: 13,
          }}
        >
          + Tab
        </button>
      </div>

      <div style={{ position: "relative", marginBottom: 20 }}>
        <input
          ref={searchInputRef}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tasks… (/)"
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

      {view !== "calendar" && view !== "history" && view !== "stats" && view !== "archive" && (
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
        </div>
      )}

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

      {tags.length > 0 && (
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

      {(savedViews.length > 0 || activeTagFilter != null || priorityFilter != null || searchQuery.trim() !== "") && (
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

      {(view === "today" || view === "this-week") && (
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
            padding: "8px 14px",
            border: "none",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-accent)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          + Add task
        </button>
        <div style={{ position: "relative", display: "flex" }}>
          <button
            type="button"
            onClick={() => setShowTemplatesPicker((v) => !v)}
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
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                zIndex: 30,
                minWidth: 220,
                padding: 6,
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-surface)",
                boxShadow: "var(--shadow-card)",
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
                    style={{ border: "none", background: "none", color: "var(--color-text-faint)", fontSize: 11 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {view !== "calendar" && view !== "history" && view !== "stats" && view !== "archive" && (
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
          <div style={{ position: "relative" }}>
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => setShowBulkTagPicker((v) => !v)}
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
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  zIndex: 30,
                  minWidth: 140,
                  padding: 6,
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface)",
                  boxShadow: "var(--shadow-card)",
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
          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={handleBulkDelete}
            style={{
              padding: "6px 10px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "none",
              color: "#c9184a",
              fontSize: 13,
              opacity: selectedIds.size === 0 ? 0.5 : 1,
            }}
          >
            Delete
          </button>
        </div>
      )}

      {view === "calendar" ? (
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
          onArchive={handleArchive}
          onToggleInProgress={handleToggleInProgress}
        />
      ) : view === "history" ? (
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
          onArchive={handleArchive}
          onToggleInProgress={handleToggleInProgress}
        />
      ) : view === "stats" ? (
        <StatsView tasks={searchFilteredTasks} />
      ) : view === "archive" ? (
        <ArchiveView
          tasks={archivedTasks}
          priorityFilter={priorityFilter}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onSelectTask={setSelectedTask}
          onAddSubtask={handleAddSubtask}
          onDuplicate={handleDuplicateTask}
          onTogglePin={handleTogglePin}
          onSaveAsTemplate={handleSaveAsTemplate}
          onUnarchive={handleUnarchive}
        />
      ) : (
        <>
          {overdueTopLevel.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#c9184a", marginBottom: 6 }}>Overdue</div>
              <div
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid #c9184a",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                {overdueTopLevel.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    depth={0}
                    childrenByParent={overdueChildrenByParent}
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
                    onArchive={handleArchive}
                    onToggleInProgress={handleToggleInProgress}
                  />
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            {topLevelTasks.length === 0 && (
              <div style={{ padding: 20, color: "var(--color-text-faint)", fontSize: 13 }}>
                {searchQuery.trim()
                  ? "No tasks match your search."
                  : priorityFilter
                    ? `No ${priorityFilter} priority tasks.`
                    : view === "today"
                      ? "No tasks due today."
                      : view === "this-week"
                        ? "No tasks due this week."
                        : view === "no-date"
                          ? "No tasks without a due date."
                          : "No tasks yet."}
              </div>
            )}
            {topLevelTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                depth={0}
                childrenByParent={childrenByParent}
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
                onArchive={handleArchive}
                onToggleInProgress={handleToggleInProgress}
              />
            ))}
          </div>
        </>
      )}

      {showAddModal && (
        <AddTaskModal defaultDueDate={dueDate} onClose={() => setShowAddModal(false)} onAdd={handleAddTask} />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          allTags={tags}
          allTasks={tasks}
          onClose={() => setSelectedTask(null)}
          onSave={(title, description, dueDate, dueTime, priority, recurrence, reminderAt, highlightColor) => {
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
              highlightColor,
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
        <AddCustomTabModal
          tags={tags}
          onClose={() => setShowAddTabModal(false)}
          onCreate={handleCreateCustomTab}
        />
      )}

      {pendingDelete && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 40,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 16px",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            background: "var(--color-surface)",
            boxShadow: "var(--shadow-card)",
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
  );
}
