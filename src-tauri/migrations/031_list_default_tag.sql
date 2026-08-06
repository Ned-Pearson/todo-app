-- A tag applied automatically to new tasks added while this list is open,
-- and available to bulk-apply to every task already in the list — separate
-- from the legacy `tag_id` column (which used to mean "this list IS this
-- tag" and is no longer read for anything), since this one has a genuinely
-- new meaning and shouldn't inherit any pre-existing legacy value.
ALTER TABLE custom_tabs ADD COLUMN default_tag_id INTEGER REFERENCES tags(id);
