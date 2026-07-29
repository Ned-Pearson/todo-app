import { useState, FormEvent } from "react";
import type { Priority, RecurrenceFrequency } from "../types";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "../lib/priority";
import { REPEAT_LABELS, type RepeatOption } from "../lib/recurrence";

interface Props {
  defaultDueDate: string;
  onClose: () => void;
  onAdd: (
    title: string,
    dueDate: string,
    dueTime: string,
    priority: Priority | null,
    recurrence: { frequency: RecurrenceFrequency; interval: number; endDate: string } | null
  ) => Promise<unknown>;
}

export default function AddTaskModal({ defaultDueDate, onClose, onAdd }: Props) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState<Priority | null>(null);
  const [repeat, setRepeat] = useState<RepeatOption>("none");
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [repeatEndDate, setRepeatEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const recurrence = repeat === "none" ? null : { frequency: repeat, interval: repeatInterval, endDate: repeatEndDate };
      await onAdd(trimmed, dueDate, dueTime, priority, recurrence);
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
      <form
        onSubmit={handleSubmit}
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 20 }}>
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

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
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
            type="submit"
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
            Add
          </button>
        </div>
      </form>
    </div>
  );
}
