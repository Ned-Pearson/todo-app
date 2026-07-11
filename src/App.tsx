import { useEffect, useState, FormEvent } from "react";
import type { RecurrenceFrequency, Tag, Task } from "./types";
import {
  getAllTasks,
  getAllTags,
  createTask,
  createTag,
  addTagToTask,
  removeTagFromTask,
  createRecurrenceRule,
  clearTaskRecurrence,
  setTaskCompleted,
  deleteTask,
  updateTaskTitle,
  updateTaskDescription,
  updateTaskDueDate,
} from "./lib/db";
import TaskDetailModal from "./components/TaskDetailModal";
import TaskRow from "./components/TaskRow";
import CalendarView from "./components/CalendarView";
import { addInterval, todayStr } from "./lib/date";

type RepeatOption = "none" | RecurrenceFrequency;

const REPEAT_LABELS: Record<RepeatOption, string> = {
  none: "Doesn't repeat",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

type View = "all" | "today" | "no-date" | "calendar";

const VIEW_LABELS: Record<View, string> = {
  all: "All",
  today: "Today",
  "no-date": "No due date",
  calendar: "Calendar",
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
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [view, setView] = useState<View>("all");
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

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
      await createTask(trimmed, dueDate, undefined, recurrenceId);
      setTitle("");
      setDueDate("");
      setRepeat("none");
      setRepeatInterval(1);
      setRepeatEndDate("");
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
    for (const taskId of idsToUpdate) {
      await setTaskCompleted(taskId, completed);
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

  const tagFilteredTasks =
    activeTagFilter == null ? tasks : tasks.filter((t) => t.tags.some((tag) => tag.id === activeTagFilter));

  const visibleTasks =
    view === "today"
      ? tagFilteredTasks.filter((t) => t.dueDate === todayStr())
      : view === "no-date"
        ? tagFilteredTasks.filter((t) => t.dueDate == null)
        : tagFilteredTasks;
  const completedCount = visibleTasks.filter((t) => t.completed).length;

  // Build the parent/child tree over whichever set of tasks is visible in the
  // current view, so filtered views (Today, No due date) nest subtasks the
  // same way the All view does. A task whose parent isn't in the visible set
  // (e.g. filtered out) is promoted to a root within this view.
  const visibleIds = new Set(visibleTasks.map((t) => t.id));
  const childrenByParent = new Map<number, Task[]>();
  for (const t of visibleTasks) {
    if (t.parentId != null && visibleIds.has(t.parentId)) {
      const siblings = childrenByParent.get(t.parentId) ?? [];
      siblings.push(t);
      childrenByParent.set(t.parentId, siblings);
    }
  }
  const topLevelTasks = visibleTasks.filter((t) => t.parentId == null || !visibleIds.has(t.parentId));

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Tasks</h1>
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

      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {(["all", "today", "no-date", "calendar"] as View[]).map((v) => (
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

      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
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
        </div>
      )}

      {view === "today" && (
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
          tasks={tagFilteredTasks}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onSelectTask={setSelectedTask}
          onAddSubtask={handleAddSubtask}
          onSelectDate={setDueDate}
        />
      ) : (
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
              {view === "today" ? "No tasks due today." : view === "no-date" ? "No tasks without a due date." : "No tasks yet."}
            </div>
          )}
          {topLevelTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              depth={0}
              childrenByParent={childrenByParent}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onSelect={setSelectedTask}
              onAddSubtask={handleAddSubtask}
            />
          ))}
        </div>
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          allTags={tags}
          onClose={() => setSelectedTask(null)}
          onSave={(title, description, dueDate) =>
            Promise.all([
              handleSaveTitle(selectedTask.id, title),
              handleSaveDescription(selectedTask.id, description),
              handleSaveDueDate(selectedTask.id, dueDate),
            ])
          }
          onToggleTag={(tagId, assign) => handleToggleTag(selectedTask.id, tagId, assign)}
          onCreateTag={handleCreateTag}
        />
      )}
    </div>
  );
}
