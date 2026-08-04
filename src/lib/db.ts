import Database from "@tauri-apps/plugin-sql";
import type {
  Attachment,
  CustomTab,
  Priority,
  RecurrenceFrequency,
  SavedView,
  Tag,
  Task,
  TaskDependency,
  TaskTemplate,
  TemplateNode,
} from "../types";

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!dbInstance) {
    dbInstance = await Database.load("sqlite:tasks.db");
  }
  return dbInstance;
}

function rowToTask(
  row: any,
  tags: Tag[],
  inheritedTags: Tag[],
  attachments: Attachment[],
  dependsOn: TaskDependency[]
): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    dueTime: row.due_time,
    parentId: row.parent_id,
    completed: !!row.completed,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    recurrence:
      row.recurrence_id != null
        ? {
            id: row.recurrence_id,
            frequency: row.recurrence_frequency,
            interval: row.recurrence_interval,
            endDate: row.recurrence_end_date,
            occurrencesLeft: row.recurrence_occurrences_remaining,
            weekdays: row.recurrence_weekdays
              ? (row.recurrence_weekdays as string).split(",").map(Number)
              : null,
          }
        : null,
    tags,
    inheritedTags,
    priority: row.priority,
    attachments,
    pinned: !!row.pinned,
    dependsOn,
    archived: !!row.archived,
    reminderAt: row.reminder_at,
    reminderNotified: !!row.reminder_notified,
    highlightColor: row.highlight_color,
    inProgress: !!row.in_progress,
    backlog: !!row.backlog,
  };
}

// A subtask inherits tags from every ancestor up the parent_id chain — walked
// here rather than copied onto the subtask's own task_tags row, so untagging
// an ancestor instantly stops all descendants from carrying that tag.
const INHERITED_TAGS_SELECT = `
  WITH RECURSIVE task_ancestors(task_id, ancestor_id) AS (
    SELECT id AS task_id, parent_id AS ancestor_id
    FROM tasks
    WHERE parent_id IS NOT NULL

    UNION ALL

    SELECT task_ancestors.task_id, tasks.parent_id
    FROM task_ancestors
    JOIN tasks ON tasks.id = task_ancestors.ancestor_id
    WHERE tasks.parent_id IS NOT NULL
  )
  SELECT task_ancestors.task_id AS task_id,
         tags.id AS tag_id, tags.name AS name, tags.color AS color
  FROM task_ancestors
  JOIN task_tags ON task_tags.task_id = task_ancestors.ancestor_id
  JOIN tags ON tags.id = task_tags.tag_id
`;

const TASKS_WITH_RECURRENCE_SELECT = `
  SELECT tasks.*,
         recurrence_rules.frequency AS recurrence_frequency,
         recurrence_rules.interval AS recurrence_interval,
         recurrence_rules.end_date AS recurrence_end_date,
         recurrence_rules.occurrences_remaining AS recurrence_occurrences_remaining,
         recurrence_rules.weekdays AS recurrence_weekdays
  FROM tasks
  LEFT JOIN recurrence_rules ON tasks.recurrence_id = recurrence_rules.id
`;

