CREATE TABLE IF NOT EXISTS attachments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     INTEGER NOT NULL REFERENCES tasks(id),
    path        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Carry over the old single-attachment field into the new one-to-many table,
-- then drop it now that tasks can have multiple attachments.
INSERT INTO attachments (task_id, path)
SELECT id, attachment FROM tasks WHERE attachment IS NOT NULL;

ALTER TABLE tasks DROP COLUMN attachment;
