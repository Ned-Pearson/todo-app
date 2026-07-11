CREATE TABLE IF NOT EXISTS tags (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    name    TEXT NOT NULL UNIQUE,
    color   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_tags (
    task_id     INTEGER NOT NULL REFERENCES tasks(id),
    tag_id      INTEGER NOT NULL REFERENCES tags(id),
    PRIMARY KEY (task_id, tag_id)
);
