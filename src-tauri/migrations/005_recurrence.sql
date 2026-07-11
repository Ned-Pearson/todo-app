CREATE TABLE IF NOT EXISTS recurrence_rules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    frequency   TEXT NOT NULL,
    interval    INTEGER NOT NULL DEFAULT 1,
    end_date    TEXT
);

ALTER TABLE tasks ADD COLUMN recurrence_id INTEGER REFERENCES recurrence_rules(id);
