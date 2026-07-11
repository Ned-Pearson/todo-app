import { useState, KeyboardEvent } from "react";
import type { Task } from "../types";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "../lib/priority";

interface Props {
  task: Task;
  depth: number;
  childrenByParent: Map<number, Task[]>;
  onToggle: (id: number, completed: boolean) => void;
  onDelete: (id: number) => void;
  onSelect: (task: Task) => void;
  onAddSubtask: (parentId: number, title: string) => void;
}

export default function TaskRow({ task, depth, childrenByParent, onToggle, onDelete, onSelect, onAddSubtask }: Props) {
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const children = childrenByParent.get(task.id) ?? [];
  const hasChildren = children.length > 0;

  function submitSubtask() {
    const trimmed = subtaskTitle.trim();
    if (!trimmed) return;
    onAddSubtask(task.id, trimmed);
    setSubtaskTitle("");
    setAddingSubtask(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") submitSubtask();
    if (e.key === "Escape") {
      setAddingSubtask(false);
      setSubtaskTitle("");
    }
  }

  const hasTags = task.tags.length > 0 || task.inheritedTags.length > 0;
  const hasDescription = !!task.description;
  const mainRowIsLast = !hasTags && !hasDescription;
  const tagsRowIsLast = hasTags && !hasDescription;

  return (
    <>
      <div
        onClick={() => onSelect(task)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: mainRowIsLast ? "10px 14px" : "10px 14px 4px",
          paddingLeft: 14 + depth * 24,
          borderBottom: mainRowIsLast ? "1px solid var(--color-border)" : "none",
          cursor: "pointer",
        }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed((v) => !v);
            }}
            title={collapsed ? "Expand subtasks" : "Collapse subtasks"}
            style={{
              width: 16,
              height: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              background: "none",
              color: "var(--color-text-faint)",
              fontSize: 10,
              padding: 0,
              flexShrink: 0,
            }}
          >
            {collapsed ? "▸" : "▾"}
          </button>
        ) : (
          <span style={{ width: 16, flexShrink: 0 }} />
        )}
        <input
          type="checkbox"
          checked={task.completed}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onToggle(task.id, e.target.checked)}
          style={{ width: 16, height: 16, accentColor: "var(--color-accent)", flexShrink: 0 }}
        />
        {task.priority && (
          <span
            title={`${PRIORITY_LABELS[task.priority]} priority`}
            style={{ fontSize: 13, color: PRIORITY_COLORS[task.priority], flexShrink: 0 }}
          >
            ⚑
          </span>
        )}
        <span
          style={{
            flex: 1,
            textDecoration: task.completed ? "line-through" : "none",
            color: task.completed ? "var(--color-text-faint)" : "var(--color-text)",
          }}
        >
          {task.title}
        </span>
        {task.dueDate && (
          <span
            style={{
              fontSize: 12,
              color: "var(--color-text-muted)",
              background: "var(--color-surface-sunken)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              padding: "2px 6px",
              whiteSpace: "nowrap",
            }}
          >
            {task.dueDate}
          </span>
        )}
        {task.recurrence && (
          <span
            title={`Repeats every ${task.recurrence.interval > 1 ? task.recurrence.interval + " " : ""}${task.recurrence.frequency}${task.recurrence.interval > 1 ? "s" : ""}${task.recurrence.endDate ? ` until ${task.recurrence.endDate}` : ""}`}
            style={{ fontSize: 13, color: "var(--color-text-faint)" }}
          >
            ⟳
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setAddingSubtask((v) => !v);
          }}
          title="Add subtask"
          style={{ border: "none", background: "none", color: "var(--color-text-faint)", fontSize: 13 }}
        >
          + Subtask
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          style={{ border: "none", background: "none", color: "var(--color-text-faint)", fontSize: 13 }}
        >
          Delete
        </button>
      </div>

      {hasTags && (
        <div
          onClick={() => onSelect(task)}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            padding: tagsRowIsLast ? "0 14px 10px" : "0 14px 6px",
            paddingLeft: 14 + depth * 24 + 52,
            borderBottom: tagsRowIsLast ? "1px solid var(--color-border)" : "none",
            cursor: "pointer",
          }}
        >
          {task.tags.map((tag) => (
            <span
              key={tag.id}
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "#fff",
                background: tag.color,
                borderRadius: "var(--radius-sm)",
                padding: "2px 6px",
                whiteSpace: "nowrap",
              }}
            >
              {tag.name}
            </span>
          ))}
          {task.inheritedTags.map((tag) => (
            <span
              key={tag.id}
              title="Inherited from a parent task"
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: tag.color,
                background: "none",
                border: `1px solid ${tag.color}`,
                borderRadius: "var(--radius-sm)",
                padding: "2px 6px",
                whiteSpace: "nowrap",
                opacity: 0.75,
              }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {task.description && (
        <div
          onClick={() => onSelect(task)}
          style={{
            padding: "0 14px 10px",
            paddingLeft: 14 + depth * 24 + 52,
            fontSize: 12,
            color: "var(--color-text-faint)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            borderBottom: "1px solid var(--color-border)",
            cursor: "pointer",
          }}
        >
          {task.description}
        </div>
      )}

      {addingSubtask && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "flex",
            gap: 8,
            padding: "8px 14px",
            paddingLeft: 14 + (depth + 1) * 24,
            borderBottom: "1px solid var(--color-border)",
            background: "var(--color-surface-sunken)",
          }}
        >
          <input
            autoFocus
            value={subtaskTitle}
            onChange={(e) => setSubtaskTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Subtask title…"
            style={{
              flex: 1,
              padding: "6px 8px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-surface)",
              color: "var(--color-text)",
              fontSize: 13,
            }}
          />
          <button
            onClick={submitSubtask}
            style={{
              padding: "6px 10px",
              border: "none",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-accent)",
              color: "#fff",
              fontSize: 13,
            }}
          >
            Add
          </button>
        </div>
      )}

      {!collapsed &&
        children.map((child) => (
          <TaskRow
            key={child.id}
            task={child}
            depth={depth + 1}
            childrenByParent={childrenByParent}
            onToggle={onToggle}
            onDelete={onDelete}
            onSelect={onSelect}
            onAddSubtask={onAddSubtask}
          />
        ))}
    </>
  );
}
