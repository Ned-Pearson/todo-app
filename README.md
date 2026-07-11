## Stack

Tauri + React + TypeScript + SQLite

TODO:

1. Create a toggle for light mode to dark mode display
2. When in calendar view, clicking on a day should set that day to the add task date.
3. When on the today view the add task should be set by default to the current day
4. 

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