// Shared by getAllTasks/getArchivedTasks: given a set of already-fetched
// task rows, attaches tags/inherited tags/attachments/dependencies. These
// side-queries deliberately aren't filtered by archived status — they're
// keyed by task id and only ever looked up for ids actually present in
// `rows`, so fetching them unfiltered is simpler than threading the same
// WHERE clause through four more queries for no behavioral difference.
async function attachRelations(db: Database, rows: any[]): Promise<Task[]> {
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

  const inheritedTagRows = await db.select<any[]>(INHERITED_TAGS_SELECT);
  const inheritedTagsByTask = new Map<number, Tag[]>();
  for (const row of inheritedTagRows) {
    const ownTagIds = new Set((tagsByTask.get(row.task_id) ?? []).map((t) => t.id));
    if (ownTagIds.has(row.tag_id)) continue;
    const list = inheritedTagsByTask.get(row.task_id) ?? [];
    if (!list.some((t) => t.id === row.tag_id)) {
      list.push({ id: row.tag_id, name: row.name, color: row.color });
      inheritedTagsByTask.set(row.task_id, list);
    }
  }

  const attachmentRows = await db.select<any[]>("SELECT id, task_id, path FROM attachments ORDER BY id");
  const attachmentsByTask = new Map<number, Attachment[]>();
  for (const row of attachmentRows) {
    const list = attachmentsByTask.get(row.task_id) ?? [];
    list.push({ id: row.id, path: row.path });
    attachmentsByTask.set(row.task_id, list);
  }

  const dependencyRows = await db.select<any[]>(`
    SELECT task_dependencies.task_id AS task_id,
           tasks.id AS dep_id, tasks.title AS dep_title, tasks.completed AS dep_completed
    FROM task_dependencies
    JOIN tasks ON tasks.id = task_dependencies.depends_on_id
  `);
  const dependsOnByTask = new Map<number, TaskDependency[]>();
  for (const row of dependencyRows) {
    const list = dependsOnByTask.get(row.task_id) ?? [];
    list.push({ id: row.dep_id, title: row.dep_title, completed: !!row.dep_completed });
    dependsOnByTask.set(row.task_id, list);
  }

  return rows.map((row) =>
    rowToTask(
      row,
      tagsByTask.get(row.id) ?? [],
      inheritedTagsByTask.get(row.id) ?? [],
      attachmentsByTask.get(row.id) ?? [],
      dependsOnByTask.get(row.id) ?? []
    )
  );
}

// Excludes archived tasks — the point of archiving is to move old completed
// tasks out of the everyday working set (including History, which is built
// from this same list), into the separate Archive view instead.
export async function getAllTasks(): Promise<Task[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `${TASKS_WITH_RECURRENCE_SELECT} WHERE tasks.archived = 0 ORDER BY tasks.sort_order ASC, tasks.id DESC`
  );
  return attachRelations(db, rows);
}

export async function getArchivedTasks(): Promise<Task[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `${TASKS_WITH_RECURRENCE_SELECT} WHERE tasks.archived = 1 ORDER BY tasks.completed_at DESC, tasks.id DESC`
  );
  return attachRelations(db, rows);
}

export async function updateTaskArchived(id: number, archived: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET archived = ? WHERE id = ?", [archived ? 1 : 0, id]);
}

// Setting/changing/clearing a reminder always resets reminder_notified back
// to 0, so a re-scheduled reminder fires again rather than staying silenced
// by a notification sent for its previous time.
export async function updateTaskReminder(id: number, reminderAt: string | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET reminder_at = ?, reminder_notified = 0 WHERE id = ?", [reminderAt, id]);
}

export async function markReminderNotified(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET reminder_notified = 1 WHERE id = ?", [id]);
}

export async function updateTaskHighlightColor(id: number, color: string | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET highlight_color = ? WHERE id = ?", [color, id]);
}

export async function updateTaskInProgress(id: number, inProgress: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET in_progress = ? WHERE id = ?", [inProgress ? 1 : 0, id]);
}

export async function updateTaskBacklog(id: number, backlog: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET backlog = ? WHERE id = ?", [backlog ? 1 : 0, id]);
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
  // A saved view referencing this tag still works afterward — it just drops
  // the tag part of its filter combo instead of pointing at a dead id.
  await db.execute("UPDATE saved_views SET tag_id = NULL WHERE tag_id = ?", [id]);
  // A custom tab has no meaning without its tag (unlike a saved view, which
  // can drop just the tag part and still apply its other filters), so the
  // tab itself is removed rather than left pointing at nothing.
  await db.execute("DELETE FROM custom_tabs WHERE tag_id = ?", [id]);
  await db.execute("DELETE FROM tags WHERE id = ?", [id]);
}

function rowToSavedView(row: any): SavedView {
  return {
    id: row.id,
    name: row.name,
    tagId: row.tag_id,
    priority: row.priority,
    searchQuery: row.search_query,
  };
}

export async function getAllSavedViews(): Promise<SavedView[]> {
  const db = await getDb();
  const rows = await db.select<any[]>("SELECT * FROM saved_views ORDER BY id");
  return rows.map(rowToSavedView);
}

export async function createSavedView(
  name: string,
  tagId: number | null,
  priority: Priority | null,
  searchQuery: string
): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    "INSERT INTO saved_views (name, tag_id, priority, search_query) VALUES (?, ?, ?, ?)",
    [name, tagId, priority, searchQuery || null]
  );
  return result.lastInsertId as number;
}

