import { useState } from "react";
import type { Tag } from "../types";

interface Props {
  tags: Tag[];
  onClose: () => void;
  onRename: (id: number, name: string) => void;
  onRecolor: (id: number, color: string) => void;
  onDelete: (id: number) => void;
}

function TagEditRow({ tag, onRename, onRecolor, onDelete }: Omit<Props, "tags" | "onClose"> & { tag: Tag }) {
  const [name, setName] = useState(tag.name);

  function commitName() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== tag.name) {
      onRename(tag.id, trimmed);
    } else {
      setName(tag.name);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--color-border)" }}>
      <input
        type="color"
        value={tag.color}
        onChange={(e) => onRecolor(tag.id, e.target.value)}
        aria-label={`Color for tag "${tag.name}"`}
        style={{
          width: 28,
          height: 28,
          padding: 0,
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          background: "none",
          flexShrink: 0,
        }}
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        aria-label={`Name for tag "${tag.name}"`}
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
        type="button"
        onClick={() => onDelete(tag.id)}
        aria-label={`Delete tag "${tag.name}"`}
        style={{ border: "none", background: "none", color: "var(--color-text-faint)", fontSize: 13 }}
      >
        Delete
      </button>
    </div>
  );
}

export default function ManageTagsModal({ tags, onClose, onRename, onRecolor, onDelete }: Props) {
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-tags-heading"
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
        <h2 id="manage-tags-heading" style={{ fontSize: 16, fontWeight: 600, marginTop: 0, marginBottom: 12 }}>
          Manage tags
        </h2>

        {tags.length === 0 && (
          <div style={{ color: "var(--color-text-faint)", fontSize: 13, marginBottom: 16 }}>No tags yet.</div>
        )}

        <div style={{ marginBottom: 16 }}>
          {tags.map((tag) => (
            <TagEditRow key={tag.id} tag={tag} onRename={onRename} onRecolor={onRecolor} onDelete={onDelete} />
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
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
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
