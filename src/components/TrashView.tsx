import type { Priority, Task } from "../types";
import { buildTaskTree } from "../lib/tree";
import { datePartOf, formatDateDisplay } from "../lib/date";
import { DANGER_COLOR } from "../lib/color";
import { CARD_STYLE } from "../lib/sharedStyles";
import TaskRow from "./TaskRow";

interface Props {
  tasks: Task[];
  priorityFilter: Priority | null;
  onToggle: (id: number, completed: boolean) => void;
  onDeleteForever: (id: number) => void;
  onSelectTask: (task: Task) => void;
  onAddSubtask: (parentId: number, title: string) => void;
  onRestore: (id: number) => void;
  onEmptyTrash: () => void;
  onSetCollapsed?: (id: number, collapsed: boolean) => void;
}

const UNKNOWN_DATE = "Unknown date";

// Trash is a longer-retention safety net *beyond* the 5-second delete-Undo
// toast — deleting a task moves it here instead of hitting the database
// right away, and it sits here (browsable, restorable) until it's older
// than the retention window (purgeExpiredTrash, checked once on startup),
// at which point it's really gone. Deliberately more minimal than Archive:
// no Duplicate/Pin/Save-as-template, since none of those make sense on a
// task that's about to be purged — just enough to look at what it was,
// restore it, or finish the job with "Delete forever".
export default function TrashView({
  tasks,
  priorityFilter,
  onToggle,
  onDeleteForever,
  onSelectTask,
  onAddSubtask,
  onRestore,
  onEmptyTrash,
  onSetCollapsed,
}: Props) {
  const byDate = new Map<string, Task[]>();
  for (const t of tasks) {
    const key = t.deletedAt ? datePartOf(t.deletedAt) : UNKNOWN_DATE;
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
          ...CARD_STYLE,
          padding: 20,
          color: "var(--color-text-faint)",
          fontSize: 13,
        }}
      >
        Trash is empty.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onEmptyTrash}
          title="Permanently delete everything in Trash right now"
          style={{
            padding: "6px 12px",
            border: `1px solid ${DANGER_COLOR}`,
            borderRadius: "var(--radius-sm)",
            background: "none",
            color: DANGER_COLOR,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Empty Trash
        </button>
      </div>
      {dates.map((date) => {
        const { topLevel, childrenByParent } = buildTaskTree(byDate.get(date) ?? []);
        return (
          <div key={date}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 6 }}>
              {formatDateDisplay(date)} ({byDate.get(date)?.length})
            </div>
            <div style={CARD_STYLE}>
              {topLevel.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  depth={0}
                  childrenByParent={childrenByParent}
                  priorityFilter={priorityFilter}
                  onToggle={onToggle}
                  onDelete={onDeleteForever}
                  onSelect={onSelectTask}
                  onAddSubtask={onAddSubtask}
                  onRestore={onRestore}
                  onSetCollapsed={onSetCollapsed}
                  readOnly
                  showDeletedDate
                  deleteLabel="Delete forever"
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
