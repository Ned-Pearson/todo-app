import { REPEAT_LABELS, WEEKDAY_LABELS, previewOccurrences, buildRecurrenceInput, type RepeatOption } from "../lib/recurrence";
import { formatDateDisplay } from "../lib/date";

interface Props {
  dueDate: string;
  repeat: RepeatOption;
  setRepeat: (value: RepeatOption) => void;
  repeatInterval: number;
  setRepeatInterval: (value: number) => void;
  repeatEndDate: string;
  setRepeatEndDate: (value: string) => void;
  repeatOccurrences: string;
  setRepeatOccurrences: (value: string) => void;
  repeatWeekdays: number[];
  setRepeatWeekdays: (updater: (prev: number[]) => number[]) => void;
  // "from now" only makes sense once a series can already have run for a
  // while (TaskDetailModal, editing a possibly-live recurrence) — a brand
  // new task in AddTaskModal has no history yet, so it drops that clause.
  occurrencesTitle?: string;
  // AddTaskModal's copy used a slightly looser 20px rhythm than the rest of
  // its own form; TaskDetailModal (and everywhere else in the app) uses 16.
  // Kept as one small, explicit difference rather than silently overriding
  // AddTaskModal's spacing to match.
  sectionSpacing?: number;
}

// The full Repeat section — frequency/interval, end-date-or-occurrence-cap,
// the weekly weekday picker, and a live "Next: …" preview — shared by
// AddTaskModal and TaskDetailModal, which previously had byte-for-byte
// identical copies of all of this except for the two differences called out
// above. Deliberately still a controlled component (state stays owned by
// the parent, same useState calls as before) rather than owning its own
// state internally: both parents need the current value at Save/Add time,
// which a "lift state up via onChange" or ref-based design would only
// complicate for no benefit over just passing the existing state + setters
// straight through.
export default function RecurrenceEditor({
  dueDate,
  repeat,
  setRepeat,
  repeatInterval,
  setRepeatInterval,
  repeatEndDate,
  setRepeatEndDate,
  repeatOccurrences,
  setRepeatOccurrences,
  repeatWeekdays,
  setRepeatWeekdays,
  occurrencesTitle = "Stop after this many occurrences (optional)",
  sectionSpacing = 16,
}: Props) {
  const recurrenceInput = buildRecurrenceInput(repeat, repeatInterval, repeatEndDate, repeatOccurrences, repeatWeekdays);
  const occurrencePreview = recurrenceInput ? previewOccurrences(dueDate, recurrenceInput, 5) : [];

  return (
    <>
      <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
        Repeat
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: sectionSpacing }}>
        <select
          value={repeat}
          onChange={(e) => setRepeat(e.target.value as RepeatOption)}
          style={{
            padding: "6px 8px",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontSize: 13,
          }}
        >
          {(Object.keys(REPEAT_LABELS) as RepeatOption[]).map((option) => (
            <option key={option} value={option}>
              {REPEAT_LABELS[option]}
            </option>
          ))}
        </select>

        {repeat !== "none" && !(repeat === "weekly" && repeatWeekdays.length > 0) && (
          <>
            <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>every</span>
            <input
              type="number"
              min={1}
              value={repeatInterval}
              onChange={(e) => setRepeatInterval(Math.max(1, Number(e.target.value)))}
              style={{
                width: 50,
                padding: "6px 8px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
                fontSize: 13,
              }}
            />
            <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
              {repeat === "daily" && "day(s)"}
              {repeat === "weekly" && "week(s)"}
              {repeat === "monthly" && "month(s)"}
              {repeat === "yearly" && "year(s)"}
            </span>
          </>
        )}
        {repeat !== "none" && (
          <>
            <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>until</span>
            <input
              type="date"
              value={repeatEndDate}
              onChange={(e) => setRepeatEndDate(e.target.value)}
              style={{
                padding: "6px 8px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
                fontSize: 13,
              }}
            />
            <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>or after</span>
            <input
              type="number"
              min={1}
              value={repeatOccurrences}
              onChange={(e) => setRepeatOccurrences(e.target.value)}
              placeholder="∞"
              title={occurrencesTitle}
              style={{
                width: 50,
                padding: "6px 8px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
                fontSize: 13,
              }}
            />
            <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>time(s)</span>
          </>
        )}
      </div>

      {repeat === "weekly" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", marginBottom: sectionSpacing }}>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)", marginRight: 4 }}>On:</span>
          {WEEKDAY_LABELS.map((label, day) => {
            const selected = repeatWeekdays.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() =>
                  setRepeatWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()))
                }
                title={selected ? `Don't repeat on ${label}` : `Also repeat on ${label}`}
                aria-pressed={selected}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: "4px 8px",
                  borderRadius: "var(--radius-sm)",
                  border: selected ? "1px solid transparent" : "1px solid var(--color-border)",
                  background: selected ? "var(--color-accent)" : "none",
                  color: selected ? "#fff" : "var(--color-text-muted)",
                }}
              >
                {label}
              </button>
            );
          })}
          {repeatWeekdays.length === 0 && (
            <span style={{ fontSize: 11, color: "var(--color-text-faint)" }}>
              (none selected — uses "every N week(s)" above instead)
            </span>
          )}
        </div>
      )}

      {repeat !== "none" && (
        <div style={{ marginBottom: sectionSpacing }}>
          {!dueDate ? (
            <div style={{ fontSize: 11, color: "var(--color-text-faint)" }}>
              Pick a due date above to preview upcoming occurrences.
            </div>
          ) : occurrencePreview.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "var(--color-text-faint)" }}>Next:</span>
              {occurrencePreview.map((d) => (
                <span
                  key={d}
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-muted)",
                    background: "var(--color-surface-sunken)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "2px 6px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatDateDisplay(d)}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "var(--color-text-faint)" }}>
              No further occurrences — this would be the only one.
            </div>
          )}
        </div>
      )}
    </>
  );
}
