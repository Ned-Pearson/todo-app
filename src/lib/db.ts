import Database from "@tauri-apps/plugin-sql";
import type { RecurrenceFrequency, Tag, Task } from "../types";

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!dbInstance) {
    dbInstance = await Database.load("sqlite:tasks.db");
  }
  return dbInstance;
}

function rowToTask(row: any, tags: Tag[]): Task {
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
    tags,
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
  const tagRows = await db.select<any[]>(`
    SELECT task_tags.task_id AS task_id, tags.id AS tag_id, tags.name AS name, tags.color AS color
    FROM task_tags
    JOIN tags ON tags.id = task_tags.tag_id
  `);
  const tagsByTask = new Map<number, Tag[]>();
  for (const row of tagRows) {
    const list = tagsByTask.get(row.task_id) ?? [];
    list.push({ id: row.tag_id, name: row.name, color: row.color });
    tagsByTask.set(row.task_id, list);
  }
  return rows.map((row) => rowToTask(row, tagsByTask.get(row.id) ?? []));
}

export async function getAllTags(): Promise<Tag[]> {
  const db = await getDb();
  return db.select<Tag[]>("SELECT * FROM tags ORDER BY name");
}

export async function createTag(name: string, color: string): Promise<number> {
  const db = await getDb();
  const result = await db.execute("INSERT INTO tags (name, color) VALUES (?, ?)", [name, color]);
  return result.lastInsertId as number;
}

export async function deleteTag(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM task_tags WHERE tag_id = ?", [id]);
  await db.execute("DELETE FROM tags WHERE id = ?", [id]);
}

export async function updateTagName(id: number, name: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tags SET name = ? WHERE id = ?", [name, id]);
}

export async function updateTagColor(id: number, color: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tags SET color = ? WHERE id = ?", [color, id]);
}

export async function addTagToTask(taskId: number, tagId: number): Promise<void> {
  const db = await getDb();
  await db.execute("INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)", [taskId, tagId]);
}

export async function removeTagFromTask(taskId: number, tagId: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM task_tags WHERE task_id = ? AND tag_id = ?", [taskId, tagId]);
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
