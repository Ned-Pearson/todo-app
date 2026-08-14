import { useRef } from "react";
import type { CustomTab, Tag } from "../types";
import {
  type View,
  VIEW_LABELS,
  DEFAULT_ACCENT,
  SNOOZE_OPTIONS_MINUTES,
  SNOOZE_LABELS,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
  TRASH_RETENTION_OPTIONS_DAYS,
  TRASH_RETENTION_LABELS,
} from "../lib/appConstants";
import { useClickOutside } from "../lib/useClickOutside";
import { startResize } from "../lib/resize";
import { POPOVER_STYLE, MENU_ITEM_STYLE } from "../lib/sharedStyles";
import { DANGER_COLOR } from "../lib/color";
import { useSettings } from "../lib/SettingsContext";
import SidebarLists from "./SidebarLists";

interface Props {
  view: View;
  setView: (view: View) => void;
  showMoreViews: boolean;
  setShowMoreViews: (updater: (v: boolean) => boolean) => void;
  width: number;
  setWidth: (width: number) => void;
  customTabs: CustomTab[];
  activeListId: number | null;
  setActiveListId: (id: number | null) => void;
  handleSelectCustomTab: (tab: CustomTab) => void;
  handleReorderCustomTab: (draggedId: number, targetId: number, position: "before" | "after") => void;
  handleUpdateCustomTabColor: (id: number, color: string | null) => void;
  handleUpdateCustomTabDescription: (id: number, description: string | null) => void;
  handleUpdateCustomTabDefaultTag: (id: number, tagId: number | null) => void;
  handleUpdateCustomTabIcon: (id: number, icon: string | null) => void;
  handleApplyTagToAllTasksInList: (listId: number, tagId: number) => void;
  handleExportListMarkdown: (listId: number) => void;
  tags: Tag[];
  handleDeleteCustomTab: (id: number) => void;
  setShowAddTabModal: (show: boolean) => void;
  showConfigMenu: boolean;
  setShowConfigMenu: (updater: (v: boolean) => boolean) => void;
  handleExport: () => void;
  handleImport: () => void;
  checkForUpdatesNow: () => void;
  checkingForUpdates: boolean;
  updateCheckError: string | null;
  updateIsUpToDate: boolean;
}

// Kept as top-level sidebar buttons — the views reached for constantly.
// "My Day" leads, matching where a daily-dashboard view conventionally sits.
const PRIMARY_VIEWS: View[] = ["my-day", "all", "today", "this-week", "no-date", "calendar"];
// Reviewed/housekeeping views, reached for far less often — tucked behind a
// "More" dropdown instead of permanently taking up sidebar space.
const MORE_VIEWS: View[] = ["history", "stats", "archive", "backlog", "trash"];

