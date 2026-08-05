ALTER TABLE tasks ADD COLUMN time_spent_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN timer_started_at TEXT;
