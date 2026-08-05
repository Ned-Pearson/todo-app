-- custom_tabs.tag_id is no longer required — a list ("Lists" in the sidebar)
-- is now its own independent grouping, not just a shortcut for "filter by
-- this tag". SQLite has no ALTER COLUMN, so dropping the NOT NULL constraint
-- means rebuilding the table: create the new shape, copy the existing rows
-- across untouched, drop the old table, then rename the new one into place.
CREATE TABLE custom_tabs_new (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    tag_id      INTEGER REFERENCES tags(id),
    sort_order  INTEGER NOT NULL DEFAULT 0,
    color       TEXT
);

INSERT INTO custom_tabs_new (id, name, tag_id, sort_order, color)
SELECT id, name, tag_id, sort_order, color FROM custom_tabs;

DROP TABLE custom_tabs;

ALTER TABLE custom_tabs_new RENAME TO custom_tabs;

-- Which list (if any) a task belongs to — independent of tags entirely, so a
-- task can be in a list without needing any tag at all.
ALTER TABLE tasks ADD COLUMN list_id INTEGER REFERENCES custom_tabs(id);
