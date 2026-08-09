import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { Attachment } from "../types";
import { fileNameFromPath, isImagePath } from "../lib/attachments";

interface Props {
  attachments: Attachment[];
  onAddAttachment: (path: string) => void;
  onRemoveAttachment: (attachmentId: number) => void;
}

// Self-contained enough to live on its own: its own local lightbox state
// (previewPath) and file-picker/open-file handlers, only reaching out to the
// parent for the two DB-backed mutations (add/remove) it doesn't own itself.
export default function TaskAttachments({ attachments, onAddAttachment, onRemoveAttachment }: Props) {
  const [previewPath, setPreviewPath] = useState<string | null>(null);

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

  return (
    <>
      <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
        Attachments
      </label>
      {attachments.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          {attachments.map((a) =>
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
                  aria-label={`Remove attachment "${fileNameFromPath(a.path)}"`}
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
                  aria-label={`Remove attachment "${fileNameFromPath(a.path)}"`}
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

      {previewPath && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setPreviewPath(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
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
    </>
  );
}
