import type { Priority, Task } from "../types";
import { buildTaskTree } from "../lib/tree";
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
  onSkipOccurrence: (id: number) => void;
  onPostpone: (id: number) => void;
  onTogglePin: (id: number) => void;
  onSaveAsTemplate: (id: number) => void;
  onExportMarkdown: (id: number) => void;
  onArchive: (id: number) => void;
  onToggleInProgress: (id: number) => void;
  onToggleTimer: (id: number) => void;
  onResetTimer: (id: number) => void;
  onUnbacklog: (id: number) => void;
  onSetCollapsed?: (id: number, collapsed: boolean) => void;
}

// Someday/backlog tasks are hidden from All/Today/This Week so they don't
// clutter the everyday working set, but they're not archived or deleted —
// this is the one place they're still visible and manageable. Unlike
// History/Archive there's no natural date to group by (a backlog task may
// have no due date at all, or one far in the future), so it's a flat list
// like the All view rather than day-sectioned.
export default function BacklogView({
  tasks,
  priorityFilter,
  onToggle,
  onDelete,
  onSelectTask,
  onAddSubtask,
  onDuplicate,
  onSkipOccurrence,
  onPostpone,
  onTogglePin,
  onSaveAsTemplate,
  onExportMarkdown,
  onArchive,
  onToggleInProgress,
  onToggleTimer,
  onResetTimer,
  onUnbacklog,
  onSetCollapsed,
}: Props) {
  const { topLevel, childrenByParent } = buildTaskTree(tasks);

  if (topLevel.length === 0) {
    return (
      <div
        style={{
          ...CARD_STYLE,
          padding: 20,
          color: "var(--color-text-faint)",
          fontSize: 13,
        }}
      >
        Nothing in the backlog — "Backlog" on any task moves it here, out of All/Today/This Week until you're ready for it.
      </div>
    );
  }

  return (
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
          onSkipOccurrence={onSkipOccurrence}
          onPostpone={onPostpone}
          onTogglePin={onTogglePin}
          onSaveAsTemplate={onSaveAsTemplate}
          onExportMarkdown={onExportMarkdown}
          onArchive={onArchive}
          onToggleInProgress={onToggleInProgress}
          onToggleTimer={onToggleTimer}
          onResetTimer={onResetTimer}
          onUnbacklog={onUnbacklog}
          onSetCollapsed={onSetCollapsed}
        />
      ))}
    </div>
  );
}
