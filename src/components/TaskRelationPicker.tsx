import { useEffect, useState } from "react";

// TaskDependency and RelatedTask (see types.ts) are structurally identical
// — just enough of another task to show and link to it — so this accepts
// either without needing to import both types.
interface RelationItem {
  id: number;
  title: string;
  completed: boolean;
}

interface Candidate {
  id: number;
  title: string;
}

interface Props {
  label: string;
  items: RelationItem[];
  candidates: Candidate[];
  emptyMessage: string;
  removeTitle: string;
  removeAriaLabel: (title: string) => string;
  onAdd: (id: number) => void;
  onRemove: (id: number) => void;
  // Only "See also" links are navigable — a dependency's row shows a
  // ✅/⏳ status instead, since clicking to jump to a blocking task isn't
  // this section's job. Presence of this prop is what switches between the
  // two row styles.
  onSelectItem?: (id: number) => void;
}

// Shared by TaskDetailModal's "Depends on" and "See also" sections — the
// same "pick from a dropdown of other tasks, then Add" pattern, plus a list
// of what's already linked with its own remove button. Owns its own
// dropdown-selection state (keeping it valid as the candidate list shrinks
// or grows) rather than that living in the parent, the same way
// TaskAttachments owns its lightbox state.
export default function TaskRelationPicker({
  label,
  items,
  candidates,
  emptyMessage,
  removeTitle,
  removeAriaLabel,
  onAdd,
  onRemove,
  onSelectItem,
}: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(candidates[0]?.id ?? null);

  // Keep the dropdown's selection valid as the candidate list shrinks (an
  // item just added should disappear from the options) or grows.
  useEffect(() => {
    if (selectedId != null && !candidates.some((c) => c.id === selectedId)) {
      setSelectedId(candidates[0]?.id ?? null);
    }
    // candidates is a fresh array every render (computed by the caller from
    // allTasks, not memoized) — depending on it directly would run this on
    // every render instead of only when the underlying relationships
    // actually change, which is what `items` (task.dependsOn/relatedTasks)
    // reflects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  return (
    <>
      <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
        {label}
      </label>
      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
          {items.map((item) => (
            <div
              key={item.id}
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
              {onSelectItem ? (
                <button
                  type="button"
                  onClick={() => onSelectItem(item.id)}
                  title="Open this task"
                  style={{
                    flex: 1,
                    textAlign: "left",
                    border: "none",
                    background: "none",
                    padding: 0,
                    fontSize: 13,
                    textDecoration: item.completed ? "line-through" : "underline",
                    color: item.completed ? "var(--color-text-faint)" : "var(--color-text)",
                    cursor: "pointer",
                  }}
                >
                  {item.title}
                </button>
              ) : (
                <>
                  <span style={{ fontSize: 13 }}>{item.completed ? "✅" : "⏳"}</span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      textDecoration: item.completed ? "line-through" : "none",
                      color: item.completed ? "var(--color-text-faint)" : "var(--color-text)",
                    }}
                  >
                    {item.title}
                  </span>
                </>
              )}
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                title={removeTitle}
                aria-label={removeAriaLabel(item.title)}
                style={{ border: "none", background: "none", color: "var(--color-text-faint)", fontSize: 12 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {candidates.length > 0 ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 16 }}>
          <select
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(Number(e.target.value))}
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
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => selectedId != null && onAdd(selectedId)}
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
        items.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--color-text-faint)", marginBottom: 16 }}>{emptyMessage}</div>
        )
      )}
    </>
  );
}
