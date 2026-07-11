import { useMemo, useState } from "react";
import type { Priority, Task } from "../types";
import { formatDate, todayStr } from "../lib/date";
import { PRIORITY_COLORS } from "../lib/priority";
import TaskRow from "./TaskRow";

interface Props {
  tasks: Task[];
  priorityFilter: Priority | null;
  onToggle: (id: number, completed: boolean) => void;
  onDelete: (id: number) => void;
  onSelectTask: (task: Task) => void;
  onAddSubtask: (parentId: number, title: string) => void;
  onSelectDate: (date: string) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MAX_VISIBLE_STRIPS = 4;

function stripColor(task: Task): string {
  const tag = task.tags[0] ?? task.inheritedTags[0];
  if (tag) return tag.color;
  if (task.priority) return PRIORITY_COLORS[task.priority];
  return "var(--color-text-faint)";
}

export default function CalendarView({
  tasks,
  priorityFilter,
  onToggle,
  onDelete,
  onSelectTask,
  onAddSubtask,
  onSelectDate,
}: Props) {
  const today = todayStr();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(today);

  function selectDate(dateStr: string) {
    setSelectedDate(dateStr);
    onSelectDate(dateStr);
  }

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const list = map.get(t.dueDate) ?? [];
      list.push(t);
      map.set(t.dueDate, list);
    }
    return map;
  }, [tasks]);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  // A subtask due the same day as its parent is already represented by the
  // parent's strip, so it's left out of the grid cell (it still shows up in
  // the day-detail section below in full).
  function stripTasksFor(dateStr: string): Task[] {
    const dayTasks = tasksByDate.get(dateStr) ?? [];
    return dayTasks.filter((t) => {
      if (t.parentId == null) return true;
      const parent = taskById.get(t.parentId);
      return !(parent && parent.dueDate === dateStr);
    });
  }

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  // Fill out to full weeks (Sun-Sat) so leading/trailing days from adjacent
  // months are visible with their real day numbers, not blank cells.
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
  const gridEnd = new Date(year, month, lastOfMonth.getDate() + (6 - lastOfMonth.getDay()));

  const cells: Date[] = [];
  for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
    cells.push(new Date(d));
  }

  const selectedTasks = tasksByDate.get(selectedDate) ?? [];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          style={{ border: "none", background: "none", color: "var(--color-text-muted)", fontSize: 20, padding: 4 }}
        >
          ‹
        </button>
        <div style={{ fontSize: 18, fontWeight: 600 }}>
          {MONTH_NAMES[month]} {year}
        </div>
        <button
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          style={{ border: "none", background: "none", color: "var(--color-text-muted)", fontSize: 20, padding: 4 }}
        >
          ›
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 20 }}>
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-faint)", textAlign: "center", padding: "4px 0" }}
          >
            {w}
          </div>
        ))}
        {cells.map((date) => {
          const dateStr = formatDate(date);
          const isCurrentMonth = date.getMonth() === month;
          const stripTasks = stripTasksFor(dateStr);
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;
          const visibleStrips = stripTasks.slice(0, MAX_VISIBLE_STRIPS);
          const overflowCount = stripTasks.length - visibleStrips.length;

          return (
            <button
              key={dateStr}
              onClick={() => selectDate(dateStr)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                gap: 3,
                minHeight: 110,
                padding: "6px 5px",
                border: isSelected ? "2px solid var(--color-accent)" : "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                background: isSelected ? "var(--color-accent-soft)" : "var(--color-surface)",
                opacity: isCurrentMonth ? 1 : 0.45,
                overflow: "hidden",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: isToday ? 700 : 400,
                  color: isToday ? "var(--color-accent)" : "var(--color-text)",
                  marginBottom: 2,
                }}
              >
                {date.getDate()}
              </span>
              {visibleStrips.map((task) => (
                <div
                  key={task.id}
                  title={task.title}
                  style={{
                    fontSize: 11,
                    padding: "2px 5px",
                    borderRadius: 3,
                    background: stripColor(task),
                    color: "#fff",
                    textDecoration: task.completed ? "line-through" : "none",
                    opacity: task.completed ? 0.55 : 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {task.title}
                </div>
              ))}
              {overflowCount > 0 && (
                <div style={{ fontSize: 11, color: "var(--color-text-faint)", padding: "0 5px" }}>
                  +{overflowCount} more
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--color-border)",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-text-muted)",
          }}
        >
          {selectedDate}
        </div>
        {selectedTasks.length === 0 && (
          <div style={{ padding: 20, color: "var(--color-text-faint)", fontSize: 13 }}>No tasks due this day.</div>
        )}
        {selectedTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            depth={0}
            childrenByParent={new Map()}
            priorityFilter={priorityFilter}
            onToggle={onToggle}
            onDelete={onDelete}
            onSelect={onSelectTask}
            onAddSubtask={onAddSubtask}
          />
        ))}
      </div>
    </div>
  );
}
