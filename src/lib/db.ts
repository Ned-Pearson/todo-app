import Database from "@tauri-apps/plugin-sql";
import type { Task } from "../types";

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!dbInstance) {
    dbInstance = await Database.load("sqlite:tasks.db");
  }
  return dbInstance;
}

function rowToTask(row: any): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    completed: !!row.completed,
    createdAt: row.created_at,
  };
}

export async function getAllTasks(): Promise<Task[]> {
  const db = await getDb();
  const rows = await db.select<any[]>("SELECT * FROM tasks ORDER BY id DESC");
  return rows.map(rowToTask);
}

export async function createTask(title: string, dueDate?: string): Promise<void> {
  const db = await getDb();
  await db.execute("INSERT INTO tasks (title, due_date) VALUES (?, ?)", [title, dueDate || null]);
}

export async function setTaskCompleted(id: number, completed: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET completed = ? WHERE id = ?", [completed ? 1 : 0, id]);
}

export async function updateTaskDescription(id: number, description: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET description = ? WHERE id = ?", [description || null, id]);
}

export async function updateTaskDueDate(id: number, dueDate: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET due_date = ? WHERE id = ?", [dueDate || null, id]);
}

export async function deleteTask(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM tasks WHERE id = ?", [id]);
}
