-- General free-text info about a list (e.g. what it's for, conventions to
-- follow) — independent of any task in it, shown once when browsing the
-- list rather than repeated per task.
ALTER TABLE custom_tabs ADD COLUMN description TEXT;
