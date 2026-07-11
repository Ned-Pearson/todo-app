## Stack

Tauri + React + TypeScript + SQLite

TODO:
- Search — a simple text filter across titles/descriptions, useful once the list grows.
- Sort/reorder — drag-and-drop manual ordering within a list 
- Completed task history/archive view — browse what you finished on past days, maybe with a simple streak or weekly completion count.
- Keyboard shortcuts — e.g. n for new task, Enter to submit, arrow keys to navigate the list — cheap to add, disproportionately nice for a daily-use tool.
- Export/import (JSON or CSV) — since this is local-only with no sync, a manual backup/restore path matters more than usual. Worth prioritizing before you rely on this as your daily driver.
- Undo for delete — a brief "Task deleted, Undo" toast, since cascading delete on a parent with subtasks is currently unforgiving.
- Differentiate between priority addition and filtering buttons

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
- **Attachments/links** — a single URL-or-file-path field per task, edited in the detail modal right below the description. A 📎 icon shows on the task row whenever it's set (tooltip reveals the value); if it looks like an `http(s)://` URL, the icon becomes a real link that opens in the system browser without also opening the task's detail modal.
- **Edit task title** — the same detail modal has the title as an editable field directly (no separate edit button/mode) alongside due date and description.
- **Due dates** — a date picker on the add form; due dates show as a badge on each task row.
- **Today view** — filters tasks due today, shows a completed/total progress bar, and nests matching subtasks under their parent the same way the All view does.
- **Overdue handling** — incomplete tasks whose due date has passed get a distinct visual state everywhere they appear (a red left-border accent down the whole task block, plus a bolded, red-tinted due-date badge with a warning icon), not just a plain badge. The Today view also gets a dedicated "Overdue" section above the day's list, so a missed task doesn't just silently disappear once its due date passes (it wouldn't otherwise show in Today, which only matches `dueDate === today`).
- **This Week view** — filters tasks due within the current Sunday–Saturday week (matching the Calendar view's week layout), shows the same completed/total progress bar as the Today view, and nests matching subtasks the same way the other filtered views do.
- **No-due-date view** — filters tasks with no due date set, nesting matching subtasks under their parent the same way the All view does.
- **Subtasks** — unlimited nesting via a self-referencing `parent_id`, rendered recursively with inline "+ Subtask" add and cascading delete; a new subtask inherits its parent's due date; ticking a task also ticks all of its subtasks; tasks with subtasks can be collapsed/expanded via a caret toggle.
- **Calendar view** — a month grid grouping tasks by due date, with day navigation and a detail section listing the selected day's tasks; clicking a day also sets that date on the add-task form.
- **Recurring tasks** — daily/weekly/monthly/yearly repeat rules with an optional end date; completing a recurring task generates its next instance automatically.
- **Light/dark mode** — a toggle in the header that persists the choice and falls back to the OS theme preference.
- **Today view defaults** — the add-task form's due date defaults to today whenever the Today view is selected.
- **Tags** — user-created, color-coded labels (name + color picker) assigned to tasks from the detail modal; a task can have multiple. New tags default to a random color not already in use (from a curated palette, falling back to fully random once the palette's exhausted) so you don't have to manually pick one unless you want to. An "Edit tags" link next to the tag filter row opens a management modal to rename, recolor, or delete any tag. Tag chips show on their own wrapping row beneath each task (so a task with many tags doesn't push its title, due date, or buttons out of the row), and a tag filter row lets you narrow any view (including Calendar) down to tasks carrying a chosen tag.
- **Tag inheritance** — subtasks are considered tagged with anything any ancestor carries, computed at query time via a recursive CTE (not copied onto the subtask), so untagging a parent instantly stops all descendants from matching that tag. Inherited tag chips render outlined/muted to distinguish them from a task's own direct (filled) tags, and the tag filter still nests a matching subtask under its real parent.
- **Priority levels** — tasks can be set to low/medium/high priority (color-coded pickers on both the add form and detail modal), shown as a small colored flag next to the title. A priority filter row (High/Medium/Low chips) narrows any view down to only tasks flagged with the selected priority plus their full subtree of subtasks — everything else, including unprioritized tasks, is hidden rather than just reordered. A matching task's subtasks start collapsed if they aren't all the same priority, so the flagged task doesn't get buried under non-matching clutter.
