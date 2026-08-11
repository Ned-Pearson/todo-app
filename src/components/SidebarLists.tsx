import { useEffect, useRef, useState } from "react";
import type { CustomTab, Tag } from "../types";
import { DEFAULT_ACCENT } from "../lib/appConstants";
import { useClickOutside } from "../lib/useClickOutside";
import { POPOVER_STYLE } from "../lib/sharedStyles";
import { useSettings } from "../lib/SettingsContext";

const LIST_MENU_WIDTH = 220;
// A generous estimate (color row + reset button + description textarea),
// used only to keep a right-click-opened panel from running off the bottom
// of the window — doesn't need to match the real rendered height exactly.
const LIST_MENU_HEIGHT_ESTIMATE = 280;
// Distinct from tasks' "text/plain" drag payload so a list can never be
// misread as a task id (or vice versa) if a drag somehow crosses contexts —
// the two id sequences are independent and could otherwise collide.
const LIST_DRAG_MIME = "application/x-todo-list-id";

// A small curated set covering common list categories — not exhaustive
// (there's no native emoji-picker input to defer to), just enough variety
// that most lists can find something fitting without leaving the popover.
const LIST_ICON_OPTIONS = [
  "📋", "🏠", "💼", "🛒", "✈️", "🎓", "💪", "🎨",
  "📚", "🍔", "🎮", "❤️", "⭐", "🔥", "💰", "🐾",
  "🌱", "🎵", "🧹", "🏋️", "🧾", "📅", "🎯", "💡",
];

interface Props {
  customTabs: CustomTab[];
  activeListId: number | null;
  tags: Tag[];
  handleSelectCustomTab: (tab: CustomTab) => void;
  handleReorderCustomTab: (draggedId: number, targetId: number, position: "before" | "after") => void;
  handleUpdateCustomTabColor: (id: number, color: string | null) => void;
  handleUpdateCustomTabDescription: (id: number, description: string | null) => void;
  handleUpdateCustomTabDefaultTag: (id: number, tagId: number | null) => void;
  handleUpdateCustomTabIcon: (id: number, icon: string | null) => void;
  handleApplyTagToAllTasksInList: (listId: number, tagId: number) => void;
  handleExportListMarkdown: (listId: number) => void;
  handleDeleteCustomTab: (id: number) => void;
  setShowAddTabModal: (show: boolean) => void;
}

