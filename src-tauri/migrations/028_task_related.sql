CREATE TABLE task_related (
  task_id INTEGER NOT NULL,
  related_task_id INTEGER NOT NULL,
  PRIMARY KEY (task_id, related_task_id)
);
