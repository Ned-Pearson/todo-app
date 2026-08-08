import { useEffect } from "react";
import type { RefObject } from "react";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Task } from "../types";
import type { SortOption } from "./appConstants";

const GLOBAL_QUICK_ADD_SHORTCUT = "CommandOrControl+Shift+N";

interface UseKeyboardShortcutsParams {
  selectedTask: Task | null;
  showManageTags: boolean;
  showAddModal: boolean;
  showCommandPalette: boolean;
  searchQuery: string;
  sortBy: SortOption;
  tasks: Task[];
  // Only ever used to trigger a fresh subscription when undo/redo history
  // changes underneath the (unmemoized) handleUndo/handleRedo closures below
  // — never read inside this hook, so the element type doesn't matter here.
  undoStack: unknown[];
  redoStack: unknown[];
  setSelectedTask: (task: Task | null) => void;
  setShowManageTags: (show: boolean) => void;
  setShowAddModal: (show: boolean) => void;
  setShowCommandPalette: (show: boolean) => void;
  setSearchQuery: (query: string) => void;
  searchInputRef: RefObject<HTMLInputElement>;
  handleUndo: () => void;
  handleRedo: () => void;
  handleMoveTask: (id: number, direction: "up" | "down") => void;
}

// Keyboard shortcuts: "n" opens the add-task modal, "/" focuses search,
// arrow keys move focus between task rows (Alt+↑/↓ reorders the focused row
// instead), Enter opens whatever row currently has focus (handled by
// TaskRow itself), and Escape closes whichever modal is open or clears a
// focused, non-empty search field. Everything except Escape/undo/redo/
// command-palette is skipped while a modal is open or while typing in any
// text field, so shortcuts never hijack normal typing. On top of these
// in-app shortcuts, Ctrl/⌘+Shift+N is a true OS-level global shortcut (works
// even when the app isn't focused) that brings the window to the front and
// opens the same Add Task modal.
export function useKeyboardShortcuts(params: UseKeyboardShortcutsParams): void {
  const {
    selectedTask,
    showManageTags,
    showAddModal,
    showCommandPalette,
    searchQuery,
    sortBy,
    tasks,
    undoStack,
    redoStack,
    setSelectedTask,
    setShowManageTags,
    setShowAddModal,
    setShowCommandPalette,
    setSearchQuery,
    searchInputRef,
    handleUndo,
    handleRedo,
    handleMoveTask,
  } = params;

  useEffect(() => {
    function isTextEntry(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (selectedTask) {
          setSelectedTask(null);
        } else if (showManageTags) {
          setShowManageTags(false);
        } else if (showAddModal) {
          setShowAddModal(false);
        } else if (showCommandPalette) {
          setShowCommandPalette(false);
        } else if (e.target === searchInputRef.current && searchQuery) {
          // Clear first; a second Escape (now that it's empty) falls through
          // to the blur below instead of doing nothing.
          setSearchQuery("");
        } else if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
          // Nothing left to close/clear — just drop focus from whatever's
          // currently focused (search box, a task row from arrow-key nav,
          // etc.) so Escape always has *something* to do.
          document.activeElement.blur();
        }
        return;
      }

      // Undo/redo works regardless of which modal (if any) is open, unlike
      // the shortcuts below — closing the detail modal via Save is exactly
      // when you'd want to undo it. It only backs off for a focused text
      // field, so it doesn't steal a text field's own native undo/redo.
      if ((e.ctrlKey || e.metaKey) && !isTextEntry(e.target)) {
        const key = e.key.toLowerCase();
        if (key === "z" && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
          return;
        }
        if ((key === "z" && e.shiftKey) || key === "y") {
          e.preventDefault();
          handleRedo();
          return;
        }
      }

      // Ctrl/⌘+K opens the command palette — checked here (after undo/redo,
      // before the "any modal open" gate below applies to it) so it's
      // reachable while typing anywhere, but the gate itself still stops it
      // from opening a second one, or opening over some other modal.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && !selectedTask && !showManageTags && !showAddModal && !showCommandPalette) {
        e.preventDefault();
        setShowCommandPalette(true);
        return;
      }

      if (selectedTask || showManageTags || showAddModal || showCommandPalette) return;

      if (e.key === "n" && !isTextEntry(e.target)) {
        e.preventDefault();
        setShowAddModal(true);
        return;
      }

      if (e.key === "/" && !isTextEntry(e.target)) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      if (isTextEntry(e.target)) return;

      // Alt+↑/↓ is the keyboard-operable equivalent of dragging a row's ⠿
      // handle — moves the focused row among its true siblings instead of
      // moving focus itself, so reordering (manual sort only, same as the
      // drag handle's own gate) doesn't require a mouse.
      if (e.altKey) {
        if (sortBy !== "manual") return;
        const focused = document.activeElement as HTMLElement | null;
        const taskId = focused?.dataset.taskId ? Number(focused.dataset.taskId) : null;
        if (taskId == null) return;
        e.preventDefault();
        handleMoveTask(taskId, e.key === "ArrowDown" ? "down" : "up");
        return;
      }

      const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-task-row]"));
      if (rows.length === 0) return;
      const currentIndex = rows.indexOf(document.activeElement as HTMLElement);
      e.preventDefault();
      if (e.key === "ArrowDown") {
        rows[Math.min(currentIndex + 1, rows.length - 1)]?.focus();
      } else {
        rows[currentIndex === -1 ? 0 : Math.max(currentIndex - 1, 0)]?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // Deliberately omits the setters (stable React state setters, safe to
    // skip), searchInputRef (refs are always stable), and handleUndo/
    // handleRedo/handleMoveTask themselves (plain unmemoized functions from
    // the caller, so listing them would re-subscribe on every render) —
    // undoStack/redoStack/tasks are included instead, as the actual data
    // those three handlers close over, so a fresh subscription still picks
    // up their current behavior whenever it would actually differ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTask, showManageTags, showAddModal, showCommandPalette, searchQuery, undoStack, redoStack, sortBy, tasks]);

  // A global (OS-level) shortcut so quick-add works even when the app isn't
  // focused — pressing it brings the window to the front and opens the Add
  // Task modal, unlike "n" which only works while the app already has focus.
  useEffect(() => {
    register(GLOBAL_QUICK_ADD_SHORTCUT, async (event) => {
      if (event.state !== "Pressed") return;
      try {
        const win = getCurrentWindow();
        if (await win.isMinimized()) await win.unminimize();
        await win.show();
        await win.setFocus();
      } catch (err) {
        console.error("Failed to focus window from global shortcut:", err);
      }
      setShowAddModal(true);
    }).catch((err) => {
      console.error(`Failed to register global shortcut ${GLOBAL_QUICK_ADD_SHORTCUT}:`, err);
    });

    return () => {
      unregisterAll().catch(() => {});
    };
    // setShowAddModal is a stable setter passed in as a parameter — ESLint
    // can't verify that across a module boundary the way it can for a local
    // useState call, but it's still safe to omit; this should register the
    // global shortcut once for the app's lifetime either way, not on every
    // render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