export async function deleteSavedView(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM saved_views WHERE id = ?", [id]);
}

function rowToCustomTab(row: any): CustomTab {
  return { id: row.id, name: row.name, tagId: row.tag_id, color: row.color };
}

export async function getAllCustomTabs(): Promise<CustomTab[]> {
  const db = await getDb();
  const rows = await db.select<any[]>("SELECT * FROM custom_tabs ORDER BY sort_order ASC, id ASC");
  return rows.map(rowToCustomTab);
}

export async function createCustomTab(name: string, tagId: number): Promise<number> {
  const db = await getDb();
  const rows = await db.select<any[]>("SELECT MAX(sort_order) AS m FROM custom_tabs");
  const nextSortOrder = (typeof rows[0]?.m === "number" ? rows[0].m : -1) + 1;
  const result = await db.execute("INSERT INTO custom_tabs (name, tag_id, sort_order) VALUES (?, ?, ?)", [
    name,
    tagId,
    nextSortOrder,
  ]);
  return result.lastInsertId as number;
}

export async function deleteCustomTab(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM custom_tabs WHERE id = ?", [id]);
}

export async function updateCustomTabColor(id: number, color: string | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE custom_tabs SET color = ? WHERE id = ?", [color, id]);
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
  endDate?: string,
  occurrencesLeft?: number | null,
  weekdays?: number[] | null
): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    "INSERT INTO recurrence_rules (frequency, interval, end_date, occurrences_remaining, weekdays) VALUES (?, ?, ?, ?, ?)",
    [frequency, interval, endDate || null, occurrencesLeft ?? null, weekdays && weekdays.length > 0 ? weekdays.join(",") : null]
  );
  return result.lastInsertId as number;
}

export async function updateRecurrenceRule(
  id: number,
  frequency: RecurrenceFrequency,
  interval: number,
  endDate?: string,
  occurrencesLeft?: number | null,
  weekdays?: number[] | null
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE recurrence_rules SET frequency = ?, interval = ?, end_date = ?, occurrences_remaining = ?, weekdays = ? WHERE id = ?",
    [
      frequency,
      interval,
      endDate || null,
      occurrencesLeft ?? null,
      weekdays && weekdays.length > 0 ? weekdays.join(",") : null,
      id,
    ]
  );
}

// Called each time a recurring task advances (completes and spawns the next
// instance, or is skipped in place) so the shared rule row reflects one
// fewer occurrence remaining for whichever instance reads it next.
export async function decrementRecurrenceOccurrences(recurrenceId: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE recurrence_rules SET occurrences_remaining = occurrences_remaining - 1 WHERE id = ? AND occurrences_remaining IS NOT NULL",
    [recurrenceId]
  );
}

export async function setTaskRecurrenceId(id: number, recurrenceId: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET recurrence_id = ? WHERE id = ?", [recurrenceId, id]);
}

async function nextSortOrder(db: Database, parentId: number | null): Promise<number> {
  const rows = await db.select<any[]>(
    parentId == null
      ? "SELECT MIN(sort_order) AS m FROM tasks WHERE parent_id IS NULL"
      : "SELECT MIN(sort_order) AS m FROM tasks WHERE parent_id = ?",
    parentId == null ? [] : [parentId]
  );
  const min = rows[0]?.m;
  // New tasks land at the top of their sibling group, matching the
  // newest-first ordering tasks have always had by default.
  return (typeof min === "number" ? min : 0) - 1;
}

export async function createTask(
  title: string,
  dueDate?: string,
  parentId?: number,
  recurrenceId?: number,
  priority?: Priority,
  dueTime?: string
): Promise<void> {
  const db = await getDb();
  const sortOrder = await nextSortOrder(db, parentId ?? null);
  await db.execute(
    "INSERT INTO tasks (title, due_date, due_time, parent_id, recurrence_id, priority, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [title, dueDate || null, dueTime || null, parentId ?? null, recurrenceId ?? null, priority ?? null, sortOrder]
  );
}

