CREATE TABLE IF NOT EXISTS custom_tabs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    tag_id      INTEGER NOT NULL REFERENCES tags(id),
    sort_order  INTEGER NOT NULL DEFAULT 0
);
