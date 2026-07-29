CREATE TABLE IF NOT EXISTS saved_views (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    tag_id          INTEGER REFERENCES tags(id),
    priority        TEXT,
    search_query    TEXT
);