// Duplicates a task's own fields (title, description, due date/time,
// priority) and its whole subtask subtree, recursively re-parenting each
// duplicated descendant under its sibling's duplicate rather than the
// original tree. Deliberately does NOT copy: completion state (a duplicate
// starts fresh), recurrence (two tasks sharing one recurrence_id would both
// try to spawn "the next instance" on completion), or attachments (those are
// file paths — "duplicating" one would just point two tasks at the same file
// rather than making a real copy). The duplicate keeps the original's
// sort_order so it lands immediately next to it rather than jumping to the
// top of the sibling group.
async function duplicateTaskRecursive(db: Database, sourceId: number, newParentId: number | null): Promise<number> {
  const rows = await db.select<any[]>("SELECT * FROM tasks WHERE id = ?", [sourceId]);
  const row = rows[0];
  const result = await db.execute(
    "INSERT INTO tasks (title, description, due_date, due_time, parent_id, priority, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [row.title, row.description, row.due_date, row.due_time, newParentId, row.priority, row.sort_order]
  );
  const newId = result.lastInsertId as number;

  const tagRows = await db.select<any[]>("SELECT tag_id FROM task_tags WHERE task_id = ?", [sourceId]);
  for (const t of tagRows) {
    await db.execute("INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)", [newId, t.tag_id]);
  }

  const children = await db.select<any[]>("SELECT id FROM tasks WHERE parent_id = ?", [sourceId]);
  for (const child of children) {
    await duplicateTaskRecursive(db, child.id, newId);
  }

  return newId;
}

export async function duplicateTask(id: number): Promise<number> {
  const db = await getDb();
  const rows = await db.select<any[]>("SELECT parent_id FROM tasks WHERE id = ?", [id]);
  const parentId = rows[0]?.parent_id ?? null;
  return duplicateTaskRecursive(db, id, parentId);
}

// Captures a task's own title/priority/tags and its whole subtask subtree as
// a static JSON blueprint (see TemplateNode) — deliberately not a live copy
// like duplicateTask: renaming/retagging/deleting the original task never
// touches a template built from it.
async function buildTemplateNode(db: Database, taskId: number): Promise<TemplateNode> {
  const rows = await db.select<any[]>("SELECT title, priority FROM tasks WHERE id = ?", [taskId]);
  const row = rows[0];
  const tagRows = await db.select<any[]>("SELECT tag_id FROM task_tags WHERE task_id = ?", [taskId]);
  const children = await db.select<any[]>(
    "SELECT id FROM tasks WHERE parent_id = ? ORDER BY sort_order ASC, id ASC",
    [taskId]
  );
  const subtasks: TemplateNode[] = [];
  for (const child of children) {
    subtasks.push(await buildTemplateNode(db, child.id));
  }
  return {
    title: row.title,
    priority: row.priority,
    tagIds: tagRows.map((t) => t.tag_id),
    subtasks,
  };
}

export async function saveTaskAsTemplate(taskId: number, name: string): Promise<number> {
  const db = await getDb();
  const node = await buildTemplateNode(db, taskId);
  const result = await db.execute("INSERT INTO task_templates (name, data) VALUES (?, ?)", [
    name,
    JSON.stringify(node),
  ]);
  return result.lastInsertId as number;
}

export async function getAllTaskTemplates(): Promise<TaskTemplate[]> {
  const db = await getDb();
  const rows = await db.select<any[]>("SELECT * FROM task_templates ORDER BY id");
  return rows.map((row) => ({ id: row.id, name: row.name, data: JSON.parse(row.data) as TemplateNode }));
}

export async function deleteTaskTemplate(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM task_templates WHERE id = ?", [id]);
}

// Stamps out a real task (and its whole subtask subtree) from a template's
// static blueprint. Every node in the tree gets the same due date/time,
// matching the existing convention that a new subtask inherits its parent's
// due date. A tagId the template captured that no longer exists (its tag
// was deleted since) is silently a no-op here — task_tags has no enforced
// foreign key, so it just never resolves to a real tag in any join.
async function instantiateTemplateNode(
  db: Database,
  node: TemplateNode,
  parentId: number | null,
  dueDate: string | null,
  dueTime: string | null
): Promise<number> {
  const sortOrder = await nextSortOrder(db, parentId);
  const result = await db.execute(
    "INSERT INTO tasks (title, due_date, due_time, parent_id, priority, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
    [node.title, dueDate, dueTime, parentId, node.priority, sortOrder]
  );
  const newId = result.lastInsertId as number;
  for (const tagId of node.tagIds) {
    await db.execute("INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)", [newId, tagId]);
  }
  for (const child of node.subtasks) {
    await instantiateTemplateNode(db, child, newId, dueDate, dueTime);
  }
  return newId;
}

