import type { Priority, Task } from "../types";
import { buildTaskTree } from "../lib/tree";
import { datePartOf, formatDateDisplay } from "../lib/date";
import { CARD_STYLE } from "../lib/sharedStyles";
import TaskRow from "./TaskRow";

interface Props {
  tasks: Task[];
  priorityFilter: Priority | null;
  onToggle: (id: number, completed: boolean) => void;
  onDelete: (id: number) => void;
  onSelectTask: (task: Task) => void;
  onAddSubtask: (parentId: number, title: string) => void;
  onDuplicate: (id: number) => void;
  onTogglePin: (id: number) => void;
  onSaveAsTemplate: (id: number) => void;
  onExportMarkdown: (id: number) => void;
  onUnarchive: (id: number) => void;
}

const UNKNOWN_DATE = "Unknown date";

// The archive is old, already-completed tasks moved out of the everyday
// working set (including History) to keep both lean over time — reachable
// only by "Archive" on a completed task, and reversible via "Unarchive"
// here. Grouped by completion day, same as History, since that's still the
// most useful way to browse a pile of old finished tasks.
export default function ArchiveView({
  tasks,
  priorityFilter,
  onToggle,
  onDelete,
  onSelectTask,
  onAddSubtask,
  onDuplicate,
  onTogglePin,
  onSaveAsTemplate,
  onExportMarkdown,
  onUnarchive,
}: Props) {
  const byDate = new Map<string, Task[]>();
  for (const t of tasks) {
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
          ...CARD_STYLE,
          padding: 20,
          color: "var(--color-text-faint)",
          fontSize: 13,
        }}
      >
        Nothing archived yet — "Archive" on a completed task moves it here.
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
                  onDelete={onDelete}
                  onSelect={onSelectTask}
                  onAddSubtask={onAddSubtask}
                  onDuplicate={onDuplicate}
                  onTogglePin={onTogglePin}
                  onSaveAsTemplate={onSaveAsTemplate}
                  onExportMarkdown={onExportMarkdown}
                  onUnarchive={onUnarchive}
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
