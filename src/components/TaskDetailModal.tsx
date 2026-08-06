import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { CustomTab, Priority, Tag, Task } from "../types";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "../lib/priority";
import { fileNameFromPath, isImagePath } from "../lib/attachments";
import {
  REPEAT_LABELS,
  WEEKDAY_LABELS,
  previewOccurrences,
  type RepeatOption,
  type RecurrenceInput,
} from "../lib/recurrence";
import { pickUnusedColor } from "../lib/tagColor";
import { renderMarkdown } from "../lib/markdown";
import { useClickOutside } from "../lib/useClickOutside";
import { startResize } from "../lib/resize";
import { PANEL_WIDTH_MIN, PANEL_WIDTH_MAX } from "../lib/appConstants";

interface Props {
  task: Task;
  width: number;
  setWidth: (width: number) => void;
  allTags: Tag[];
  allTasks: Task[];
  onClose: () => void;
  onSave: (
    title: string,
    description: string,
    dueDate: string,
    dueTime: string,
    priority: Priority | null,
    recurrence: RecurrenceInput | null,
    reminderAt: string | null,
    highlightColor: string | null
  ) => Promise<unknown>;
  onToggleTag: (tagId: number, assign: boolean) => void;
  onCreateTag: (name: string, color: string) => void;
  onAddAttachment: (path: string) => void;
  onRemoveAttachment: (attachmentId: number) => void;
  onAddDependency: (dependsOnId: number) => void;
  onRemoveDependency: (dependsOnId: number) => void;
  onAddRelatedTask: (relatedTaskId: number) => void;
  onRemoveRelatedTask: (relatedTaskId: number) => void;
  onSelectRelatedTask: (taskId: number) => void;
  customTabs: CustomTab[];
  onChangeList: (listId: number | null) => void;
}

