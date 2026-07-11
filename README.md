## Stack

Tauri + React + TypeScript + SQLite

TODO:
- No due date and today view should also show subtasks the same way as the all view
- Edit task function (for task name)
    should be within same area as when you add a description, no edit button




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

## Features implemented

- **Descriptions** — each task can have a description, edited from a detail modal opened by clicking the task row; when set, it shows as a single truncated line (with an ellipsis if it overflows) beneath the task.
- **Due dates** — a date picker on the add form; due dates show as a badge on each task row.
- **Today view** — filters tasks due today and shows a completed/total progress bar.
- **No-due-date view** — filters tasks with no due date set.
- **Subtasks** — unlimited nesting via a self-referencing `parent_id`, rendered recursively with inline "+ Subtask" add and cascading delete; a new subtask inherits its parent's due date; ticking a task also ticks all of its subtasks; tasks with subtasks can be collapsed/expanded via a caret toggle.
- **Calendar view** — a month grid grouping tasks by due date, with day navigation and a detail section listing the selected day's tasks; clicking a day also sets that date on the add-task form.
- **Recurring tasks** — daily/weekly/monthly/yearly repeat rules with an optional end date; completing a recurring task generates its next instance automatically.
- **Light/dark mode** — a toggle in the header that persists the choice and falls back to the OS theme preference.
- **Today view defaults** — the add-task form's due date defaults to today whenever the Today view is selected.