// Keyboard-operable equivalent of dragging a resize handle (Sidebar's own,
// and TaskDetailModal's matching one) — ←/→ while it has focus, since a
// mouse drag has no keyboard equivalent otherwise.
const RESIZE_STEP = 20;

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
  width,
  setWidth,
  customTabs,
  activeListId,
  setActiveListId,
  handleSelectCustomTab,
  handleReorderCustomTab,
  handleUpdateCustomTabColor,
  handleUpdateCustomTabDescription,
  handleUpdateCustomTabDefaultTag,
  handleUpdateCustomTabIcon,
  handleApplyTagToAllTasksInList,
  handleExportListMarkdown,
  tags,
  handleDeleteCustomTab,
  setShowAddTabModal,
  showConfigMenu,
  setShowConfigMenu,
  handleExport,
  handleImport,
  checkForUpdatesNow,
  checkingForUpdates,
  updateCheckError,
  updateIsUpToDate,
}: Props) {
  const {
    theme,
    setTheme,
    customAccent,
    setCustomAccent,
    dndEnabled,
    setDndEnabled,
    notifySnoozeMinutes,
    setNotifySnoozeMinutes,
    weekStartsOn,
    setWeekStartsOn,
    trashRetentionDays,
    setTrashRetentionDays,
    autoUpdateCheckEnabled,
    setAutoUpdateCheckEnabled,
  } = useSettings();
  const configMenuRef = useRef<HTMLDivElement>(null);
  const moreViewsRef = useRef<HTMLDivElement>(null);
  useClickOutside(configMenuRef, showConfigMenu, () => setShowConfigMenu(() => false));
  useClickOutside(moreViewsRef, showMoreViews, () => setShowMoreViews(() => false));

  return (
    <div
      style={{
        position: "relative",
        width,
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
      <div
        onMouseDown={(e) => startResize(e, width, setWidth, { min: SIDEBAR_WIDTH_MIN, max: SIDEBAR_WIDTH_MAX, direction: "grow-right" })}
        title="Drag to resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuenow={width}
        aria-valuemin={SIDEBAR_WIDTH_MIN}
        aria-valuemax={SIDEBAR_WIDTH_MAX}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          const delta = e.key === "ArrowRight" ? RESIZE_STEP : -RESIZE_STEP;
          setWidth(Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, width + delta)));
        }}
        style={{
          position: "absolute",
          top: 0,
          right: -3,
          bottom: 0,
          width: 6,
          cursor: "col-resize",
          zIndex: 5,
        }}
      />
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
              aria-haspopup="true"
              aria-expanded={showMoreViews}
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
            role="menu"
            aria-label="More views"
            style={{
              ...POPOVER_STYLE,
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              padding: 4,
            }}
          >
            {MORE_VIEWS.map((v) => {
              const active = view === v && activeListId == null;
              return (
                <button
                  key={v}
                  role="menuitem"
                  onClick={() => {
                    setView(v);
                    setActiveListId(null);
                    setShowMoreViews(() => false);
                  }}
                  style={{
                    ...MENU_ITEM_STYLE,
                    background: active ? "var(--color-accent-soft)" : "none",
                    color: active ? "var(--color-accent)" : "var(--color-text-muted)",
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

      <SidebarLists
        customTabs={customTabs}
        activeListId={activeListId}
        tags={tags}
        handleSelectCustomTab={handleSelectCustomTab}
        handleReorderCustomTab={handleReorderCustomTab}
        handleUpdateCustomTabColor={handleUpdateCustomTabColor}
        handleUpdateCustomTabDescription={handleUpdateCustomTabDescription}
        handleUpdateCustomTabDefaultTag={handleUpdateCustomTabDefaultTag}
        handleUpdateCustomTabIcon={handleUpdateCustomTabIcon}
        handleApplyTagToAllTasksInList={handleApplyTagToAllTasksInList}
        handleExportListMarkdown={handleExportListMarkdown}
        handleDeleteCustomTab={handleDeleteCustomTab}
        setShowAddTabModal={setShowAddTabModal}
      />

      <div style={{ marginTop: "auto", padding: "0 8px" }}>
        <div ref={configMenuRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setShowConfigMenu((v) => !v)}
            aria-haspopup="true"
            aria-expanded={showConfigMenu}
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
              role="dialog"
              aria-label="Configuration"
              style={{
                ...POPOVER_STYLE,
                position: "absolute",
                bottom: "calc(100% + 6px)",
                left: 0,
                right: 0,
                width: 240,
                padding: "10px 12px",
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
                aria-label="Week starts on"
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

              <div style={{ fontWeight: 600, color: "var(--color-text)", marginBottom: 6 }}>Trash retention</div>
              <select
                value={trashRetentionDays}
                onChange={(e) => setTrashRetentionDays(Number(e.target.value))}
                title="How long a deleted task stays in Trash before being purged for good"
                aria-label="Trash retention"
                style={{
                  width: "100%",
                  marginBottom: 6,
                  padding: "6px 8px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface)",
                  color: "var(--color-text-muted)",
                  fontSize: 13,
                }}
              >
                {TRASH_RETENTION_OPTIONS_DAYS.map((days) => (
                  <option key={days} value={days}>
                    {TRASH_RETENTION_LABELS[days]}
                  </option>
                ))}
              </select>
              <div style={{ marginBottom: 12, color: "var(--color-text-faint)" }}>
                Applies the next time the app opens, not immediately — changing this won't purge anything right now.
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 600,
                  color: "var(--color-text)",
                  marginBottom: 12,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={autoUpdateCheckEnabled}
                  onChange={(e) => setAutoUpdateCheckEnabled(e.target.checked)}
                  style={{ accentColor: "var(--color-accent)" }}
                />
                Auto-check for updates
              </label>

              <div style={{ marginBottom: 12 }}>
                <button
                  onClick={checkForUpdatesNow}
                  disabled={checkingForUpdates}
                  title="Check for updates now, regardless of the auto-check setting above"
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--color-surface)",
                    color: "var(--color-text-muted)",
                    fontSize: 13,
                  }}
                >
                  {checkingForUpdates ? "Checking…" : "Check for updates now"}
                </button>
                {(updateIsUpToDate || updateCheckError) && (
                  <div
                    style={{
                      marginTop: 6,
                      color: updateCheckError ? DANGER_COLOR : "var(--color-text-faint)",
                    }}
                  >
                    {updateCheckError ? `Check failed: ${updateCheckError}` : "You're up to date."}
                  </div>
                )}
              </div>

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
                  aria-label="Accent color"
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
