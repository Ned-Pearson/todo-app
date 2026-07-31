import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { Priority, RecurrenceFrequency, Tag, Task } from "../types";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "../lib/priority";
import { fileNameFromPath, isImagePath } from "../lib/attachments";
import { REPEAT_LABELS, type RepeatOption } from "../lib/recurrence";
import { pickUnusedColor } from "../lib/tagColor";
import { renderMarkdown } from "../lib/markdown";

interface Props {
  task: Task;
  allTags: Tag[];
  onClose: () => void;
  onSave: (
    title: string,
    description: string,
    dueDate: string,
    dueTime: string,
    priority: Priority | null,
    recurrence: { frequency: RecurrenceFrequency; interval: number; endDate: string } | null
  ) => Promise<unknown>;
  onToggleTag: (tagId: number, assign: boolean) => void;
  onCreateTag: (name: string, color: string) => void;
  onAddAttachment: (path: string) => void;
  onRemoveAttachment: (attachmentId: number) => void;
}

export default function TaskDetailModal({
  task,
  allTags,
  onClose,
  onSave,
  onToggleTag,
  onCreateTag,
  onAddAttachment,
  onRemoveAttachment,
}: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [dueTime, setDueTime] = useState(task.dueTime ?? "");
  const [priority, setPriority] = useState<Priority | null>(task.priority);
  const [repeat, setRepeat] = useState<RepeatOption>(task.recurrence?.frequency ?? "none");
  const [repeatInterval, setRepeatInterval] = useState(task.recurrence?.interval ?? 1);
  const [repeatEndDate, setRepeatEndDate] = useState(task.recurrence?.endDate ?? "");
  const [saving, setSaving] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(() => pickUnusedColor(allTags.map((t) => t.color)));
  const [previewPath, setPreviewPath] = useState<string | null>(null);

  async function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    setSaving(true);
    try {
      const recurrence = repeat === "none" ? null : { frequency: repeat, interval: repeatInterval, endDate: repeatEndDate };
      await onSave(trimmedTitle, description, dueDate, dueTime, priority, recurrence);
      onClose();
    } finally {
      setSaving(false);
    }
  }

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
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(28, 30, 27, 0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 10,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-card)",
          padding: 20,
        }}
      >
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title…"
          style={{
            width: "100%",
            marginBottom: 12,
            padding: "4px 0",
            border: "none",
            background: "none",
            color: "var(--color-text)",
            fontSize: 16,
            fontWeight: 600,
            fontFamily: "inherit",
          }}
        />

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

          {repeat !== "none" && (
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
            </>
          )}
        </div>

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
