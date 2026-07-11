import Database from "@tauri-apps/plugin-sql";
import type { RecurrenceFrequency, Task } from "../types";

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
    parentId: row.parent_id,
    completed: !!row.completed,
    createdAt: row.created_at,
    recurrence:
      row.recurrence_id != null
        ? {
            id: row.recurrence_id,
            frequency: row.recurrence_frequency,
            interval: row.recurrence_interval,
            endDate: row.recurrence_end_date,
          }
        : null,
  };
}

const TASKS_WITH_RECURRENCE_SELECT = `
  SELECT tasks.*,
         recurrence_rules.frequency AS recurrence_frequency,
         recurrence_rules.interval AS recurrence_interval,
         recurrence_rules.end_date AS recurrence_end_date
  FROM tasks
  LEFT JOIN recurrence_rules ON tasks.recurrence_id = recurrence_rules.id
`;

export async function getAllTasks(): Promise<Task[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(`${TASKS_WITH_RECURRENCE_SELECT} ORDER BY tasks.id DESC`);
  return rows.map(rowToTask);
}

export async function createRecurrenceRule(
  frequency: RecurrenceFrequency,
  interval: number,
  endDate?: string
): Promise<number> {
  const db = await getDb();
  const result = await db.execute("INSERT INTO recurrence_rules (frequency, interval, end_date) VALUES (?, ?, ?)", [
    frequency,
    interval,
    endDate || null,
  ]);
  return result.lastInsertId as number;
}

export async function createTask(
  title: string,
  dueDate?: string,
  parentId?: number,
  recurrenceId?: number
): Promise<void> {
  const db = await getDb();
  await db.execute("INSERT INTO tasks (title, due_date, parent_id, recurrence_id) VALUES (?, ?, ?, ?)", [
    title,
    dueDate || null,
    parentId ?? null,
    recurrenceId ?? null,
  ]);
}

export async function clearTaskRecurrence(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET recurrence_id = NULL WHERE id = ?", [id]);
}

export async function setTaskCompleted(id: number, completed: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET completed = ? WHERE id = ?", [completed ? 1 : 0, id]);
}

export async function updateTaskTitle(id: number, title: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET title = ? WHERE id = ?", [title, id]);
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
  const children = await db.select<any[]>("SELECT id FROM tasks WHERE parent_id = ?", [id]);
  for (const child of children) {
    await deleteTask(child.id);
  }
  await db.execute("DELETE FROM tasks WHERE id = ?", [id]);
}
