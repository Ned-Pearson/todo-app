import { useState } from "react";
import type { Task } from "../types";

interface Props {
  task: Task;
  onClose: () => void;
  onSave: (description: string, dueDate: string) => Promise<unknown>;
}

export default function TaskDetailModal({ task, onClose, onSave }: Props) {
  const [description, setDescription] = useState(task.description ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(description, dueDate);
      onClose();
    } finally {
      setSaving(false);
    }
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
        <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 0, marginBottom: 12 }}>{task.title}</h2>

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
          Description
        </label>
        <textarea
          autoFocus
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
