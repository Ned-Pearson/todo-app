import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import type Database from "@tauri-apps/plugin-sql";
import { getDb } from "./db";

interface BackupData {
  version: number;
  exportedAt: string;
  tags: Record<string, unknown>[];
  recurrenceRules: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  taskTags: Record<string, unknown>[];
  attachments: Record<string, unknown>[];
  savedViews: Record<string, unknown>[];
}

async function insertRaw(db: Database, table: string, row: Record<string, unknown>): Promise<void> {
  const columns = Object.keys(row);
  const placeholders = columns.map(() => "?").join(", ");
  await db.execute(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
    columns.map((c) => row[c])
  );
}

// Exports every raw table involved in a task's data (not the joined/computed
// shape the UI uses) so a re-import can restore the exact schema state,
// column-for-column, without needing to know the schema up front.
export async function exportToFile(): Promise<boolean> {
  const path = await save({
    defaultPath: `tasks-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!path) return false;

  const db = await getDb();
  const data: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tags: await db.select("SELECT * FROM tags"),
    recurrenceRules: await db.select("SELECT * FROM recurrence_rules"),
    tasks: await db.select("SELECT * FROM tasks"),
    taskTags: await db.select("SELECT * FROM task_tags"),
    attachments: await db.select("SELECT * FROM attachments"),
    savedViews: await db.select("SELECT * FROM saved_views"),
  };

  await writeTextFile(path, JSON.stringify(data, null, 2));
  return true;
}

// Restoring is a full replace, not a merge: importing wipes every task/tag/
// recurrence/attachment row first, then reinserts the backup's rows with
// their original ids intact (so parent_id/recurrence_id/task_tags/
// attachment references all still point at the right rows afterward).
export async function importFromFile(): Promise<boolean> {
  const path = await open({ multiple: false, filters: [{ name: "JSON", extensions: ["json"] }] });
  if (typeof path !== "string") return false;

  const contents = await readTextFile(path);
  const data = JSON.parse(contents) as BackupData;
  if (!Array.isArray(data.tasks)) {
    throw new Error("This file doesn't look like a tasks backup.");
  }

  const db = await getDb();
  await db.execute("DELETE FROM saved_views");
  await db.execute("DELETE FROM task_tags");
  await db.execute("DELETE FROM attachments");
  await db.execute("DELETE FROM tasks");
  await db.execute("DELETE FROM tags");
  await db.execute("DELETE FROM recurrence_rules");

  for (const r of data.recurrenceRules ?? []) await insertRaw(db, "recurrence_rules", r);
  for (const t of data.tags ?? []) await insertRaw(db, "tags", t);
  for (const t of data.tasks) await insertRaw(db, "tasks", t);
  for (const tt of data.taskTags ?? []) await insertRaw(db, "task_tags", tt);
  for (const a of data.attachments ?? []) await insertRaw(db, "attachments", a);
  for (const v of data.savedViews ?? []) await insertRaw(db, "saved_views", v);

  return true;
}
