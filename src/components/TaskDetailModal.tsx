import { useState } from "react";
import type { Tag, Task } from "../types";

interface Props {
  task: Task;
  allTags: Tag[];
  onClose: () => void;
  onSave: (title: string, description: string, dueDate: string) => Promise<unknown>;
  onToggleTag: (tagId: number, assign: boolean) => void;
  onCreateTag: (name: string, color: string) => void;
}

const TAG_COLOR_PALETTE = [
  "#e07a5f",
  "#3d5a80",
  "#81b29a",
  "#f2cc8f",
  "#9d4edd",
  "#588157",
  "#c9184a",
  "#277da1",
  "#f3722c",
  "#43aa8b",
  "#ff6392",
  "#6d597a",
];

function pickUnusedColor(usedColors: string[]): string {
  const used = new Set(usedColors.map((c) => c.toLowerCase()));
  const available = TAG_COLOR_PALETTE.filter((c) => !used.has(c.toLowerCase()));
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)];
  }
  return `#${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0")}`;
}

export default function TaskDetailModal({ task, allTags, onClose, onSave, onToggleTag, onCreateTag }: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [saving, setSaving] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(() => pickUnusedColor(allTags.map((t) => t.color)));

  async function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    setSaving(true);
    try {
      await onSave(trimmedTitle, description, dueDate);
      onClose();
    } finally {
      setSaving(false);
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
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          style={{
            padding: "8px 10px",
            marginBottom: 16,
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontSize: 14,
          }}
        />

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

        <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          placeholder="Add a description…"
          style={{
            width: "100%",
            padding: "8px 10px",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontSize: 14,
            resize: "vertical",
          }}
        />

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
    </div>
  );
}
