import type { Update } from "@tauri-apps/plugin-updater";
import { CARD_STYLE } from "../lib/sharedStyles";
import { DANGER_COLOR } from "../lib/color";

interface UpdateBannerProps {
  update: Update;
  installing: boolean;
  error: string | null;
  onInstall: () => void;
  onDismiss: () => void;
}

export default function UpdateBanner({ update, installing, error, onInstall, onDismiss }: UpdateBannerProps) {
  return (
    <div
      style={{
        ...CARD_STYLE,
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "12px 16px",
        fontSize: 13,
        color: "var(--color-text)",
        maxWidth: 320,
      }}
    >
      <div style={{ fontWeight: 600 }}>Update available: v{update.version}</div>
      {error ? (
        <div style={{ color: DANGER_COLOR }}>Update failed: {error}</div>
      ) : (
        <div style={{ color: "var(--color-text-muted)" }}>Installing will restart the app.</div>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={onDismiss}
          disabled={installing}
          style={{
            border: "none",
            background: "none",
            color: "var(--color-text-muted)",
            fontSize: 13,
          }}
        >
          Later
        </button>
        <button
          onClick={onInstall}
          disabled={installing}
          style={{
            border: "none",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-accent)",
            color: "#fff",
            fontSize: 13,
            padding: "6px 10px",
            fontWeight: 600,
          }}
        >
          {installing ? "Installing…" : "Install & Restart"}
        </button>
      </div>
    </div>
  );
}
