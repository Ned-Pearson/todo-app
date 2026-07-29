import type { Priority, Task } from "../types";
import { buildTaskTree } from "../lib/tree";
import { datePartOf } from "../lib/date";
import TaskRow from "./TaskRow";

interface Props {
  tasks: Task[];
  priorityFilter: Priority | null;
  onToggle: (id: number, completed: boolean) => void;
  onDelete: (id: number) => void;
  onSelectTask: (task: Task) => void;
  onAddSubtask: (parentId: number, title: string) => void;
  onDuplicate: (id: number) => void;
  onSkipOccurrence: (id: number) => void;
}

const UNKNOWN_DATE = "Unknown date";

export default function HistoryView({
  tasks,
  priorityFilter,
  onToggle,
  onDelete,
  onSelectTask,
  onAddSubtask,
  onDuplicate,
  onSkipOccurrence,
}: Props) {
  const completed = tasks.filter((t) => t.completed);

  const byDate = new Map<string, Task[]>();
  for (const t of completed) {
    const key = t.completedAt ? datePartOf(t.completedAt) : UNKNOWN_DATE;
    const list = byDate.get(key) ?? [];
    list.push(t);
    byDate.set(key, list);
  }

  const dates = [...byDate.keys()]
    .filter((d) => d !== UNKNOWN_DATE)
    .sort((a, b) => (a < b ? 1 : -1)); // most recent first
  if (byDate.has(UNKNOWN_DATE)) dates.push(UNKNOWN_DATE);

  if (dates.length === 0) {
    return (
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-card)",
          padding: 20,
          color: "var(--color-text-faint)",
          fontSize: 13,
        }}
      >
        No completed tasks yet.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {dates.map((date) => {
        const { topLevel, childrenByParent } = buildTaskTree(byDate.get(date) ?? []);
        return (
          <div key={date}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 6 }}>
              {date} ({byDate.get(date)?.length})
            </div>
            <div
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              {topLevel.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  depth={0}
                  childrenByParent={childrenByParent}
                  priorityFilter={priorityFilter}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onSelect={onSelectTask}
                  onAddSubtask={onAddSubtask}
                  onDuplicate={onDuplicate}
                  onSkipOccurrence={onSkipOccurrence}
                  readOnly
                  showCompletedDate
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
