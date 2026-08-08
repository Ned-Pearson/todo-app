import { useEffect } from "react";
import { isPermissionGranted, sendNotification } from "@tauri-apps/plugin-notification";
import type { Task } from "../types";
import { nowTimestamp, nextReminderAfter } from "./date";
import { advanceTaskReminder, markReminderNotified } from "./db";
import { OVERDUE_CHECK_INTERVAL_MS } from "./appConstants";

// Standalone reminders: a nudge at reminderAt, independent of the due-date/
// overdue machinery elsewhere in the app (App.tsx's own checkOverdue effect)
// — it never implies the task is "due", so it doesn't touch that machinery's
// own snooze bookkeeping. A one-shot reminder (no reminderRepeat) is marked
// reminder_notified so it never re-fires; a repeating one instead rolls
// reminderAt forward to its next occurrence (via nextReminderAfter, which
// also catches up in one step if the app was closed past more than one
// interval, rather than replaying every missed occurrence) and leaves
// reminder_notified at 0 so it fires again next time. Changing the reminder
// (via updateTaskReminder, called elsewhere) always resets reminder_notified
// to schedule a fresh one.
export function useReminders(tasks: Task[], dndEnabled: boolean, reload: () => Promise<void>): void {
  useEffect(() => {
    async function checkReminders() {
      if (dndEnabled) return;
      const granted = await isPermissionGranted().catch(() => false);
      if (!granted) return;
      const now = nowTimestamp();
      const due = tasks.filter((t) => t.reminderAt && !t.reminderNotified && !t.completed && t.reminderAt <= now);
      if (due.length === 0) return;
      for (const task of due) {
        sendNotification({ title: "Reminder", body: task.title });
      }
      await Promise.all(
        due.map((t) =>
          t.reminderRepeat
            ? advanceTaskReminder(t.id, nextReminderAfter(t.reminderAt as string, t.reminderRepeat, now))
            : markReminderNotified(t.id)
        )
      );
      await reload();
    }

    checkReminders();
    const interval = window.setInterval(checkReminders, OVERDUE_CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
    // Deliberately omits `reload` — same as the pre-extraction effect this
    // was pulled out of, and App.tsx's sibling checkOverdue effect, both of
    // which only re-subscribe on tasks/dndEnabled changes rather than on
    // every render (reload is a fresh function reference each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, dndEnabled]);
}
