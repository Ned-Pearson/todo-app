-- Starting schema: a flat task list, no subtasks/recurrence/due dates yet.
-- Add those as separate migrations (002_..., 003_...) as you build them out —
-- that keeps a clean history of how the data model grew.

CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    completed   INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
