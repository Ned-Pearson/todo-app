import { useEffect, useState, FormEvent } from "react";
import type { Task } from "./types";
import {
  getAllTasks,
  createTask,
  setTaskCompleted,
  deleteTask,
  updateTaskDescription,
  updateTaskDueDate,
} from "./lib/db";
import TaskDetailModal from "./components/TaskDetailModal";
import TaskRow from "./components/TaskRow";

function todayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type View = "all" | "today";

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [view, setView] = useState<View>("all");

  async function reload() {
    setTasks(await getAllTasks());
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      await createTask(trimmed, dueDate);
      setTitle("");
      setDueDate("");
      await reload();
    } catch (err) {
      console.error("Failed to add task:", err);
      window.alert(`Couldn't add task: ${err}`);
    }
  }

  async function handleToggle(id: number, completed: boolean) {
    await setTaskCompleted(id, completed);
    reload();
  }

  async function handleDelete(id: number) {
    await deleteTask(id);
    reload();
  }

  async function handleAddSubtask(parentId: number, title: string) {
    await createTask(title, undefined, parentId);
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

  const visibleTasks = view === "today" ? tasks.filter((t) => t.dueDate === todayStr()) : tasks;
  const completedCount = visibleTasks.filter((t) => t.completed).length;

  const childrenByParent = new Map<number, Task[]>();
  for (const t of tasks) {
    if (t.parentId != null) {
      const siblings = childrenByParent.get(t.parentId) ?? [];
      siblings.push(t);
      childrenByParent.set(t.parentId, siblings);
    }
  }
  const topLevelTasks = view === "today" ? visibleTasks : visibleTasks.filter((t) => t.parentId == null);

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Tasks</h1>

      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {(["all", "today"] as View[]).map((v) => (
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
              textTransform: "capitalize",
            }}
          >
            {v}
          </button>
        ))}
      </div>

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

      <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
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
      </form>

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
            {view === "today" ? "No tasks due today." : "No tasks yet."}
          </div>
        )}
        {topLevelTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            depth={0}
            childrenByParent={view === "today" ? new Map() : childrenByParent}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onSelect={setSelectedTask}
            onAddSubtask={handleAddSubtask}
          />
        ))}
      </div>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onSave={(description, dueDate) =>
            Promise.all([handleSaveDescription(selectedTask.id, description), handleSaveDueDate(selectedTask.id, dueDate)])
          }
        />
      )}
    </div>
  );
}
