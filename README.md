## Stack

Tauri + React + TypeScript + SQLite

TODO:
1. **Descriptions**: add a `description` column, expand each task row into
   a detail view (modal or side panel) to edit it.
2. **Due dates**: add `due_date` column, a date picker on the add form.
3. **Today view**: filter tasks where `due_date = today`, add a progress
   bar (`completed / total`).
4. **No-due-date view**: filter where `due_date IS NULL`.
5. **Subtasks**:  add a `parent_id` column (self-referencing FK). Subtasks
   are just tasks with a parent — this one column choice gives you
   unlimited nesting without a separate table. Render recursively.
6. **Calendar view**:  group tasks by `due_date`, render a month grid.
7. **Recurring tasks**:  a `recurrence_rules` table (frequency, interval,
   end date) + a `recurrence_id` column on tasks. When a recurring task is
   completed, generate the next instance.



## Project structure

```
todo-app/
├── src/
│   ├── App.tsx          Single-view flat task list
│   ├── main.tsx          Entry point
│   ├── types.ts          Task type
│   ├── index.css          Design tokens
│   └── lib/db.ts          SQLite queries
├── src-tauri/
│   ├── src/main.rs
│   ├── migrations/001_initial.sql
│   ├── capabilities/default.json   Plugin permissions (needed for SQL to work!)
│   └── tauri.conf.json
└── SETUP.md
```
