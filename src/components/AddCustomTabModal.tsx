import { useState, FormEvent } from "react";

interface Props {
  onClose: () => void;
  onCreate: (name: string) => Promise<unknown>;
}

export default function AddCustomTabModal({ onClose, onCreate }: Props) {
  const [tabName, setTabName] = useState("");
  const [saving, setSaving] = useState(false);

  const canSubmit = tabName.trim() !== "";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      await onCreate(tabName.trim());
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
          maxWidth: 400,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-card)",
          padding: 20,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 0, marginBottom: 12 }}>New list</h2>

        <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
          List name
        </label>
        <input
          autoFocus
          value={tabName}
          onChange={(e) => setTabName(e.target.value)}
          placeholder="e.g. Work"
          style={{
            width: "100%",
            marginBottom: 16,
            padding: "8px 10px",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontSize: 14,
          }}
        />

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
            disabled={saving || !canSubmit}
            style={{
              padding: "8px 14px",
              border: "none",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-accent)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 500,
              opacity: saving || !canSubmit ? 0.6 : 1,
            }}
          >
            Create list
          </button>
        </div>
      </form>
    </div>
  );
}
