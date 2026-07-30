import { useState, FormEvent } from "react";
import type { Tag } from "../types";
import { pickUnusedColor } from "../lib/tagColor";

interface Props {
  tags: Tag[];
  onClose: () => void;
  onCreate: (tabName: string, tag: { id: number } | { name: string; color: string }) => Promise<unknown>;
}

export default function AddCustomTabModal({ tags, onClose, onCreate }: Props) {
  const [tabName, setTabName] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<number | null>(tags[0]?.id ?? null);
  const [creatingNewTag, setCreatingNewTag] = useState(tags.length === 0);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(() => pickUnusedColor(tags.map((t) => t.color)));
  const [saving, setSaving] = useState(false);

  const canSubmit = tabName.trim() !== "" && (creatingNewTag ? newTagName.trim() !== "" : selectedTagId != null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      const tag = creatingNewTag
        ? { name: newTagName.trim(), color: newTagColor }
        : { id: selectedTagId as number };
      await onCreate(tabName.trim(), tag);
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
        <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 0, marginBottom: 12 }}>New tab</h2>

        <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
          Tab name
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

        <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
          Shows tasks tagged
        </label>

        {tags.length > 0 && !creatingNewTag && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {tags.map((tag) => {
              const selected = selectedTagId === tag.id;
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => setSelectedTagId(tag.id)}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    padding: "4px 8px",
                    borderRadius: "var(--radius-sm)",
                    border: selected ? "1px solid transparent" : `1px solid ${tag.color}`,
                    background: selected ? tag.color : "none",
                    color: selected ? "#fff" : tag.color,
                  }}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        )}

        {creatingNewTag ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 16 }}>
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="New tag name…"
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
            {tags.length > 0 && (
              <button
                type="button"
                onClick={() => setCreatingNewTag(false)}
                style={{ border: "none", background: "none", color: "var(--color-text-faint)", fontSize: 12 }}
              >
                Cancel
              </button>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setCreatingNewTag(true)}
              style={{ border: "none", background: "none", color: "var(--color-accent)", fontSize: 12 }}
            >
              + New tag
            </button>
          </div>
        )}

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
            Create tab
          </button>
        </div>
      </form>
    </div>
  );
}
