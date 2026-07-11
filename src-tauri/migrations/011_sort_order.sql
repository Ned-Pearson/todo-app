-- Lower sort_order sorts first. Backfilling with -id preserves the existing
-- newest-first ordering for tasks that predate manual drag-and-drop reorder.
ALTER TABLE tasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
UPDATE tasks SET sort_order = -id;
