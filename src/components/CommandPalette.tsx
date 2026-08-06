import { useEffect, useRef, useState, KeyboardEvent } from "react";
import type { Task } from "../types";
import { fuzzyScore } from "../lib/fuzzy";
import { formatDateDisplay } from "../lib/date";

export interface PaletteCommand {
  id: string;
  label: string;
  run: () => void;
}

interface Props {
  tasks: Task[];
  commands: PaletteCommand[];
  onSelectTask: (task: Task) => void;
  onClose: () => void;
}

interface Entry {
  key: string;
  label: string;
  sublabel?: string;
  score: number;
  run: () => void;
}

const MAX_RESULTS = 20;

// Ctrl/⌘+K opens this over whatever's currently on screen — it deliberately
// searches every task (not just whatever the active view/filter happens to
// show), since the whole point is jumping straight to something without
// first navigating to wherever it lives. With no query typed, it falls back
// to just the command list (searching every task with an empty query would
// dump the entire task list, which isn't useful).
export default function CommandPalette({ tasks, commands, onSelectTask, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const trimmed = query.trim();

  const entries: Entry[] = trimmed
    ? [
        ...tasks.flatMap((t): Entry[] => {
          const score = fuzzyScore(trimmed, t.title);
          return score == null
            ? []
            : [
                {
                  key: `task-${t.id}`,
                  label: t.title,
                  sublabel: t.dueDate ? formatDateDisplay(t.dueDate) : undefined,
                  score,
                  run: () => onSelectTask(t),
                },
              ];
        }),
        ...commands.flatMap((c): Entry[] => {
          const score = fuzzyScore(trimmed, c.label);
          return score == null ? [] : [{ key: `cmd-${c.id}`, label: c.label, score, run: c.run }];
        }),
      ]
        .sort((a, b) => a.score - b.score)
        .slice(0, MAX_RESULTS)
    : commands.map((c) => ({ key: `cmd-${c.id}`, label: c.label, score: 0, run: c.run }));

  function runEntry(entry: Entry) {
    entry.run();
    onClose();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, entries.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const entry = entries[activeIndex];
      if (entry) runEntry(entry);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(28, 30, 27, 0.35)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
        zIndex: 40,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-card)",
          overflow: "hidden",
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Jump to a task or run a command…"
          style={{
            width: "100%",
            padding: "14px 16px",
            border: "none",
            borderBottom: "1px solid var(--color-border)",
            background: "none",
            color: "var(--color-text)",
            fontSize: 15,
            fontFamily: "inherit",
          }}
        />
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {entries.length === 0 && (
            <div style={{ padding: "14px 16px", color: "var(--color-text-faint)", fontSize: 13 }}>No matches.</div>
          )}
          {entries.map((entry, i) => (
            <div
              key={entry.key}
              onClick={() => runEntry(entry)}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "10px 16px",
                cursor: "pointer",
                background: i === activeIndex ? "var(--color-accent-soft)" : "none",
              }}
            >
              <span style={{ fontSize: 14, color: "var(--color-text)" }}>{entry.label}</span>
              {entry.sublabel && (
                <span style={{ fontSize: 12, color: "var(--color-text-faint)", whiteSpace: "nowrap" }}>
                  {entry.sublabel}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
