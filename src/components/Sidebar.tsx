import { useRef } from "react";
import type { CustomTab } from "../types";
import { type View, VIEW_LABELS, type Theme, DEFAULT_ACCENT, SNOOZE_OPTIONS_MINUTES, SNOOZE_LABELS } from "../lib/appConstants";
import { useClickOutside } from "../lib/useClickOutside";

interface Props {
  view: View;
  setView: (view: View) => void;
  showMoreViews: boolean;
  setShowMoreViews: (updater: (v: boolean) => boolean) => void;
  customTabs: CustomTab[];
  activeListId: number | null;
  setActiveListId: (id: number | null) => void;
  handleSelectCustomTab: (tab: CustomTab) => void;
  colorPickerTabId: number | null;
  setColorPickerTabId: (updater: (id: number | null) => number | null) => void;
  handleUpdateCustomTabColor: (id: number, color: string | null) => void;
  handleDeleteCustomTab: (id: number) => void;
  setShowAddTabModal: (show: boolean) => void;
  theme: Theme;
  setTheme: (updater: (t: Theme) => Theme) => void;
  customAccent: string | null;
  setCustomAccent: (color: string | null) => void;
  showConfigMenu: boolean;
  setShowConfigMenu: (updater: (v: boolean) => boolean) => void;
  handleExport: () => void;
  handleImport: () => void;
  dndEnabled: boolean;
  setDndEnabled: (enabled: boolean) => void;
  notifySnoozeMinutes: number;
  setNotifySnoozeMinutes: (minutes: number) => void;
  weekStartsOn: 0 | 1;
  setWeekStartsOn: (value: 0 | 1) => void;
}

// Kept as top-level sidebar buttons — the views reached for constantly.
const PRIMARY_VIEWS: View[] = ["all", "today", "this-week", "no-date", "calendar"];
// Reviewed/housekeeping views, reached for far less often — tucked behind a
// "More" dropdown instead of permanently taking up sidebar space.
const MORE_VIEWS: View[] = ["history", "stats", "archive", "backlog", "trash"];

