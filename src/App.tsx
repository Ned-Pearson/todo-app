import { useEffect, useState, FormEvent } from "react";
import type { Task } from "./types";
import { getAllTasks, createTask, setTaskCompleted, deleteTask } from "./lib/db";

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");

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
      await createTask(trimmed);
      setTitle("");
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

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Tasks</h1>

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
        {tasks.length === 0 && (
          <div style={{ padding: 20, color: "var(--color-text-faint)", fontSize: 13 }}>No tasks yet.</div>
        )}
        {tasks.map((task) => (
          <div
            key={task.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <input
              type="checkbox"
              checked={task.completed}
              onChange={(e) => handleToggle(task.id, e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "var(--color-accent)" }}
            />
            <span
              style={{
                flex: 1,
                textDecoration: task.completed ? "line-through" : "none",
                color: task.completed ? "var(--color-text-faint)" : "var(--color-text)",
              }}
            >
              {task.title}
            </span>
            <button
              onClick={() => handleDelete(task.id)}
              style={{ border: "none", background: "none", color: "var(--color-text-faint)", fontSize: 13 }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
