## Stack

Tauri + React + TypeScript + SQLite

TODO:

1. **Recurring tasks**:  a `recurrence_rules` table (frequency, interval,
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