// The app's left navigation rail — every built-in view plus custom tabs
// (project-bound tag shortcuts), with a single "Config ▾" button pinned to
// the bottom holding everything reached for far less often (export/import,
// notifications, week-start, theme, accent). Undo/redo and the keyboard-
// shortcuts info popover live in the main column's header instead — they're
// used often enough (and relevant to whatever's currently on screen) that
// burying them behind Config or all the way down here didn't make sense.
export default function Sidebar({
  view,
  setView,
  showMoreViews,
  setShowMoreViews,
  customTabs,
  activeListId,
  setActiveListId,
  handleSelectCustomTab,
  colorPickerTabId,
  setColorPickerTabId,
  handleUpdateCustomTabColor,
  handleDeleteCustomTab,
  setShowAddTabModal,
  theme,
  setTheme,
  customAccent,
  setCustomAccent,
  showConfigMenu,
  setShowConfigMenu,
  handleExport,
  handleImport,
  dndEnabled,
  setDndEnabled,
  notifySnoozeMinutes,
  setNotifySnoozeMinutes,
  weekStartsOn,
  setWeekStartsOn,
}: Props) {
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const configMenuRef = useRef<HTMLDivElement>(null);
  const moreViewsRef = useRef<HTMLDivElement>(null);
  useClickOutside(colorPickerRef, colorPickerTabId !== null, () => setColorPickerTabId(() => null));
  useClickOutside(configMenuRef, showConfigMenu, () => setShowConfigMenu(() => false));
  useClickOutside(moreViewsRef, showMoreViews, () => setShowMoreViews(() => false));

  return (
    <div
      style={{
        width: "var(--sidebar-width)",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderRight: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        padding: "20px 12px",
        overflowY: "auto",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 700, margin: "0 8px 16px" }}>Tasks</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 4 }}>
        {PRIMARY_VIEWS.map((v) => {
          const active = view === v && activeListId == null;
          return (
            <button
              key={v}
              onClick={() => {
                setView(v);
                setActiveListId(null);
              }}
              style={{
                textAlign: "left",
                padding: "8px 10px",
                border: "none",
                borderRadius: "var(--radius-sm)",
                background: active ? "var(--color-accent-soft)" : "none",
                color: active ? "var(--color-accent)" : "var(--color-text-muted)",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {VIEW_LABELS[v]}
            </button>
          );
        })}
      </div>

      <div ref={moreViewsRef} style={{ position: "relative", marginBottom: 16 }}>
        {(() => {
          const moreActive = MORE_VIEWS.includes(view) && activeListId == null;
          return (
            <button
              type="button"
              onClick={() => setShowMoreViews((v) => !v)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                border: "none",
                borderRadius: "var(--radius-sm)",
                background: moreActive ? "var(--color-accent-soft)" : "none",
                color: moreActive ? "var(--color-accent)" : "var(--color-text-muted)",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {moreActive ? VIEW_LABELS[view] : "More"} ▾
            </button>
          );
        })()}
        {showMoreViews && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              zIndex: 30,
              padding: 4,
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-surface)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            {MORE_VIEWS.map((v) => {
              const active = view === v && activeListId == null;
              return (
                <button
                  key={v}
                  onClick={() => {
                    setView(v);
                    setActiveListId(null);
                    setShowMoreViews(() => false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 8px",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    background: active ? "var(--color-accent-soft)" : "none",
                    color: active ? "var(--color-accent)" : "var(--color-text-muted)",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {VIEW_LABELS[v]}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--color-text-faint)",
          textTransform: "uppercase",
          letterSpacing: 0.4,
          margin: "0 10px 6px",
        }}
      >
        Lists
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 16 }}>
        {customTabs.map((tab) => {
          const active = activeListId === tab.id;
          return (
            <div
              key={tab.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 6px 4px 10px",
                borderRadius: "var(--radius-sm)",
                background: active ? "var(--color-accent-soft)" : "none",
              }}
            >
              <button
                onClick={() => handleSelectCustomTab(tab)}
                style={{
                  flex: 1,
                  textAlign: "left",
                  border: "none",
                  background: "none",
                  color: active ? "var(--color-accent)" : "var(--color-text-muted)",
                  fontSize: 13,
                  fontWeight: 500,
                  padding: "4px 0",
                }}
              >
                {tab.name}
              </button>
              <div
                ref={colorPickerTabId === tab.id ? colorPickerRef : undefined}
                style={{ position: "relative", display: "flex" }}
              >
                <button
                  type="button"
                  onClick={() => setColorPickerTabId((id) => (id === tab.id ? null : tab.id))}
                  title="This tab's accent color — overrides the app-wide accent while it's active"
                  style={{
                    width: 14,
                    height: 14,
                    padding: 0,
                    border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border)"}`,
                    borderRadius: "50%",
                    background: tab.color ?? "none",
                  }}
                />
                {colorPickerTabId === tab.id && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      left: 0,
                      zIndex: 30,
                      width: 180,
                      padding: "10px 12px",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--color-surface)",
                      boxShadow: "var(--shadow-card)",
                      fontSize: 12,
                      color: "var(--color-text-muted)",
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "var(--color-text)", marginBottom: 6 }}>
                      "{tab.name}" tab color
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: tab.color ? 6 : 0 }}>
                      <input
                        type="color"
                        value={tab.color ?? DEFAULT_ACCENT[theme]}
                        onChange={(e) => handleUpdateCustomTabColor(tab.id, e.target.value)}
                        style={{
                          width: 40,
                          height: 28,
                          padding: 0,
                          border: "1px solid var(--color-border)",
                          borderRadius: "var(--radius-sm)",
                          background: "none",
                        }}
                      />
                      <span style={{ fontSize: 12 }}>{tab.color ?? "App accent"}</span>
                    </div>
                    {tab.color && (
                      <button
                        type="button"
                        onClick={() => handleUpdateCustomTabColor(tab.id, null)}
                        style={{ border: "none", background: "none", color: "var(--color-accent)", fontSize: 12 }}
                      >
                        Reset to app accent
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDeleteCustomTab(tab.id)}
                title="Delete this tab"
                style={{
                  border: "none",
                  background: "none",
                  color: active ? "var(--color-accent)" : "var(--color-text-faint)",
                  fontSize: 11,
                  opacity: 0.7,
                  padding: 0,
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setShowAddTabModal(true)}
          title="Add a new list"
          style={{
            textAlign: "left",
            padding: "6px 10px",
            border: "1px dashed var(--color-border)",
            borderRadius: "var(--radius-sm)",
            background: "none",
            color: "var(--color-text-faint)",
            fontSize: 13,
            marginTop: 4,
          }}
        >
          + New list
        </button>
      </div>

      <div style={{ marginTop: "auto", padding: "0 8px" }}>
        <div ref={configMenuRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setShowConfigMenu((v) => !v)}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "8px 10px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: showConfigMenu ? "var(--color-accent-soft)" : "var(--color-surface)",
              color: showConfigMenu ? "var(--color-accent)" : "var(--color-text-muted)",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Config ▾
          </button>
          {showConfigMenu && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 6px)",
                left: 0,
                right: 0,
                zIndex: 30,
                width: 240,
                padding: "10px 12px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-surface)",
                boxShadow: "var(--shadow-card)",
                fontSize: 12,
                color: "var(--color-text-muted)",
              }}
            >
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button
                  onClick={handleExport}
                  title="Export a backup of everything to a JSON file"
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--color-surface)",
                    color: "var(--color-text-muted)",
                    fontSize: 13,
                  }}
                >
                  Export
                </button>
                <button
                  onClick={handleImport}
                  title="Restore from a backup JSON file (replaces everything currently in the app)"
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--color-surface)",
                    color: "var(--color-text-muted)",
                    fontSize: 13,
                  }}
                >
                  Import
                </button>
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 600,
                  color: "var(--color-text)",
                  marginBottom: 10,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={dndEnabled}
                  onChange={(e) => setDndEnabled(e.target.checked)}
                  style={{ accentColor: "var(--color-accent)" }}
                />
                Do Not Disturb
              </label>
              <div style={{ opacity: dndEnabled ? 0.5 : 1, marginBottom: 12 }}>
                <div style={{ fontWeight: 600, color: "var(--color-text)", marginBottom: 6 }}>
                  Remind me again every
                </div>
                <select
                  value={notifySnoozeMinutes}
                  onChange={(e) => setNotifySnoozeMinutes(Number(e.target.value))}
                  disabled={dndEnabled}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--color-surface)",
                    color: "var(--color-text)",
                    fontSize: 13,
                  }}
                >
                  {SNOOZE_OPTIONS_MINUTES.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {SNOOZE_LABELS[minutes]}
                    </option>
                  ))}
                </select>
                <div style={{ marginTop: 6, color: "var(--color-text-faint)" }}>
                  for as long as a task stays overdue
                </div>
              </div>

              <div style={{ fontWeight: 600, color: "var(--color-text)", marginBottom: 6 }}>Week starts on</div>
              <select
                value={weekStartsOn}
                onChange={(e) => setWeekStartsOn(Number(e.target.value) === 1 ? 1 : 0)}
                title="Week starts on — affects This Week and Calendar"
                style={{
                  width: "100%",
                  marginBottom: 12,
                  padding: "6px 8px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface)",
                  color: "var(--color-text-muted)",
                  fontSize: 13,
                }}
              >
                <option value={0}>Sun</option>
                <option value={1}>Mon</option>
              </select>

              <div style={{ fontWeight: 600, color: "var(--color-text)", marginBottom: 6 }}>Theme</div>
              <button
                onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
                title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
                style={{
                  width: "100%",
                  marginBottom: 12,
                  padding: "6px 10px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface)",
                  color: "var(--color-text-muted)",
                  fontSize: 13,
                  textAlign: "left",
                }}
              >
                {theme === "light" ? "🌙 Switch to dark" : "☀️ Switch to light"}
              </button>

              <div style={{ fontWeight: 600, color: "var(--color-text)", marginBottom: 6 }}>Accent color</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: customAccent ? 6 : 0 }}>
                <input
                  type="color"
                  value={customAccent ?? DEFAULT_ACCENT[theme]}
                  onChange={(e) => setCustomAccent(e.target.value)}
                  style={{
                    width: 40,
                    height: 28,
                    padding: 0,
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    background: "none",
                  }}
                />
                <span style={{ fontSize: 12 }}>{customAccent ?? "Theme default"}</span>
              </div>
              {customAccent && (
                <button
                  type="button"
                  onClick={() => setCustomAccent(null)}
                  style={{ border: "none", background: "none", color: "var(--color-accent)", fontSize: 12, padding: 0 }}
                >
                  Reset to theme default
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