export async function createTaskFromTemplate(templateId: number, dueDate?: string, dueTime?: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select<any[]>("SELECT * FROM task_templates WHERE id = ?", [templateId]);
  const row = rows[0];
  if (!row) throw new Error("Template not found");
  const node = JSON.parse(row.data) as TemplateNode;
  return instantiateTemplateNode(db, node, null, dueDate || null, dueTime || null);
}

export async function updateTaskSortOrder(id: number, sortOrder: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET sort_order = ? WHERE id = ?", [sortOrder, id]);
}

export async function updateTaskParent(id: number, parentId: number | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET parent_id = ? WHERE id = ?", [parentId, id]);
}

export async function updateTaskPriority(id: number, priority: Priority | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET priority = ? WHERE id = ?", [priority, id]);
}

export async function updateTaskPinned(id: number, pinned: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET pinned = ? WHERE id = ?", [pinned ? 1 : 0, id]);
}

export async function clearTaskRecurrence(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET recurrence_id = NULL WHERE id = ?", [id]);
}

export async function setTaskCompleted(id: number, completed: boolean, completedAt: string | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET completed = ?, completed_at = ? WHERE id = ?", [
    completed ? 1 : 0,
    completed ? completedAt : null,
    id,
  ]);
}

export async function updateTaskTitle(id: number, title: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET title = ? WHERE id = ?", [title, id]);
}

export async function updateTaskDescription(id: number, description: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET description = ? WHERE id = ?", [description || null, id]);
}

export async function updateTaskDueDate(id: number, dueDate: string, dueTime: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET due_date = ?, due_time = ? WHERE id = ?", [
    dueDate || null,
    dueDate ? dueTime || null : null,
    id,
  ]);
}

export async function addAttachmentToTask(taskId: number, path: string): Promise<void> {
  const db = await getDb();
  await db.execute("INSERT INTO attachments (task_id, path) VALUES (?, ?)", [taskId, path]);
}

export async function removeAttachment(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM attachments WHERE id = ?", [id]);
}

export async function deleteTask(id: number): Promise<void> {
  const db = await getDb();
  const children = await db.select<any[]>("SELECT id FROM tasks WHERE parent_id = ?", [id]);
  for (const child of children) {
    await deleteTask(child.id);
  }
  await db.execute("DELETE FROM task_dependencies WHERE task_id = ? OR depends_on_id = ?", [id, id]);
  await db.execute("DELETE FROM tasks WHERE id = ?", [id]);
}

// Is there a dependency path from `fromId` to `toId` (i.e. does fromId
// depend on toId, directly or transitively)? Used to reject an edge that
// would otherwise create a cycle — two tasks depending on each other,
// directly or through a chain, would leave every task in that chain
// permanently uncompletable.
async function hasDependencyPath(db: Database, fromId: number, toId: number): Promise<boolean> {
  const visited = new Set<number>();
  async function walk(id: number): Promise<boolean> {
    if (id === toId) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    const rows = await db.select<any[]>("SELECT depends_on_id FROM task_dependencies WHERE task_id = ?", [id]);
    for (const row of rows) {
      if (await walk(row.depends_on_id)) return true;
    }
    return false;
  }
  return walk(fromId);
}

export async function addTaskDependency(taskId: number, dependsOnId: number): Promise<void> {
  if (taskId === dependsOnId) {
    throw new Error("A task can't depend on itself.");
  }
  const db = await getDb();
  // Adding taskId -> dependsOnId would create a cycle if dependsOnId already
  // (transitively) depends on taskId.
  if (await hasDependencyPath(db, dependsOnId, taskId)) {
    throw new Error("That would create a circular dependency.");
  }
  await db.execute("INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)", [
    taskId,
    dependsOnId,
  ]);
}

export async function removeTaskDependency(taskId: number, dependsOnId: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?", [taskId, dependsOnId]);
}
