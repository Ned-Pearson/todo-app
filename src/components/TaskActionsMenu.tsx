import { useRef } from "react";
import type { Task } from "../types";
import { DANGER_COLOR } from "../lib/color";
import { useClickOutside } from "../lib/useClickOutside";
import { POPOVER_STYLE, MENU_ITEM_STYLE } from "../lib/sharedStyles";

interface Props {
  task: Task;
  hasTimeLogged: boolean;
  deleteLabel: string;
  // Controlled rather than self-contained (unlike TaskAttachments/
  // TaskRelationPicker): TaskRow's own onContextMenu handler, on the row
  // *outside* this component, needs to open the same menu at the cursor —
  // so both open/close and the right-click anchor position have to live in
  // TaskRow, not in here.
  open: boolean;
  setOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  contextMenuPos: { x: number; y: number } | null;
  setContextMenuPos: (pos: { x: number; y: number } | null) => void;
  onDelete: (id: number) => void;
  onDuplicate?: (id: number) => void;
  onSkipOccurrence?: (id: number) => void;
  onPostpone?: (id: number) => void;
  onSaveAsTemplate?: (id: number) => void;
  onExportMarkdown?: (id: number) => void;
  onArchive?: (id: number) => void;
  onUnarchive?: (id: number) => void;
  onBacklog?: (id: number) => void;
  onUnbacklog?: (id: number) => void;
  onRestore?: (id: number) => void;
  onResetTimer?: (id: number) => void;
}

// TaskRow's "⋯" kebab button and its popover of secondary, less-frequent
// actions (Skip/Postpone/Duplicate/Save as template/Export .md/Backlog/
// Archive/Delete/etc.) — each item conditional on both whether its handler
// was even passed in (a given view, e.g. Trash or Archive, only wires up
// the actions that make sense there) and the task's own current state
// (Skip only once it's recurring, Archive only once it's completed, etc).
export default function TaskActionsMenu({
  task,
  hasTimeLogged,
  deleteLabel,
  open,
  setOpen,
  contextMenuPos,
  setContextMenuPos,
  onDelete,
  onDuplicate,
  onSkipOccurrence,
  onPostpone,
  onSaveAsTemplate,
  onExportMarkdown,
  onArchive,
  onUnarchive,
  onBacklog,
  onUnbacklog,
  onRestore,
  onResetTimer,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, open, () => setOpen(false));

  // Runs an action-menu handler and closes the menu, so picking an item
  // doesn't leave a stale popover open behind whatever it triggered.
  function runMenuAction(action: (id: number) => void) {
    action(task.id);
    setOpen(false);
  }

  return (
    <div ref={menuRef} style={{ position: "relative", display: "flex", flexShrink: 0 }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setContextMenuPos(null);
          setOpen((v) => !v);
        }}
        title="More actions (or right-click the row)"
        aria-label="More actions"
        aria-haspopup="true"
        aria-expanded={open}
        style={{
          border: "none",
          background: "none",
          color: "var(--color-text-faint)",
          fontSize: 16,
          padding: "0 2px",
          lineHeight: 1,
        }}
      >
        ⋯
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          role="menu"
          aria-label="Task actions"
          style={{
            ...POPOVER_STYLE,
            position: contextMenuPos ? "fixed" : "absolute",
            top: contextMenuPos ? contextMenuPos.y : "calc(100% + 4px)",
            left: contextMenuPos ? contextMenuPos.x : undefined,
            right: contextMenuPos ? undefined : 0,
            minWidth: 170,
            padding: 4,
          }}
        >
          {task.recurrence && onSkipOccurrence && (
            <button
              onClick={() => runMenuAction(onSkipOccurrence)}
              title="Skip this occurrence and advance to the next one, without marking it complete"
              role="menuitem"
              style={MENU_ITEM_STYLE}
            >
              Skip
            </button>
          )}
          {task.dueDate && !task.recurrence && onPostpone && (
            <button
              onClick={() => runMenuAction(onPostpone)}
              title="Push this task's due date forward by a day"
              role="menuitem"
              style={MENU_ITEM_STYLE}
            >
              Postpone
            </button>
          )}
          {onDuplicate && (
            <button
              onClick={() => runMenuAction(onDuplicate)}
              title="Duplicate this task (and its subtasks)"
              role="menuitem"
              style={MENU_ITEM_STYLE}
            >
              Duplicate
            </button>
          )}
          {onSaveAsTemplate && (
            <button
              onClick={() => runMenuAction(onSaveAsTemplate)}
              title="Save this task's title/priority/tags and subtasks as a reusable template"
              role="menuitem"
              style={MENU_ITEM_STYLE}
            >
              Save as template
            </button>
          )}
          {onExportMarkdown && (
            <button
              onClick={() => runMenuAction(onExportMarkdown)}
              title="Save this task (and its subtasks) as a Markdown file"
              role="menuitem"
              style={MENU_ITEM_STYLE}
            >
              Export .md
            </button>
          )}
          {!task.backlog && onBacklog && (
            <button
              onClick={() => runMenuAction(onBacklog)}
              title="Move to Backlog — hide from All/Today/This Week until you're ready for it"
              role="menuitem"
              style={MENU_ITEM_STYLE}
            >
              Backlog
            </button>
          )}
          {task.backlog && onUnbacklog && (
            <button
              onClick={() => runMenuAction(onUnbacklog)}
              title="Bring back into the everyday views"
              role="menuitem"
              style={MENU_ITEM_STYLE}
            >
              Unbacklog
            </button>
          )}
          {onRestore && (
            <button
              onClick={() => runMenuAction(onRestore)}
              title="Restore this task out of the trash"
              role="menuitem"
              style={MENU_ITEM_STYLE}
            >
              Restore
            </button>
          )}
          {task.completed && onArchive && (
            <button
              onClick={() => runMenuAction(onArchive)}
              title="Move this task to the archive, out of History and the main list"
              role="menuitem"
              style={MENU_ITEM_STYLE}
            >
              Archive
            </button>
          )}
          {onUnarchive && (
            <button
              onClick={() => runMenuAction(onUnarchive)}
              title="Restore this task out of the archive"
              role="menuitem"
              style={MENU_ITEM_STYLE}
            >
              Unarchive
            </button>
          )}
          {hasTimeLogged && onResetTimer && (
            <button
              onClick={() => runMenuAction(onResetTimer)}
              title="Reset this task's logged time back to 0:00"
              role="menuitem"
              style={MENU_ITEM_STYLE}
            >
              Reset timer
            </button>
          )}
          <button
            onClick={() => runMenuAction(onDelete)}
            role="menuitem"
            style={{ ...MENU_ITEM_STYLE, color: DANGER_COLOR }}
          >
            {deleteLabel}
          </button>
        </div>
      )}
    </div>
  );
}
