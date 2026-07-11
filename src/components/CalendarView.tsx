import { useMemo, useState } from "react";
import type { Task } from "../types";
import { formatDate, todayStr } from "../lib/date";
import TaskRow from "./TaskRow";

interface Props {
  tasks: Task[];
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

export default function CalendarView({ tasks, onToggle, onDelete, onSelectTask, onAddSubtask, onSelectDate }: Props) {
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

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedTasks = tasksByDate.get(selectedDate) ?? [];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          style={{ border: "none", background: "none", color: "var(--color-text-muted)", fontSize: 16, padding: 4 }}
        >
          ‹
        </button>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {MONTH_NAMES[month]} {year}
        </div>
        <button
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          style={{ border: "none", background: "none", color: "var(--color-text-muted)", fontSize: 16, padding: 4 }}
        >
          ›
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 16 }}>
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            style={{ fontSize: 11, color: "var(--color-text-faint)", textAlign: "center", padding: "4px 0" }}
          >
            {w}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;
          const dateStr = formatDate(date);
          const dayTasks = tasksByDate.get(dateStr) ?? [];
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;
          return (
            <button
              key={dateStr}
              onClick={() => selectDate(dateStr)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                padding: "8px 4px",
                border: isSelected ? "1px solid var(--color-accent)" : "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                background: isSelected ? "var(--color-accent-soft)" : "var(--color-surface)",
                color: isToday ? "var(--color-accent)" : "var(--color-text)",
                fontWeight: isToday ? 700 : 400,
                fontSize: 13,
              }}
            >
              {date.getDate()}
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: dayTasks.length > 0 ? "var(--color-accent)" : "transparent",
                }}
              />
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
