import { useState, useEffect, FocusEvent, KeyboardEvent } from "react";
import type { Priority, Task } from "../types";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "../lib/priority";
import { isOverdue, formatDateDisplay } from "../lib/date";
import { fileNameFromPath } from "../lib/attachments";
import { renderInlineMarkdown } from "../lib/markdown";
import { hexToRgba, DANGER_COLOR } from "../lib/color";
import { formatDuration } from "../lib/duration";
import { REPEAT_LABELS } from "../lib/recurrence";
import { startTaskDragAutoScroll, stopTaskDragAutoScroll } from "../lib/dragAutoScroll";
import TaskActionsMenu from "./TaskActionsMenu";

const OVERDUE_COLOR = DANGER_COLOR;
// Aligns the subtitle line under the title text, past the leading cluster of
// icons (collapse caret, checkbox, blocked/in-progress/priority icons) on
// line 1 — matches the offset the description preview below already uses.
const SUBTITLE_INDENT = 52;

interface Props {
  task: Task;
  depth: number;
  childrenByParent: Map<number, Task[]>;
  priorityFilter: Priority | null;
  // Which list (if any) is currently open — used only to suppress this
  // row's own "belongs to list X" badge when it'd be redundant with the
  // list you're already looking at.
  activeListId?: number | null;
  // Bumping `version` applies `collapsed` to every row (and, via the
  // recursive child render below, every nested row too) — the "Expand all"/
  // "Collapse all" buttons' mechanism. A row's own caret toggle keeps
  // working independently afterward, since this just seeds the same local
  // `collapsed` state rather than replacing it with something lifted up.
  collapseSignal?: { collapsed: boolean; version: number } | null;
  onToggle: (id: number, completed: boolean) => void;
  onDelete: (id: number) => void;
  onSelect: (task: Task) => void;
  onAddSubtask: (parentId: number, title: string) => void;
  readOnly?: boolean;
  showCompletedDate?: boolean;
  showDeletedDate?: boolean;
  deleteLabel?: string;
  onReorder?: (draggedId: number, targetId: number, position: "before" | "after") => void;
  selectable?: boolean;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
  onDuplicate?: (id: number) => void;
  onSkipOccurrence?: (id: number) => void;
  onPostpone?: (id: number) => void;
  onTogglePin?: (id: number) => void;
  onSaveAsTemplate?: (id: number) => void;
  onExportMarkdown?: (id: number) => void;
  onArchive?: (id: number) => void;
  onUnarchive?: (id: number) => void;
  onToggleInProgress?: (id: number) => void;
  onBacklog?: (id: number) => void;
  onUnbacklog?: (id: number) => void;
  onRestore?: (id: number) => void;
  onToggleTimer?: (id: number) => void;
  onResetTimer?: (id: number) => void;
}

