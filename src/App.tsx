import { useEffect, useRef, useState, FormEvent } from "react";
import type { Priority, RecurrenceFrequency, Tag, Task } from "./types";
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
  clearTaskRecurrence,
  setTaskCompleted,
  deleteTask,
  updateTaskTitle,
  updateTaskDescription,
  updateTaskDueDate,
  updateTaskPriority,
  addAttachmentToTask,
  removeAttachment,
  updateTaskSortOrder,
} from "./lib/db";
import TaskDetailModal from "./components/TaskDetailModal";
import TaskRow from "./components/TaskRow";
import CalendarView from "./components/CalendarView";
import HistoryView from "./components/HistoryView";
import ManageTagsModal from "./components/ManageTagsModal";
import { addInterval, getWeekRange, isOverdue, nowTimestamp, todayStr } from "./lib/date";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "./lib/priority";
import { buildTaskTree } from "./lib/tree";
import { exportToFile, importFromFile } from "./lib/backup";

type RepeatOption = "none" | RecurrenceFrequency;

const REPEAT_LABELS: Record<RepeatOption, string> = {
  none: "Doesn't repeat",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

type View = "all" | "today" | "this-week" | "no-date" | "calendar" | "history";

const VIEW_LABELS: Record<View, string> = {
  all: "All",
  today: "Today",
  "this-week": "This Week",
  "no-date": "No due date",
  calendar: "Calendar",
  history: "History",
};

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [activeTagFilter, setActiveTagFilter] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [repeat, setRepeat] = useState<RepeatOption>("none");
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [repeatEndDate, setRepeatEndDate] = useState("");
  const [priority, setPriority] = useState<Priority | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<Priority | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showManageTags, setShowManageTags] = useState(false);
  const [view, setView] = useState<View>("all");
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Keyboard shortcuts: "n" focuses the add-task field, arrow keys move focus
  // between task rows, Enter opens whatever row currently has focus (handled
  // by TaskRow itself). Skipped entirely while a modal is open or while
  // typing in any text field, so shortcuts never hijack normal typing.
  useEffect(() => {
    function isTextEntry(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (selectedTask || showManageTags) return;

      if (e.key === "n" && !isTextEntry(e.target)) {
        e.preventDefault();
        titleInputRef.current?.focus();
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
  }, [selectedTask, showManageTags]);

  useEffect(() => {
    if (view === "today") setDueDate(todayStr());
  }, [view]);

  async function reload() {
    const [updatedTasks, updatedTags] = await Promise.all([getAllTasks(), getAllTags()]);
    setTasks(updatedTasks);
    setTags(updatedTags);
    setSelectedTask((prev) => (prev ? (updatedTasks.find((t) => t.id === prev.id) ?? null) : prev));
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      const recurrenceId =
        repeat === "none" ? undefined : await createRecurrenceRule(repeat, repeatInterval, repeatEndDate);
      await createTask(trimmed, dueDate, undefined, recurrenceId, priority ?? undefined);
      setTitle("");
      // Today keeps defaulting to today's date, Calendar keeps whatever day
      // is selected — only clear the field when neither has a sensible
      // default to fall back to.
      if (view === "today") {
        setDueDate(todayStr());
      } else if (view !== "calendar") {
        setDueDate("");
      }
      setRepeat("none");
      setRepeatInterval(1);
      setRepeatEndDate("");
      setPriority(null);
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

  async function handleToggle(id: number, completed: boolean) {
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
        const nextDue = addInterval(baseDate, task.recurrence.frequency, task.recurrence.interval);
        const withinEnd = !task.recurrence.endDate || nextDue <= task.recurrence.endDate;
        if (withinEnd) {
          await createTask(task.title, nextDue, task.parentId ?? undefined, task.recurrence.id);
          await clearTaskRecurrence(task.id);
        }
      }
    }

    await reload();
  }

  async function handleDelete(id: number) {
    await deleteTask(id);
    reload();
  }

  async function handleAddSubtask(parentId: number, title: string) {
    const parent = tasks.find((t) => t.id === parentId);
    await createTask(title, parent?.dueDate ?? undefined, parentId);
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

  async function handleSaveDueDate(id: number, dueDate: string) {
    await updateTaskDueDate(id, dueDate);
    await reload();
  }

  async function handleSavePriority(id: number, priority: Priority | null) {
    await updateTaskPriority(id, priority);
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

  const tagFilteredTasks =
    activeTagFilter == null
      ? tasks
      : tasks.filter(
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

  const { topLevel: topLevelTasks, childrenByParent } = buildTaskTree(visibleTasks);

  // Overdue tasks (due date in the past, not completed) would otherwise
  // disappear once their due date passes, since Today only shows dueDate ===
  // today. Surface them in their own section above the Today list instead.
  const overdueTasks =
    view === "today" ? searchFilteredTasks.filter((t) => isOverdue(t.dueDate, t.completed)) : [];
  const { topLevel: overdueTopLevel, childrenByParent: overdueChildrenByParent } = buildTaskTree(overdueTasks);

  return (
    <div style={{ maxWidth: view === "calendar" ? 880 : 560, margin: "0 auto", padding: "40px 24px" }}>
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
                  width: 220,
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
                  <span>↑ / ↓</span>
                  <span>Move between tasks</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Enter</span>
                  <span>Submit / open task</span>
                </div>
              </div>
            )}
          </div>
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
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {(["all", "today", "this-week", "no-date", "calendar", "history"] as View[]).map((v) => (
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
      </div>

      <div style={{ position: "relative", marginBottom: 20 }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tasks…"
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

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 20 }}>
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
                borderRadius: "var(--radius-sm)",
                border: active ? "1px solid transparent" : `1px solid ${PRIORITY_COLORS[level]}`,
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

      <form onSubmit={handleAdd} style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            ref={titleInputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a task…"
            style={{
              flex: 1,
              padding: "8px 10px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-surface)",
              color: "var(--color-text)",
              fontSize: 14,
            }}
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={{
              padding: "8px 10px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-surface)",
              color: "var(--color-text)",
              fontSize: 14,
            }}
          />
          <button
            type="submit"
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
            Add
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          {(["high", "medium", "low"] as Priority[]).map((level) => {
            const selected = priority === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => setPriority(selected ? null : level)}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: "4px 8px",
                  borderRadius: "var(--radius-sm)",
                  border: selected ? "1px solid transparent" : `1px solid ${PRIORITY_COLORS[level]}`,
                  background: selected ? PRIORITY_COLORS[level] : "none",
                  color: selected ? "#fff" : PRIORITY_COLORS[level],
                }}
              >
                {PRIORITY_LABELS[level]}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as RepeatOption)}
            style={{
              padding: "6px 8px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-surface)",
              color: "var(--color-text)",
              fontSize: 13,
            }}
          >
            {(Object.keys(REPEAT_LABELS) as RepeatOption[]).map((option) => (
              <option key={option} value={option}>
                {REPEAT_LABELS[option]}
              </option>
            ))}
          </select>

          {repeat !== "none" && (
            <>
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>every</span>
              <input
                type="number"
                min={1}
                value={repeatInterval}
                onChange={(e) => setRepeatInterval(Math.max(1, Number(e.target.value)))}
                style={{
                  width: 50,
                  padding: "6px 8px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface)",
                  color: "var(--color-text)",
                  fontSize: 13,
                }}
              />
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                {repeat === "daily" && "day(s)"}
                {repeat === "weekly" && "week(s)"}
                {repeat === "monthly" && "month(s)"}
                {repeat === "yearly" && "year(s)"}
              </span>
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>until</span>
              <input
                type="date"
                value={repeatEndDate}
                onChange={(e) => setRepeatEndDate(e.target.value)}
                style={{
                  padding: "6px 8px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface)",
                  color: "var(--color-text)",
                  fontSize: 13,
                }}
              />
            </>
          )}
        </div>
      </form>

      {view === "calendar" ? (
        <CalendarView
          tasks={searchFilteredTasks}
          priorityFilter={priorityFilter}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onSelectTask={setSelectedTask}
          onAddSubtask={handleAddSubtask}
          onSelectDate={setDueDate}
        />
      ) : view === "history" ? (
        <HistoryView
          tasks={searchFilteredTasks}
          priorityFilter={priorityFilter}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onSelectTask={setSelectedTask}
          onAddSubtask={handleAddSubtask}
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
                    onReorder={handleReorder}
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
                onReorder={handleReorder}
              />
            ))}
          </div>
        </>
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          allTags={tags}
          onClose={() => setSelectedTask(null)}
          onSave={(title, description, dueDate, priority) =>
            Promise.all([
              handleSaveTitle(selectedTask.id, title),
              handleSaveDescription(selectedTask.id, description),
              handleSaveDueDate(selectedTask.id, dueDate),
              handleSavePriority(selectedTask.id, priority),
            ])
          }
          onToggleTag={(tagId, assign) => handleToggleTag(selectedTask.id, tagId, assign)}
          onCreateTag={handleCreateTag}
          onAddAttachment={(path) => handleAddAttachment(selectedTask.id, path)}
          onRemoveAttachment={handleRemoveAttachment}
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
    </div>
  );
}
