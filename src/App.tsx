import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CustomTab, Priority, SavedView, Tag, Task, TaskTemplate } from "./types";
import {
  getAllTasks,
  getAllTags,
  getTrashedTasks,
  purgeExpiredTrash,
  getAllSavedViews,
  getAllCustomTabs,
  getAllTaskTemplates,
  getArchivedTasks,
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
import { getWeekRange, isOverdue, todayStr, formatDateDisplay } from "./lib/date";
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
import { buildTaskTree } from "./lib/tree";
import { hexToRgba, DANGER_COLOR } from "./lib/color";
import { CARD_STYLE, POPOVER_STYLE } from "./lib/sharedStyles";
import { useClickOutside } from "./lib/useClickOutside";
import { useReminders } from "./lib/useReminders";
import { useKeyboardShortcuts } from "./lib/useKeyboardShortcuts";
import { useTaskFilters } from "./lib/useTaskFilters";
import { useTaskActions } from "./lib/useTaskActions";
import { useCustomTabActions } from "./lib/useCustomTabActions";
import { useTagActions } from "./lib/useTagActions";
import { useSavedViews } from "./lib/useSavedViews";
import { useBackup } from "./lib/useBackup";
import { useEditHistory, type EditSnapshot } from "./lib/useEditHistory";
import { updateTaskDragPosition } from "./lib/dragAutoScroll";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

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
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showConfigMenu, setShowConfigMenu] = useState(false);
  const [notifySnoozeMinutes, setNotifySnoozeMinutes] = useState<number>(getInitialSnoozeMinutes);
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(getInitialWeekStartsOn);
  const [sidebarWidth, setSidebarWidth] = useState<number>(getInitialSidebarWidth);
  const [panelWidth, setPanelWidth] = useState<number>(getInitialPanelWidth);
  const [trashRetentionDays, setTrashRetentionDays] = useState<number>(getInitialTrashRetentionDays);
  const [dndEnabled, setDndEnabled] = useState<boolean>(() => localStorage.getItem("notifyDnd") === "true");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastNotifiedAt = useRef<Map<number, number>>(new Map());
  const templatesPickerRef = useRef<HTMLDivElement>(null);
  const bulkTagPickerRef = useRef<HTMLDivElement>(null);
  const bulkListPickerRef = useRef<HTMLDivElement>(null);
  const bulkPostponePickerRef = useRef<HTMLDivElement>(null);
  useClickOutside(templatesPickerRef, showTemplatesPicker, () => setShowTemplatesPicker(false));
  const [showCompleted, setShowCompleted] = useState(false);

  // reload is a hoisted function declaration (defined further down this
  // component), so it can be referenced here despite running before its
  // textual definition — same reasoning applies to every handler referenced
  // below before its own definition.
  const {
    pendingDelete,
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
  } = useTaskActions({
    tasks,
    archivedTasks,
    trashedTasks,
    customTabs,
    activeListId,
    view,
    dueDate,
    reload,
    setDueDate,
    setShowAddModal,
    setShowTemplatesPicker,
    setSelectedTask,
  });

  useClickOutside(bulkTagPickerRef, showBulkTagPicker, () => setShowBulkTagPicker(false));
  useClickOutside(bulkListPickerRef, showBulkListPicker, () => setShowBulkListPicker(false));
  useClickOutside(bulkPostponePickerRef, showBulkPostponePicker, () => setShowBulkPostponePicker(false));

  // The eight per-field handlers referenced here now come from
  // useTaskActions above (called earlier in this component, so its return
  // value is already available here) rather than being hoisted function
  // declarations local to this component.
  const { undoStack, redoStack, handleUndo, handleRedo, commitTaskEdit } = useEditHistory({
    onSaveTitle: handleSaveTitle,
    onSaveDescription: handleSaveDescription,
    onSaveDueDate: handleSaveDueDate,
    onSavePriority: handleSavePriority,
    onSaveRecurrence: handleSaveRecurrence,
    onSaveReminder: handleSaveReminder,
    onSaveHighlightColor: handleSaveHighlightColor,
    onSaveEstimate: handleSaveEstimate,
  });

  const {
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
  } = useCustomTabActions({
    customTabs,
    activeListId,
    tasks,
    archivedTasks,
    trashedTasks,
    reload,
    setShowAddTabModal,
    setView,
    setActiveListId,
    setActiveTagFilter,
    setPriorityFilter,
  });

  const { handleCreateTag, handleRenameTag, handleRecolorTag, handleDeleteTag } = useTagActions({
    selectedTask,
    activeTagFilter,
    reload,
    setActiveTagFilter,
  });

  const { isSavedViewActive, handleApplySavedView, handleSaveCurrentView, handleDeleteSavedView } = useSavedViews({
    activeTagFilter,
    priorityFilter,
    searchQuery,
    reload,
    setActiveTagFilter,
    setPriorityFilter,
    setSearchQuery,
  });

  const { handleExport, handleExportTaskMarkdown, handleImport } = useBackup({
    tasks,
    archivedTasks,
    trashedTasks,
    reload,
    setSelectedTask,
    setActiveListId,
  });

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
    // exitSelectMode is a fresh closure from useTaskActions on every render
    // (unmemoized, same as handleUndo/handleRedo/handleMoveTask elsewhere in
    // this file) — this effect is only meant to react to `view` itself
    // changing, not to re-run (and redundantly exit select mode) on every
    // unrelated render while already on a non-list view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        data-main-scroll
        onDragOver={(e) => updateTaskDragPosition(e.clientY)}
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
          <div ref={bulkListPickerRef} style={{ position: "relative" }}>
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => setShowBulkListPicker((v) => !v)}
              title="Move every selected task into a list"
              aria-haspopup="true"
              aria-expanded={showBulkListPicker}
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
              List ▾
            </button>
            {showBulkListPicker && (
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
                <button
                  type="button"
                  onClick={() => handleBulkChangeList(null)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "4px 6px",
                    border: "none",
                    background: "none",
                    color: "var(--color-text-muted)",
                    fontSize: 12,
                  }}
                >
                  No list
                </button>
                {customTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleBulkChangeList(tab.id)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "4px 6px",
                      border: "none",
                      background: "none",
                      color: "var(--color-text)",
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    {tab.icon && <span style={{ marginRight: 5 }}>{tab.icon}</span>}
                    {tab.name}
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
            return commitTaskEdit(selectedTask, after);
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