export default function TaskDetailModal({
  task,
  width,
  setWidth,
  allTags,
  allTasks,
  onClose,
  onSave,
  onToggleTag,
  onCreateTag,
  onAddAttachment,
  onRemoveAttachment,
  onAddDependency,
  onRemoveDependency,
  onAddRelatedTask,
  onRemoveRelatedTask,
  onSelectRelatedTask,
  customTabs,
  onChangeList,
}: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [dueTime, setDueTime] = useState(task.dueTime ?? "");
  const [priority, setPriority] = useState<Priority | null>(task.priority);
  const [repeat, setRepeat] = useState<RepeatOption>(task.recurrence?.frequency ?? "none");
  const [repeatInterval, setRepeatInterval] = useState(task.recurrence?.interval ?? 1);
  const [repeatEndDate, setRepeatEndDate] = useState(task.recurrence?.endDate ?? "");
  const [repeatOccurrences, setRepeatOccurrences] = useState(
    task.recurrence?.occurrencesLeft != null ? String(task.recurrence.occurrencesLeft) : ""
  );
  const [repeatWeekdays, setRepeatWeekdays] = useState<number[]>(task.recurrence?.weekdays ?? []);
  const [reminderDate, setReminderDate] = useState(task.reminderAt?.split(" ")[0] ?? "");
  const [reminderTime, setReminderTime] = useState(task.reminderAt?.split(" ")[1] ?? "");
  const [highlightColor, setHighlightColor] = useState(task.highlightColor ?? "");
  const [saving, setSaving] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(() => pickUnusedColor(allTags.map((t) => t.color)));
  const [previewPath, setPreviewPath] = useState<string | null>(null);

  const dependencyCandidates = allTasks.filter(
    (t) => t.id !== task.id && !task.dependsOn.some((d) => d.id === t.id)
  );
  const [selectedDependencyId, setSelectedDependencyId] = useState<number | null>(
    dependencyCandidates[0]?.id ?? null
  );

  // Keep the dropdown's selection valid as the candidate list shrinks (a
  // dependency just added should disappear from the options) or grows.
  useEffect(() => {
    if (selectedDependencyId != null && !dependencyCandidates.some((c) => c.id === selectedDependencyId)) {
      setSelectedDependencyId(dependencyCandidates[0]?.id ?? null);
    }
  }, [task.dependsOn]);

  const relatedCandidates = allTasks.filter(
    (t) => t.id !== task.id && !task.relatedTasks.some((r) => r.id === t.id)
  );
  const [selectedRelatedId, setSelectedRelatedId] = useState<number | null>(relatedCandidates[0]?.id ?? null);

  // Same reasoning as the dependency dropdown above — keep the selection
  // valid as tasks are linked/unlinked.
  useEffect(() => {
    if (selectedRelatedId != null && !relatedCandidates.some((c) => c.id === selectedRelatedId)) {
      setSelectedRelatedId(relatedCandidates[0]?.id ?? null);
    }
  }, [task.relatedTasks]);

  function buildRecurrenceInput(): RecurrenceInput | null {
    return repeat === "none"
      ? null
      : {
          frequency: repeat,
          interval: repeatInterval,
          endDate: repeatEndDate,
          occurrences: repeatOccurrences ? Number(repeatOccurrences) : null,
          weekdays: repeat === "weekly" && repeatWeekdays.length > 0 ? repeatWeekdays : null,
        };
  }

  const recurrenceInput = buildRecurrenceInput();
  const occurrencePreview = recurrenceInput ? previewOccurrences(dueDate, recurrenceInput, 5) : [];

  async function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    setSaving(true);
    try {
      // A reminder date with no time picked defaults to 9am, so a date alone
      // is enough to set one without forcing an extra pick every time.
      const reminderAt = reminderDate ? `${reminderDate} ${reminderTime || "09:00"}` : null;
      await onSave(
        trimmedTitle,
        description,
        dueDate,
        dueTime,
        priority,
        buildRecurrenceInput(),
        reminderAt,
        highlightColor || null
      );
      onClose();
    } finally {
      setSaving(false);
    }
  }

  // Escape (handled globally in App.tsx) discards whatever's been typed and
  // just closes, same as it always has — nothing here is written until Save
  // runs. Clicking outside the panel instead behaves like clicking Save
  // itself: same title-required guard, same batched onSave call, so the two
  // dismissal gestures stay meaningfully different (cancel vs. commit)
  // instead of both silently discarding.
  const panelRef = useRef<HTMLDivElement>(null);
  useClickOutside(panelRef, true, handleSave);

  async function handleBrowseAttachments() {
    const selected = await open({ multiple: true });
    if (!selected) return;
    for (const path of Array.isArray(selected) ? selected : [selected]) {
      onAddAttachment(path);
    }
  }

  async function handleOpenAttachment(path: string) {
    try {
      await openPath(path);
    } catch (err) {
      console.error("Failed to open attachment:", err);
      window.alert(`Couldn't open "${fileNameFromPath(path)}": ${err}`);
    }
  }

  function handleCreateTag() {
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    onCreateTag(trimmed, newTagColor);
    setNewTagName("");
    setNewTagColor(pickUnusedColor([...allTags.map((t) => t.color), newTagColor]));
  }

  return (
    <div
      ref={panelRef}
      className="detail-panel"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width,
        background: "var(--color-surface)",
        borderLeft: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-card)",
        padding: 20,
        overflowY: "auto",
        zIndex: 10,
      }}
    >
      <div
        onMouseDown={(e) => startResize(e, width, setWidth, { min: PANEL_WIDTH_MIN, max: PANEL_WIDTH_MAX, direction: "grow-left" })}
        title="Drag to resize"
        style={{
          position: "absolute",
          top: 0,
          left: -3,
          bottom: 0,
          width: 6,
          cursor: "col-resize",
          zIndex: 5,
        }}
      />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title…"
          style={{
            flex: 1,
            padding: "4px 0",
            border: "none",
            background: "none",
            color: "var(--color-text)",
            fontSize: 16,
            fontWeight: 600,
            fontFamily: "inherit",
          }}
        />
        <button
          type="button"
          onClick={onClose}
          title="Close"
          style={{
            border: "none",
            background: "none",
            color: "var(--color-text-faint)",
            fontSize: 16,
            padding: 4,
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>

        <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
          Due date
        </label>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={{
              padding: "8px 10px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-surface)",
              color: "var(--color-text)",
              fontSize: 14,
            }}
          />
          <input
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
            disabled={!dueDate}
            title={!dueDate ? "Set a due date first" : undefined}
            style={{
              padding: "8px 10px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-surface)",
              color: "var(--color-text)",
              fontSize: 14,
              opacity: dueDate ? 1 : 0.5,
            }}
          />
        </div>

        <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
          Reminder
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
          <input
            type="date"
            value={reminderDate}
            onChange={(e) => setReminderDate(e.target.value)}
            style={{
              padding: "8px 10px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-surface)",
              color: "var(--color-text)",
              fontSize: 14,
            }}
          />
          <input
            type="time"
            value={reminderTime}
            onChange={(e) => setReminderTime(e.target.value)}
            disabled={!reminderDate}
            title={!reminderDate ? "Set a reminder date first" : undefined}
            style={{
              padding: "8px 10px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-surface)",
              color: "var(--color-text)",
              fontSize: 14,
              opacity: reminderDate ? 1 : 0.5,
            }}
          />
          {reminderDate && (
            <button
              type="button"
              onClick={() => {
                setReminderDate("");
                setReminderTime("");
              }}
              title="Clear reminder"
              style={{ border: "none", background: "none", color: "var(--color-text-faint)", fontSize: 12 }}
            >
              ✕
            </button>
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--color-text-faint)", marginBottom: 16 }}>
          A plain time-based nudge — independent of the due date above, and doesn't mark the task as "due".
        </div>

        <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
          Repeat
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 16 }}>
          <select
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as RepeatOption)}
            style={{
              padding: "6px 8px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-surface)",
              color: "var(--color-text)",
              fontSize: 13,
            }}
          >
            {(Object.keys(REPEAT_LABELS) as RepeatOption[]).map((option) => (
              <option key={option} value={option}>
                {REPEAT_LABELS[option]}
              </option>
            ))}
          </select>

          {repeat !== "none" && !(repeat === "weekly" && repeatWeekdays.length > 0) && (
            <>
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>every</span>
              <input
                type="number"
                min={1}
                value={repeatInterval}
                onChange={(e) => setRepeatInterval(Math.max(1, Number(e.target.value)))}
                style={{
                  width: 50,
                  padding: "6px 8px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface)",
                  color: "var(--color-text)",
                  fontSize: 13,
                }}
              />
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                {repeat === "daily" && "day(s)"}
                {repeat === "weekly" && "week(s)"}
                {repeat === "monthly" && "month(s)"}
                {repeat === "yearly" && "year(s)"}
              </span>
            </>
          )}
          {repeat !== "none" && (
            <>
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>until</span>
              <input
                type="date"
                value={repeatEndDate}
                onChange={(e) => setRepeatEndDate(e.target.value)}
                style={{
                  padding: "6px 8px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface)",
                  color: "var(--color-text)",
                  fontSize: 13,
                }}
              />
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>or after</span>
              <input
                type="number"
                min={1}
                value={repeatOccurrences}
                onChange={(e) => setRepeatOccurrences(e.target.value)}
                placeholder="∞"
                title="Stop after this many occurrences from now (optional)"
                style={{
                  width: 50,
                  padding: "6px 8px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface)",
                  color: "var(--color-text)",
                  fontSize: 13,
                }}
              />
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>time(s)</span>
            </>
          )}
        </div>

        {repeat === "weekly" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: "var(--color-text-muted)", marginRight: 4 }}>On:</span>
            {WEEKDAY_LABELS.map((label, day) => {
              const selected = repeatWeekdays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() =>
                    setRepeatWeekdays((prev) =>
                      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
                    )
                  }
                  title={selected ? `Don't repeat on ${label}` : `Also repeat on ${label}`}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    padding: "4px 8px",
                    borderRadius: "var(--radius-sm)",
                    border: selected ? "1px solid transparent" : "1px solid var(--color-border)",
                    background: selected ? "var(--color-accent)" : "none",
                    color: selected ? "#fff" : "var(--color-text-muted)",
                  }}
                >
                  {label}
                </button>
              );
            })}
            {repeatWeekdays.length === 0 && (
              <span style={{ fontSize: 11, color: "var(--color-text-faint)" }}>
                (none selected — uses "every N week(s)" above instead)
              </span>
            )}
          </div>
        )}

        {repeat !== "none" && (
          <div style={{ marginBottom: 16 }}>
            {!dueDate ? (
              <div style={{ fontSize: 11, color: "var(--color-text-faint)" }}>
                Pick a due date above to preview upcoming occurrences.
              </div>
            ) : occurrencePreview.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: "var(--color-text-faint)" }}>Next:</span>
                {occurrencePreview.map((d) => (
                  <span
                    key={d}
                    style={{
                      fontSize: 11,
                      color: "var(--color-text-muted)",
                      background: "var(--color-surface-sunken)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-sm)",
                      padding: "2px 6px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {d}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "var(--color-text-faint)" }}>
                No further occurrences — this would be the only one.
              </div>
            )}
          </div>
        )}

        <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
          Priority
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {(["high", "medium", "low"] as Priority[]).map((level) => {
            const selected = priority === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => setPriority(selected ? null : level)}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: "4px 8px",
                  borderRadius: "var(--radius-sm)",
                  border: selected ? "1px solid transparent" : `1px solid ${PRIORITY_COLORS[level]}`,
                  background: selected ? PRIORITY_COLORS[level] : "none",
                  color: selected ? "#fff" : PRIORITY_COLORS[level],
                }}
              >
                {PRIORITY_LABELS[level]}
              </button>
            );
          })}
        </div>

        <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
          Highlight color
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
          <input
            type="color"
            value={highlightColor || "#f2d95c"}
            onChange={(e) => setHighlightColor(e.target.value)}
            title="Row highlight color"
            style={{
              width: 36,
              height: 28,
              padding: 0,
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "none",
            }}
          />
          {highlightColor && (
            <button
              type="button"
              onClick={() => setHighlightColor("")}
              title="Clear highlight"
              style={{ border: "none", background: "none", color: "var(--color-text-faint)", fontSize: 12 }}
            >
              ✕
            </button>
          )}
          <span style={{ fontSize: 11, color: "var(--color-text-faint)" }}>
            A personal marker for this row — independent of tags/priority.
          </span>
        </div>

        <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
          Depends on
        </label>
        {task.dependsOn.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
            {task.dependsOn.map((dep) => (
              <div
                key={dep.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 8px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface-sunken)",
                }}
              >
                <span style={{ fontSize: 13 }}>{dep.completed ? "✅" : "⏳"}</span>
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    textDecoration: dep.completed ? "line-through" : "none",
                    color: dep.completed ? "var(--color-text-faint)" : "var(--color-text)",
                  }}
                >
                  {dep.title}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveDependency(dep.id)}
                  title="Remove this dependency"
                  style={{ border: "none", background: "none", color: "var(--color-text-faint)", fontSize: 12 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        {dependencyCandidates.length > 0 ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 16 }}>
            <select
              value={selectedDependencyId ?? ""}
              onChange={(e) => setSelectedDependencyId(Number(e.target.value))}
              style={{
                flex: 1,
                padding: "6px 8px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
                fontSize: 13,
              }}
            >
              {dependencyCandidates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => selectedDependencyId != null && onAddDependency(selectedDependencyId)}
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
        ) : (
          task.dependsOn.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--color-text-faint)", marginBottom: 16 }}>
              No other tasks to depend on yet.
            </div>
          )
        )}

        <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
          See also
        </label>
        {task.relatedTasks.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
            {task.relatedTasks.map((rel) => (
              <div
                key={rel.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 8px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface-sunken)",
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelectRelatedTask(rel.id)}
                  title="Open this task"
                  style={{
                    flex: 1,
                    textAlign: "left",
                    border: "none",
                    background: "none",
                    padding: 0,
                    fontSize: 13,
                    textDecoration: rel.completed ? "line-through" : "underline",
                    color: rel.completed ? "var(--color-text-faint)" : "var(--color-text)",
                    cursor: "pointer",
                  }}
                >
                  {rel.title}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveRelatedTask(rel.id)}
                  title="Remove this link"
                  style={{ border: "none", background: "none", color: "var(--color-text-faint)", fontSize: 12 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        {relatedCandidates.length > 0 ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 16 }}>
            <select
              value={selectedRelatedId ?? ""}
              onChange={(e) => setSelectedRelatedId(Number(e.target.value))}
              style={{
                flex: 1,
                padding: "6px 8px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
                fontSize: 13,
              }}
            >
              {relatedCandidates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => selectedRelatedId != null && onAddRelatedTask(selectedRelatedId)}
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
        ) : (
          task.relatedTasks.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--color-text-faint)", marginBottom: 16 }}>
              No other tasks to link yet.
            </div>
          )
        )}

        <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
          List
        </label>
        <select
          value={task.listId ?? ""}
          onChange={(e) => onChangeList(e.target.value === "" ? null : Number(e.target.value))}
          style={{
            width: "100%",
            padding: "6px 8px",
            marginBottom: 16,
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontSize: 13,
          }}
        >
          <option value="">No list</option>
          {customTabs.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.name}
            </option>
          ))}
        </select>

        <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
          Tags
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {allTags.map((tag) => {
            const assigned = task.tags.some((t) => t.id === tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => onToggleTag(tag.id, !assigned)}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: "4px 8px",
                  borderRadius: "var(--radius-sm)",
                  border: assigned ? "1px solid transparent" : `1px solid ${tag.color}`,
                  background: assigned ? tag.color : "none",
                  color: assigned ? "#fff" : tag.color,
                }}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
        {task.inheritedTags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "var(--color-text-faint)" }}>Inherited:</span>
            {task.inheritedTags.map((tag) => (
              <span
                key={tag.id}
                title="Inherited from a parent task — untag the parent to remove it"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: "4px 8px",
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${tag.color}`,
                  color: tag.color,
                  opacity: 0.75,
                }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 16 }}>
          <input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
            placeholder="New tag…"
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
          <input
            type="color"
            value={newTagColor}
            onChange={(e) => setNewTagColor(e.target.value)}
            style={{
              width: 32,
              height: 28,
              padding: 0,
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "none",
            }}
          />
          <button
            type="button"
            onClick={handleCreateTag}
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

        <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 2 }}>
          Description
        </label>
        <div style={{ fontSize: 11, color: "var(--color-text-faint)", marginBottom: 6 }}>
          Supports **bold**, *italic*, `code`, [links](url), and - lists
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          placeholder="Add a description…"
          style={{
            width: "100%",
            marginBottom: 8,
            padding: "8px 10px",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontSize: 14,
            resize: "vertical",
          }}
        />
        {description.trim() && (
          <div
            style={{
              marginBottom: 16,
              padding: "8px 10px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-surface-sunken)",
              fontSize: 13,
              color: "var(--color-text)",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--color-text-faint)", marginBottom: 4 }}>Preview</div>
            {renderMarkdown(description)}
          </div>
        )}

        <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
          Attachments
        </label>
        {task.attachments.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            {task.attachments.map((a) =>
              isImagePath(a.path) ? (
                <div key={a.id} style={{ position: "relative" }}>
                  <img
                    src={convertFileSrc(a.path)}
                    alt={fileNameFromPath(a.path)}
                    title={a.path}
                    onClick={() => setPreviewPath(a.path)}
                    style={{
                      width: 72,
                      height: 72,
                      objectFit: "cover",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--color-border)",
                      cursor: "pointer",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(a.id)}
                    title="Remove"
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      width: 18,
                      height: 18,
                      lineHeight: "16px",
                      padding: 0,
                      border: "1px solid var(--color-border)",
                      borderRadius: "50%",
                      background: "var(--color-surface)",
                      color: "var(--color-text-muted)",
                      fontSize: 11,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 8px",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--color-surface-sunken)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleOpenAttachment(a.path)}
                    title={a.path}
                    style={{
                      border: "none",
                      background: "none",
                      color: "var(--color-accent)",
                      fontSize: 13,
                      textDecoration: "underline",
                      maxWidth: 160,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    📎 {fileNameFromPath(a.path)}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(a.id)}
                    title="Remove"
                    style={{ border: "none", background: "none", color: "var(--color-text-faint)", fontSize: 12 }}
                  >
                    ✕
                  </button>
                </div>
              )
            )}
          </div>
        )}
        <button
          type="button"
          onClick={handleBrowseAttachments}
          style={{
            padding: "6px 12px",
            marginBottom: 16,
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            background: "none",
            color: "var(--color-text)",
            fontSize: 13,
          }}
        >
          Add attachment…
        </button>

        <div style={{ fontSize: 11, color: "var(--color-text-faint)", marginBottom: 16 }}>
          Created on {task.createdAt}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 14px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "none",
              color: "var(--color-text)",
              fontSize: 14,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "8px 14px",
              border: "none",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-accent)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 500,
              opacity: saving ? 0.7 : 1,
            }}
          >
            Save
          </button>
        </div>

      {previewPath && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setPreviewPath(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 40,
            zIndex: 20,
            cursor: "zoom-out",
          }}
        >
          <img
            src={convertFileSrc(previewPath)}
            alt={fileNameFromPath(previewPath)}
            style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: "var(--radius-md)" }}
          />
        </div>
      )}
    </div>
  );
}
