import { describe, it, expect } from "vitest";
import { nextRecurrenceDate, previewOccurrences, type RecurrenceInput } from "./recurrence";
import type { Recurrence } from "../types";

function makeRecurrence(overrides: Partial<Recurrence> = {}): Recurrence {
  return { id: 0, frequency: "daily", interval: 1, endDate: null, occurrencesLeft: null, weekdays: null, ...overrides };
}

describe("nextRecurrenceDate", () => {
  it("uses weekday mode for weekly recurrences with weekdays set", () => {
    // 2026-08-05 is a Wednesday; next Mon/Wed/Fri match is Friday.
    const rec = makeRecurrence({ frequency: "weekly", weekdays: [1, 3, 5] });
    expect(nextRecurrenceDate("2026-08-05", rec)).toBe("2026-08-07");
  });

  it("falls back to plain interval mode when weekdays is empty", () => {
    const rec = makeRecurrence({ frequency: "weekly", interval: 2, weekdays: [] });
    expect(nextRecurrenceDate("2026-08-05", rec)).toBe("2026-08-19");
  });

  it("falls back to plain interval mode when weekdays is null", () => {
    const rec = makeRecurrence({ frequency: "weekly", interval: 1, weekdays: null });
    expect(nextRecurrenceDate("2026-08-05", rec)).toBe("2026-08-12");
  });

  it("ignores weekdays entirely for non-weekly frequencies", () => {
    const rec = makeRecurrence({ frequency: "daily", interval: 3, weekdays: [1, 3, 5] });
    expect(nextRecurrenceDate("2026-08-05", rec)).toBe("2026-08-08");
  });
});

describe("previewOccurrences", () => {
  const base: RecurrenceInput = { frequency: "daily", interval: 1, endDate: "", occurrences: null, weekdays: null };

  it("returns nothing for an empty anchor date", () => {
    expect(previewOccurrences("", base, 5)).toEqual([]);
  });

  it("projects `count` occurrences with no caps", () => {
    expect(previewOccurrences("2026-08-05", base, 5)).toEqual([
      "2026-08-06",
      "2026-08-07",
      "2026-08-08",
      "2026-08-09",
      "2026-08-10",
    ]);
  });

  it("stops early once the occurrence cap is reached (cap counts the anchor itself)", () => {
    // occurrences: 3 means anchor + 2 more — the preview only shows the 2 future ones.
    expect(previewOccurrences("2026-08-05", { ...base, occurrences: 3 }, 5)).toEqual(["2026-08-06", "2026-08-07"]);
  });

  it("projects nothing when occurrences is already down to 1 (anchor is the last one)", () => {
    expect(previewOccurrences("2026-08-05", { ...base, occurrences: 1 }, 5)).toEqual([]);
  });

  it("stops once a projected date would pass the end date", () => {
    expect(previewOccurrences("2026-08-05", { ...base, endDate: "2026-08-07" }, 5)).toEqual([
      "2026-08-06",
      "2026-08-07",
    ]);
  });

  it("uses weekday mode when frequency is weekly and weekdays is set", () => {
    const input: RecurrenceInput = { frequency: "weekly", interval: 1, endDate: "", occurrences: null, weekdays: [1, 3, 5] };
    expect(previewOccurrences("2026-08-05", input, 4)).toEqual([
      "2026-08-07",
      "2026-08-10",
      "2026-08-12",
      "2026-08-14",
    ]);
  });
});