// The sidebar's "Lists" section — custom tabs (this app's user-defined,
// tag-backed shortcuts), each with drag-to-reorder, a right-click/color-dot
// settings popover (color, icon, description, default tag, export), and a
// delete button. `colorPickerTabId` and everything else here used to be
// threaded down from App.tsx as props, but nothing outside this section
// ever read them — same self-contained shape as TaskAttachments/
// TaskRelationPicker/TaskActionsMenu, just for Sidebar instead of a task
// row.
export default function SidebarLists({
  customTabs,
  activeListId,
  tags,
  handleSelectCustomTab,
  handleReorderCustomTab,
  handleUpdateCustomTabColor,
  handleUpdateCustomTabDescription,
  handleUpdateCustomTabDefaultTag,
  handleUpdateCustomTabIcon,
  handleApplyTagToAllTasksInList,
  handleExportListMarkdown,
  handleDeleteCustomTab,
  setShowAddTabModal,
}: Props) {
  const { theme } = useSettings();
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const [colorPickerTabId, setColorPickerTabId] = useState<number | null>(null);
  // A local draft rather than writing to the DB on every keystroke (unlike
  // the color input, which only fires onChange once a pick is finalized) —
  // committed on blur instead. Resyncs whenever a different tab's popover
  // opens, since only one can ever be open at a time.
  const [descriptionDraft, setDescriptionDraft] = useState("");
  // Set only when the list's settings popover was opened via right-click —
  // anchors it at the cursor instead of under the color dot. Cleared on
  // every other way of opening it, same pattern TaskRow's context menu uses.
  const [listMenuPos, setListMenuPos] = useState<{ x: number; y: number } | null>(null);
  // Which list is currently being dragged over, and which half of it —
  // mirrors TaskRow's own before/after drag-reorder indicator, but lifted up
  // here since the Lists section is one flat `.map()` in this component
  // rather than each row managing its own local state.
  const [dragOverList, setDragOverList] = useState<{ id: number; position: "before" | "after" } | null>(null);

  // useClickOutside closes the popover via a state update rather than a
  // direct DOM/focus change, so the textarea's own onBlur can't be counted
  // on to fire before it's unmounted (React removing a still-focused element
  // from the DOM doesn't reliably blur it first) — every path that closes
  // the popover has to commit the draft itself instead of assuming blur
  // already did.
  function commitDescriptionDraft() {
    if (colorPickerTabId != null) {
      handleUpdateCustomTabDescription(colorPickerTabId, descriptionDraft.trim() || null);
    }
  }

  // The keyboard-operable equivalent of dragging a list's ⠿ handle — Alt+↑/↓
  // while its name button has focus (wired below) swaps it with its
  // immediate neighbor, same as TaskRow's own Alt+↑/↓ handling in App.tsx.
  function handleMoveList(id: number, direction: "up" | "down") {
    const index = customTabs.findIndex((t) => t.id === id);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= customTabs.length) return;
    handleReorderCustomTab(id, customTabs[targetIndex].id, direction === "up" ? "before" : "after");
  }
  useClickOutside(colorPickerRef, colorPickerTabId !== null, () => {
    commitDescriptionDraft();
    setColorPickerTabId(() => null);
  });
  useEffect(() => {
    if (colorPickerTabId != null) {
      setDescriptionDraft(customTabs.find((t) => t.id === colorPickerTabId)?.description ?? "");
    }
    // Deliberately excludes customTabs — including it would re-sync (and
    // clobber) an in-progress, uncommitted description draft every time
    // *any* edit within this same popover (color, icon, default tag) writes
    // through and reloads customTabs, not just when a different tab's
    // popover opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorPickerTabId]);

  return (
    <>
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
              onContextMenu={(e) => {
                e.preventDefault();
                commitDescriptionDraft();
                // Clamped against the window, not just the sidebar — a
                // right-click near the bottom of a tall Lists section could
                // otherwise open a panel that runs off the bottom of the
                // screen just as easily as off the right edge.
                setListMenuPos({
                  x: Math.min(e.clientX, window.innerWidth - LIST_MENU_WIDTH - 8),
                  y: Math.min(e.clientY, window.innerHeight - LIST_MENU_HEIGHT_ESTIMATE - 8),
                });
                setColorPickerTabId(() => tab.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                const rect = e.currentTarget.getBoundingClientRect();
                const isAfter = e.clientY > rect.top + rect.height / 2;
                setDragOverList({ id: tab.id, position: isAfter ? "after" : "before" });
              }}
              onDragLeave={() => setDragOverList((cur) => (cur?.id === tab.id ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                const position = dragOverList?.id === tab.id ? dragOverList.position : "before";
                setDragOverList(null);
                const draggedId = Number(e.dataTransfer.getData(LIST_DRAG_MIME));
                if (!Number.isNaN(draggedId)) handleReorderCustomTab(draggedId, tab.id, position);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 6px 4px 10px",
                borderRadius: "var(--radius-sm)",
                background: active ? "var(--color-accent-soft)" : "none",
                borderTop:
                  dragOverList?.id === tab.id && dragOverList.position === "before"
                    ? "2px solid var(--color-accent)"
                    : "2px solid transparent",
                borderBottom:
                  dragOverList?.id === tab.id && dragOverList.position === "after"
                    ? "2px solid var(--color-accent)"
                    : "2px solid transparent",
              }}
            >
              <span
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(LIST_DRAG_MIME, String(tab.id));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onClick={(e) => e.stopPropagation()}
                title="Drag to reorder"
                // Decorative for screen readers — Alt+↑/↓ on the list's name
                // button below is the keyboard-operable equivalent.
                aria-hidden="true"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 16,
                  height: 16,
                  cursor: "grab",
                  color: "var(--color-text-faint)",
                  fontSize: 14,
                  flexShrink: 0,
                  userSelect: "none",
                }}
              >
                ⠿
              </span>
              <button
                onClick={() => handleSelectCustomTab(tab)}
                onKeyDown={(e) => {
                  if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
                  e.preventDefault();
                  handleMoveList(tab.id, e.key === "ArrowDown" ? "down" : "up");
                }}
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
                {tab.icon && <span style={{ marginRight: 5 }}>{tab.icon}</span>}
                {tab.name}
              </button>
              <div
                ref={colorPickerTabId === tab.id ? colorPickerRef : undefined}
                style={{ position: "relative", display: "flex" }}
              >
                <button
                  type="button"
                  onClick={() => {
                    commitDescriptionDraft();
                    setListMenuPos(null);
                    setColorPickerTabId((id) => (id === tab.id ? null : tab.id));
                  }}
                  title="This tab's accent color — overrides the app-wide accent while it's active (or right-click the list)"
                  aria-label={`"${tab.name}" list settings`}
                  aria-haspopup="true"
                  aria-expanded={colorPickerTabId === tab.id}
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
                    role="dialog"
                    aria-label={`"${tab.name}" list settings`}
                    style={{
                      ...POPOVER_STYLE,
                      position: listMenuPos ? "fixed" : "absolute",
                      top: listMenuPos ? listMenuPos.y : "calc(100% + 6px)",
                      left: listMenuPos ? listMenuPos.x : undefined,
                      // Anchored to the wrapper's *right* edge (extending
                      // leftward) rather than its left edge when opened via
                      // the color dot — that button sits near the right end
                      // of a narrow sidebar, so a fixed-width panel opening
                      // further rightward from there would spill out of the
                      // sidebar and over the main column.
                      right: listMenuPos ? undefined : 0,
                      width: LIST_MENU_WIDTH,
                      padding: "10px 12px",
                      fontSize: 12,
                      color: "var(--color-text-muted)",
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "var(--color-text)", marginBottom: 6 }}>
                      "{tab.name}" settings
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: tab.color ? 6 : 12 }}>
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
                        style={{ border: "none", background: "none", color: "var(--color-accent)", fontSize: 12, marginBottom: 12 }}
                      >
                        Reset to app accent
                      </button>
                    )}
                    <div style={{ fontWeight: 600, color: "var(--color-text)", marginBottom: 6 }}>Icon</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: tab.icon ? 6 : 12 }}>
                      {LIST_ICON_OPTIONS.map((icon) => (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => handleUpdateCustomTabIcon(tab.id, icon)}
                          title={icon}
                          aria-label={`Use icon ${icon}`}
                          aria-pressed={tab.icon === icon}
                          style={{
                            width: 22,
                            height: 22,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: tab.icon === icon ? "1px solid var(--color-accent)" : "1px solid transparent",
                            borderRadius: "var(--radius-sm)",
                            background: tab.icon === icon ? "var(--color-accent-soft)" : "none",
                            fontSize: 13,
                            padding: 0,
                          }}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                    {tab.icon && (
                      <button
                        type="button"
                        onClick={() => handleUpdateCustomTabIcon(tab.id, null)}
                        style={{ border: "none", background: "none", color: "var(--color-accent)", fontSize: 12, marginBottom: 12 }}
                      >
                        Remove icon
                      </button>
                    )}
                    <div style={{ fontWeight: 600, color: "var(--color-text)", marginBottom: 6 }}>Description</div>
                    <textarea
                      value={descriptionDraft}
                      onChange={(e) => setDescriptionDraft(e.target.value)}
                      onBlur={() => handleUpdateCustomTabDescription(tab.id, descriptionDraft.trim() || null)}
                      placeholder="What's this list for?"
                      rows={3}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--color-surface)",
                        color: "var(--color-text)",
                        fontSize: 12,
                        fontFamily: "inherit",
                        resize: "vertical",
                      }}
                    />

                    <div style={{ fontWeight: 600, color: "var(--color-text)", marginTop: 12, marginBottom: 6 }}>
                      Default tag
                    </div>
                    <select
                      value={tab.defaultTagId ?? ""}
                      onChange={(e) =>
                        handleUpdateCustomTabDefaultTag(tab.id, e.target.value === "" ? null : Number(e.target.value))
                      }
                      style={{
                        width: "100%",
                        marginBottom: 6,
                        padding: "6px 8px",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--color-surface)",
                        color: "var(--color-text)",
                        fontSize: 12,
                      }}
                    >
                      <option value="">No default tag</option>
                      {tags.map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                    </select>
                    {tab.defaultTagId != null && (
                      <button
                        type="button"
                        onClick={() => handleApplyTagToAllTasksInList(tab.id, tab.defaultTagId as number)}
                        title="Tag every task currently in this list with the default tag — new tasks get it automatically already"
                        style={{ border: "none", background: "none", color: "var(--color-accent)", fontSize: 12, padding: 0, marginBottom: 8 }}
                      >
                        Apply to all tasks in this list
                      </button>
                    )}
                    <div>
                      <button
                        type="button"
                        onClick={() => handleExportListMarkdown(tab.id)}
                        title="Save every task in this list as one Markdown checklist file"
                        style={{ border: "none", background: "none", color: "var(--color-accent)", fontSize: 12, padding: 0 }}
                      >
                        Export as Markdown
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDeleteCustomTab(tab.id)}
                title="Delete this tab"
                aria-label={`Delete list "${tab.name}"`}
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
    </>
  );
}
