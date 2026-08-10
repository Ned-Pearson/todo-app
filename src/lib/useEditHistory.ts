import { useState } from "react";
import type { Priority, RecurrenceFrequency, Task } from "../types";
import type { RecurrenceInput } from "./recurrence";

// The full set of fields the task detail modal's Save button commits at
// once — undo/redo for edits treats that whole click as a single step
// (reverting/reapplying every field together) rather than one step per
// field, since that's what the user actually did in one action.
export interface EditSnapshot {
  title: string;
  description: string;
  dueDate: string;
  dueTime: string;
  priority: Priority | null;
  recurrence: RecurrenceInput | null;
  reminderAt: string | null;
  reminderRepeat: RecurrenceFrequency | null;
  highlightColor: string | null;
  estimatedMinutes: number | null;
}

interface EditHistoryEntry {
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

// The eight per-field DB-write handlers a snapshot gets replayed through —
// still owned by App.tsx (not yet their own hook), passed in rather than
// imported so this hook doesn't need to know anything about how they're
// implemented, only that each one persists its one field and reloads.
interface UseEditHistoryOptions {
  onSaveTitle: (id: number, title: string) => Promise<void>;
  onSaveDescription: (id: number, description: string) => Promise<void>;
  onSaveDueDate: (id: number, dueDate: string, dueTime: string) => Promise<void>;
  onSavePriority: (id: number, priority: Priority | null) => Promise<void>;
  onSaveRecurrence: (id: number, recurrence: RecurrenceInput | null) => Promise<void>;
  onSaveReminder: (id: number, reminderAt: string | null, reminderRepeat: RecurrenceFrequency | null) => Promise<void>;
  onSaveHighlightColor: (id: number, color: string | null) => Promise<void>;
  onSaveEstimate: (id: number, estimatedMinutes: number | null) => Promise<void>;
}

function toEditSnapshot(task: Task): EditSnapshot {
  return {
    title: task.title,
    description: task.description ?? "",
    dueDate: task.dueDate ?? "",
    dueTime: task.dueTime ?? "",
    priority: task.priority,
    recurrence: task.recurrence
      ? {
          frequency: task.recurrence.frequency,
          interval: task.recurrence.interval,
          endDate: task.recurrence.endDate ?? "",
          occurrences: task.recurrence.occurrencesLeft,
          weekdays: task.recurrence.weekdays,
        }
      : null,
    reminderAt: task.reminderAt,
    reminderRepeat: task.reminderRepeat,
    highlightColor: task.highlightColor,
    estimatedMinutes: task.estimatedMinutes,
  };
}

// The task detail modal's Save button, App.tsx's undo/redo toolbar buttons,
// and the command palette's undo/redo commands all go through this —
// owning the undo/redo stacks themselves plus the "diff before/after, apply
// every field, and push one combined history entry only if something
// actually changed" logic the Save button uses.
export function useEditHistory(options: UseEditHistoryOptions) {
  const [undoStack, setUndoStack] = useState<EditHistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<EditHistoryEntry[]>([]);

  async function applyEditSnapshot(id: number, snap: EditSnapshot) {
    await Promise.all([
      options.onSaveTitle(id, snap.title),
      options.onSaveDescription(id, snap.description),
      options.onSaveDueDate(id, snap.dueDate, snap.dueTime),
      options.onSavePriority(id, snap.priority),
      options.onSaveRecurrence(id, snap.recurrence),
      options.onSaveReminder(id, snap.reminderAt, snap.reminderRepeat),
      options.onSaveHighlightColor(id, snap.highlightColor),
      options.onSaveEstimate(id, snap.estimatedMinutes),
    ]);
  }

  // Committing a fresh edit invalidates whatever was in the redo stack, same
  // as any standard undo/redo — there's no sensible "redo" once a new edit
  // has branched off from that point in history.
  function pushEditHistory(entry: EditHistoryEntry) {
    setUndoStack((prev) => [...prev, entry]);
    setRedoStack([]);
  }

  async function handleUndo() {
    const entry = undoStack[undoStack.length - 1];
    if (!entry) return;
    setUndoStack((prev) => prev.slice(0, -1));
    await entry.undo();
    setRedoStack((prev) => [...prev, entry]);
  }

  async function handleRedo() {
    const entry = redoStack[redoStack.length - 1];
    if (!entry) return;
    setRedoStack((prev) => prev.slice(0, -1));
    await entry.redo();
    setUndoStack((prev) => [...prev, entry]);
  }

  // The task detail modal's Save button funnels through this: snapshot the
  // task's current field values, apply the new ones, and — only if
  // something actually changed — push one combined undo/redo entry that
  // reverts/reapplies every field together, matching the single Save click
  // that produced them.
  async function commitTaskEdit(task: Task, after: EditSnapshot) {
    const before = toEditSnapshot(task);
    await applyEditSnapshot(task.id, after);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      pushEditHistory({
        undo: () => applyEditSnapshot(task.id, before),
        redo: () => applyEditSnapshot(task.id, after),
      });
    }
  }

  return { undoStack, redoStack, handleUndo, handleRedo, commitTaskEdit };
}