export default function TaskRow({
  task,
  depth,
  childrenByParent,
  priorityFilter,
  activeListId = null,
  collapseSignal,
  onToggle,
  onDelete,
  onSelect,
  onAddSubtask,
  readOnly = false,
  showCompletedDate = false,
  showDeletedDate = false,
  deleteLabel = "Delete",
  onReorder,
  selectable = false,
  selectedIds,
  onToggleSelect,
  onDuplicate,
  onSkipOccurrence,
  onPostpone,
  onTogglePin,
  onSaveAsTemplate,
  onExportMarkdown,
  onArchive,
  onUnarchive,
  onToggleInProgress,
  onBacklog,
  onUnbacklog,
  onRestore,
  onToggleTimer,
  onResetTimer,
}: Props) {
  const selected = selectable && (selectedIds?.has(task.id) ?? false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  // Forces a re-render once a second while this row's timer is running, so
  // the elapsed time actually ticks — Date.now() is read fresh each render,
  // not stored, so it stays correct even if a render gets skipped/delayed.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!task.timerStartedAt) return;
    const interval = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [task.timerStartedAt]);
  // Which half of this row the dragged item is currently hovering over —
  // "before" inserts above it (top half), "after" inserts below it (bottom
  // half), so dropping on the bottom half of the last row is the only way
  // to land at the very end of a sibling group (splice-inserting "before" a
  // target can never place something after the last item in the list).
  const [dragOverPosition, setDragOverPosition] = useState<"before" | "after" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Set only when the menu was opened via right-click — anchors it at the
  // cursor instead of the "⋯" button's usual spot. Cleared on every other
  // way of opening it, so a stale cursor position never lingers into the
  // next left-click open.
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const children = childrenByParent.get(task.id) ?? [];
  const hasChildren = children.length > 0;

  // Counts the whole subtree (not just direct children) so a task with
  // nested sub-subtasks still shows accurate overall progress.
  function countSubtreeProgress(id: number): { total: number; completed: number } {
    const kids = childrenByParent.get(id) ?? [];
    let total = 0;
    let completed = 0;
    for (const kid of kids) {
      total += 1;
      if (kid.completed) completed += 1;
      const nested = countSubtreeProgress(kid.id);
      total += nested.total;
      completed += nested.completed;
    }
    return { total, completed };
  }

  const subtreeProgress = hasChildren ? countSubtreeProgress(task.id) : null;
  const blockingDeps = task.dependsOn.filter((d) => !d.completed);
  const blocked = !task.completed && blockingDeps.length > 0;
  // While filtering by priority, a matching task's non-matching subtasks are
  // still shown (so nothing's hidden), but start collapsed so the flagged
  // task itself doesn't get buried under clutter you didn't ask to see.
  const [collapsed, setCollapsed] = useState(
    () => !!priorityFilter && hasChildren && !children.every((c) => c.priority === priorityFilter)
  );
  // Keyed on the signal's version specifically (not its `collapsed` value),
  // so two consecutive "Collapse all" clicks each still re-apply — the value
  // alone wouldn't change between them, so the effect wouldn't re-run.
  useEffect(() => {
    if (collapseSignal && hasChildren) setCollapsed(collapseSignal.collapsed);
    // Deliberately keyed only on version — see comment above. Whenever this
    // does run, it still reads the current collapseSignal/hasChildren from
    // that render's closure, so narrowing the deps doesn't risk stale reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapseSignal?.version]);

  function submitSubtask() {
    const trimmed = subtaskTitle.trim();
    if (!trimmed) return;
    onAddSubtask(task.id, trimmed);
    setSubtaskTitle("");
    setAddingSubtask(false);
  }

  function cancelSubtask() {
    setAddingSubtask(false);
    setSubtaskTitle("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") submitSubtask();
    if (e.key === "Escape") cancelSubtask();
  }

  // Clicking away from the subtask form without typing anything just closes
  // it instead of leaving an empty form hanging around; relatedTarget lets
  // us tell a click on the form's own Add/Cancel buttons apart from a click
  // elsewhere, so those buttons still get their click before we'd close it.
  function handleSubtaskFormBlur(e: FocusEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    if (!subtaskTitle.trim()) cancelSubtask();
  }

  const hasTags = task.tags.length > 0 || task.inheritedTags.length > 0;
  // Redundant (and just visual noise) while already looking at this exact
  // list, so it's suppressed there — still shows for a task from a
  // *different* list appearing as a promoted descendant, or anywhere else
  // (All, Today, Calendar, etc.) the row renders.
  const showListBadge = !!task.list && task.list.id !== activeListId;
  const hasDescription = !!task.description;
  const overdue = isOverdue(task.dueDate, task.dueTime, task.completed);
  const overdueBorder = `3px solid ${overdue ? OVERDUE_COLOR : "transparent"}`;
  // A subtle background wash, not a border/badge — it's a purely personal
  // marker independent of tags/priority, so it shouldn't compete visually
  // with anything that actually carries meaning elsewhere in the row.
  const highlightBg = task.highlightColor ? hexToRgba(task.highlightColor, 0.14) : undefined;
  const hasTimeLogged = task.timeSpentSeconds > 0 || !!task.timerStartedAt;
  // The start/stop control itself is always shown on an incomplete task (so
  // there's something to discover it from before any time's been logged);
  // the read-only badge (no button) still shows on a completed/read-only
  // row purely to display whatever total was already logged.
  const showTimerControl = !task.completed && !!onToggleTimer;
  const liveElapsedSeconds = task.timerStartedAt
    ? task.timeSpentSeconds + Math.floor((Date.now() - Date.parse(task.timerStartedAt)) / 1000)
    : task.timeSpentSeconds;
  const hasSubtitle =
    !!task.dueDate ||
    !!task.reminderAt ||
    (showCompletedDate && !!task.completedAt) ||
    (showDeletedDate && !!task.deletedAt) ||
    !!task.recurrence ||
    task.attachments.length > 0 ||
    hasTags ||
    showListBadge ||
    hasTimeLogged ||
    showTimerControl ||
    task.estimatedMinutes != null;

  return (
    <>
      <div
        onClick={() => (selectable ? onToggleSelect?.(task.id) : onSelect(task))}
        onKeyDown={(e) => {
          // Shift+Enter for "add a subtask" pairs with plain Enter already
          // meaning "open this row" — same key, held differently, for a
          // related-but-distinct action on whichever row currently has
          // keyboard focus (via ↑/↓ row navigation).
          if (e.key === "Enter" && e.shiftKey) {
            e.preventDefault();
            setAddingSubtask(true);
            return;
          }
          if (e.key === "Enter") (selectable ? onToggleSelect?.(task.id) : onSelect(task));
        }}
        tabIndex={0}
        data-task-row
        data-task-id={task.id}
        aria-label={`${task.title}${task.completed ? " (completed)" : ""}`}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenuPos({ x: e.clientX, y: e.clientY });
          setMenuOpen(true);
        }}
        onDragOver={
          onReorder
            ? (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                const rect = e.currentTarget.getBoundingClientRect();
                const isAfter = e.clientY > rect.top + rect.height / 2;
                setDragOverPosition(isAfter ? "after" : "before");
              }
            : undefined
        }
        onDragLeave={onReorder ? () => setDragOverPosition(null) : undefined}
        onDrop={
          onReorder
            ? (e) => {
                e.preventDefault();
                const position = dragOverPosition ?? "before";
                setDragOverPosition(null);
                const draggedId = Number(e.dataTransfer.getData("text/plain"));
                if (!Number.isNaN(draggedId)) onReorder(draggedId, task.id, position);
              }
            : undefined
        }
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          padding: hasDescription ? "10px 14px 4px" : "10px 14px",
          paddingLeft: 14 + depth * 24,
          borderBottom:
            dragOverPosition === "after"
              ? "2px solid var(--color-accent)"
              : hasDescription
                ? "none"
                : "1px solid var(--color-border)",
          borderLeft: overdueBorder,
          borderTop: dragOverPosition === "before" ? "2px solid var(--color-accent)" : "2px solid transparent",
          background: highlightBg,
          cursor: "pointer",
        }}
      >
        {/* Line 1: checkbox/status icons, title, and right-aligned progress/pin/actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {selectable && (
            <input
              type="checkbox"
              checked={selected}
              onClick={(e) => e.stopPropagation()}
              onChange={() => onToggleSelect?.(task.id)}
              style={{
                width: 16,
                height: 16,
                accentColor: "var(--color-accent)",
                flexShrink: 0,
                cursor: "pointer",
              }}
            />
          )}
          {onReorder && (
            <span
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", String(task.id));
                e.dataTransfer.effectAllowed = "move";
                const scrollContainer = document.querySelector<HTMLElement>("[data-main-scroll]");
                if (scrollContainer) startTaskDragAutoScroll(scrollContainer);
              }}
              onDragEnd={stopTaskDragAutoScroll}
              onClick={(e) => e.stopPropagation()}
              title="Drag to reorder"
              // Decorative for screen readers — Alt+↑/↓ on the focused row
              // (see App.tsx's global keydown handler) is the keyboard-
              // operable equivalent of this mouse-only drag handle.
              aria-hidden="true"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 24,
                height: 24,
                margin: "-4px 0",
                cursor: "grab",
                color: "var(--color-text-faint)",
                fontSize: 22,
                flexShrink: 0,
                userSelect: "none",
              }}
            >
              ⠿
            </span>
          )}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCollapsed((v) => !v);
              }}
              title={collapsed ? "Expand subtasks" : "Collapse subtasks"}
              aria-label={collapsed ? "Expand subtasks" : "Collapse subtasks"}
              aria-expanded={!collapsed}
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
            disabled={readOnly || blocked}
            title={blocked ? `Blocked by: ${blockingDeps.map((d) => d.title).join(", ")}` : undefined}
            aria-label={
              blocked
                ? `"${task.title}" is blocked by: ${blockingDeps.map((d) => d.title).join(", ")}`
                : `Mark "${task.title}" complete`
            }
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onToggle(task.id, e.target.checked)}
            style={{
              width: 16,
              height: 16,
              accentColor: "var(--color-accent)",
              flexShrink: 0,
              cursor: readOnly || blocked ? "default" : "pointer",
            }}
          />
          {blocked && (
            <span
              title={`Blocked by: ${blockingDeps.map((d) => d.title).join(", ")}`}
              style={{ fontSize: 12, flexShrink: 0 }}
            >
              🔒
            </span>
          )}
          {!task.completed && onToggleInProgress && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleInProgress(task.id);
              }}
              title={task.inProgress ? "Mark as not started" : "Mark as in progress"}
              aria-label={task.inProgress ? "Mark as not started" : "Mark as in progress"}
              aria-pressed={task.inProgress}
              style={{
                border: "none",
                background: "none",
                color: task.inProgress ? "#3d7dd6" : "var(--color-text-faint)",
                fontSize: 14,
                padding: 0,
                flexShrink: 0,
              }}
            >
              {task.inProgress ? "◐" : "○"}
            </button>
          )}
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
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {task.title}
          </span>
          {subtreeProgress && (
            <span
              title={`${subtreeProgress.completed} of ${subtreeProgress.total} subtasks done`}
              style={{
                fontSize: 12,
                color: "var(--color-text-muted)",
                background: "var(--color-surface-sunken)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                padding: "2px 6px",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {subtreeProgress.completed}/{subtreeProgress.total}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAddingSubtask((v) => !v);
            }}
            title="Add subtask"
            aria-label="Add subtask"
            style={{
              border: "none",
              background: "none",
              color: "var(--color-text-faint)",
              fontSize: 15,
              fontWeight: 600,
              padding: "0 2px",
              flexShrink: 0,
            }}
          >
            +
          </button>
          {onTogglePin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(task.id);
              }}
              title={task.pinned ? "Unpin" : "Pin to shortlist"}
              aria-label={task.pinned ? "Unpin" : "Pin to shortlist"}
              aria-pressed={task.pinned}
              style={{
                border: "none",
                background: "none",
                color: task.pinned ? "#f2994a" : "var(--color-text-faint)",
                fontSize: 14,
                padding: 0,
                flexShrink: 0,
              }}
            >
              {task.pinned ? "★" : "☆"}
            </button>
          )}
          <TaskActionsMenu
            task={task}
            hasTimeLogged={hasTimeLogged}
            deleteLabel={deleteLabel}
            open={menuOpen}
            setOpen={setMenuOpen}
            contextMenuPos={contextMenuPos}
            setContextMenuPos={setContextMenuPos}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onSkipOccurrence={onSkipOccurrence}
            onPostpone={onPostpone}
            onSaveAsTemplate={onSaveAsTemplate}
            onExportMarkdown={onExportMarkdown}
            onArchive={onArchive}
            onUnarchive={onUnarchive}
            onBacklog={onBacklog}
            onUnbacklog={onUnbacklog}
            onRestore={onRestore}
            onResetTimer={onResetTimer}
          />
        </div>

        {/* Line 2: subtitle — due date/reminder/recurrence/attachments/tags */}
        {hasSubtitle && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 6,
              marginLeft: SUBTITLE_INDENT,
            }}
          >
            {task.dueDate && (
              <span
                title={overdue ? "Overdue" : undefined}
                style={{
                  fontSize: 12,
                  fontWeight: overdue ? 700 : 400,
                  color: overdue ? OVERDUE_COLOR : "var(--color-text-muted)",
                  background: overdue ? "rgba(201, 24, 74, 0.12)" : "var(--color-surface-sunken)",
                  border: `1px solid ${overdue ? OVERDUE_COLOR : "var(--color-border)"}`,
                  borderRadius: "var(--radius-sm)",
                  padding: "2px 6px",
                  whiteSpace: "nowrap",
                }}
              >
                {overdue ? "⚠ " : ""}
                {formatDateDisplay(task.dueDate)}
                {task.dueTime ? ` ${task.dueTime}` : ""}
              </span>
            )}
            {(hasTimeLogged || showTimerControl || task.estimatedMinutes != null) && (
              <span
                title={
                  task.estimatedMinutes != null
                    ? `Logged ${formatDuration(liveElapsedSeconds)} of an estimated ${formatDuration(task.estimatedMinutes * 60)}`
                    : undefined
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  color: "var(--color-text-muted)",
                  background: "var(--color-surface-sunken)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "2px 6px",
                  whiteSpace: "nowrap",
                }}
              >
                {showTimerControl && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleTimer?.(task.id);
                    }}
                    title={task.timerStartedAt ? "Stop timer" : "Start timer"}
                    aria-label={task.timerStartedAt ? "Stop timer" : "Start timer"}
                    aria-pressed={!!task.timerStartedAt}
                    style={{
                      border: "none",
                      background: "none",
                      color: task.timerStartedAt ? "#3d7dd6" : "var(--color-text-muted)",
                      padding: 0,
                      fontSize: 12,
                      lineHeight: 1,
                    }}
                  >
                    {task.timerStartedAt ? "⏸" : "▶"}
                  </button>
                )}
                ⏱ {formatDuration(liveElapsedSeconds)}
                {task.estimatedMinutes != null && (
                  <span
                    style={{
                      color:
                        liveElapsedSeconds > task.estimatedMinutes * 60 ? OVERDUE_COLOR : "var(--color-text-faint)",
                    }}
                  >
                    / {formatDuration(task.estimatedMinutes * 60)}
                  </span>
                )}
              </span>
            )}
            {task.reminderAt && (
              <span
                title={
                  task.reminderRepeat
                    ? `Reminder set — repeats ${REPEAT_LABELS[task.reminderRepeat].toLowerCase()}, independent of the due date`
                    : task.reminderNotified
                      ? "Reminder already sent"
                      : "Reminder set — independent of the due date"
                }
                style={{
                  fontSize: 12,
                  color: "var(--color-text-muted)",
                  background: "var(--color-surface-sunken)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "2px 6px",
                  whiteSpace: "nowrap",
                  opacity: !task.reminderRepeat && task.reminderNotified ? 0.55 : 1,
                }}
              >
                🔔 {formatDateDisplay(task.reminderAt)}
                {task.reminderRepeat && " ⟳"}
              </span>
            )}
            {showCompletedDate && task.completedAt && (
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
                Completed {formatDateDisplay(task.completedAt)}
              </span>
            )}
            {showDeletedDate && task.deletedAt && (
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
                Deleted {formatDateDisplay(task.deletedAt)}
              </span>
            )}
            {task.recurrence && (
              <span
                title={`Repeats every ${task.recurrence.interval > 1 ? task.recurrence.interval + " " : ""}${task.recurrence.frequency}${task.recurrence.interval > 1 ? "s" : ""}${task.recurrence.endDate ? ` until ${formatDateDisplay(task.recurrence.endDate)}` : ""}`}
                style={{ fontSize: 13, color: "var(--color-text-faint)" }}
              >
                ⟳
              </span>
            )}
            {task.attachments.length > 0 && (
              <span
                title={task.attachments.map((a) => fileNameFromPath(a.path)).join(", ")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  fontSize: 13,
                  color: "var(--color-text-faint)",
                  flexShrink: 0,
                }}
              >
                📎{task.attachments.length > 1 ? task.attachments.length : ""}
              </span>
            )}
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
            {showListBadge && task.list && (
              <span
                title={`In list: ${task.list.name}`}
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: task.list.color ?? "var(--color-text-muted)",
                  background: task.list.color ? hexToRgba(task.list.color, 0.15) : "var(--color-surface-sunken)",
                  border: `1px solid ${task.list.color ?? "var(--color-border)"}`,
                  borderRadius: "var(--radius-sm)",
                  padding: "2px 6px",
                  whiteSpace: "nowrap",
                }}
              >
                {task.list.icon ?? "📋"} {task.list.name}
              </span>
            )}
          </div>
        )}
      </div>

      {task.description && (
        <div
          onClick={() => onSelect(task)}
          style={{
            padding: "0 14px 10px",
            paddingLeft: 14 + depth * 24 + SUBTITLE_INDENT,
            fontSize: 12,
            color: "var(--color-text-faint)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            borderBottom: "1px solid var(--color-border)",
            borderLeft: overdueBorder,
            background: highlightBg,
            cursor: "pointer",
          }}
        >
          {renderInlineMarkdown(task.description, `desc${task.id}`)}
        </div>
      )}

      {addingSubtask && (
        <div
          onClick={(e) => e.stopPropagation()}
          onBlur={handleSubtaskFormBlur}
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
          <button
            type="button"
            onClick={cancelSubtask}
            title="Cancel"
            aria-label="Cancel adding subtask"
            style={{
              border: "none",
              background: "none",
              color: "var(--color-text-faint)",
              fontSize: 13,
              padding: "6px 4px",
            }}
          >
            ✕
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
            priorityFilter={priorityFilter}
            activeListId={activeListId}
            collapseSignal={collapseSignal}
            onToggle={onToggle}
            onDelete={onDelete}
            onSelect={onSelect}
            onAddSubtask={onAddSubtask}
            readOnly={readOnly}
            showCompletedDate={showCompletedDate}
            onReorder={onReorder}
            selectable={selectable}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            onDuplicate={onDuplicate}
            onSkipOccurrence={onSkipOccurrence}
            onPostpone={onPostpone}
            onTogglePin={onTogglePin}
            onSaveAsTemplate={onSaveAsTemplate}
            onExportMarkdown={onExportMarkdown}
            onArchive={onArchive}
            onUnarchive={onUnarchive}
            onToggleInProgress={onToggleInProgress}
            onBacklog={onBacklog}
            onUnbacklog={onUnbacklog}
            onRestore={onRestore}
            onToggleTimer={onToggleTimer}
            showDeletedDate={showDeletedDate}
            deleteLabel={deleteLabel}
          />
        ))}
    </>
  );
}
