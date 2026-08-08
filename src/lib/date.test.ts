import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  formatDate,
  todayStr,
  nowTimestamp,
  datePartOf,
  formatDateDisplay,
  isOverdue,
  getWeekRange,
  nextWeekdayOccurrence,
  addInterval,
  nextReminderAfter,
} from "./date";

describe("formatDate", () => {
  it("zero-pads single-digit months and days", () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(formatDate(new Date(2026, 7, 9))).toBe("2026-08-09");
  });

  it("formats a normal date", () => {
    expect(formatDate(new Date(2026, 7, 5))).toBe("2026-08-05");
  });
});

describe("datePartOf", () => {
  it("strips a trailing time portion", () => {
    expect(datePartOf("2026-08-05 14:30")).toBe("2026-08-05");
  });

  it("passes a bare date through unchanged", () => {
    expect(datePartOf("2026-08-05")).toBe("2026-08-05");
  });
});

describe("formatDateDisplay", () => {
  it("reformats a bare ISO date to DD:MM:YYYY", () => {
    expect(formatDateDisplay("2026-08-05")).toBe("05:08:2026");
  });

  it("reformats an ISO date+time, leaving the time untouched", () => {
    expect(formatDateDisplay("2026-08-05 14:30")).toBe("05:08:2026 14:30");
  });

  it("passes non-ISO values through unchanged", () => {
    expect(formatDateDisplay("Unknown date")).toBe("Unknown date");
    expect(formatDateDisplay("")).toBe("");
  });
});

describe("nextWeekdayOccurrence", () => {
  it("finds the next matching weekday, skipping the given date itself", () => {
    // 2026-08-05 is a Wednesday (day 3); Mon/Wed/Fri = [1, 3, 5].
    expect(nextWeekdayOccurrence("2026-08-05", [1, 3, 5])).toBe("2026-08-07"); // Friday
  });

  it("wraps into the following week when the match is next Monday", () => {
    // 2026-08-07 is a Friday; next Mon/Wed/Fri match after it is Monday.
    expect(nextWeekdayOccurrence("2026-08-07", [1, 3, 5])).toBe("2026-08-10");
  });
});

describe("addInterval", () => {
  it("adds days/weeks/months/years", () => {
    expect(addInterval("2026-08-05", "daily", 5)).toBe("2026-08-10");
    expect(addInterval("2026-08-05", "weekly", 2)).toBe("2026-08-19");
    expect(addInterval("2026-08-05", "yearly", 1)).toBe("2027-08-05");
  });

  it("rolls over via native Date semantics when the day doesn't exist in the target month", () => {
    // Jan 31 + 1 month isn't "Feb 31" — JS Date rolls it into March.
    expect(addInterval("2026-01-31", "monthly", 1)).toBe("2026-03-03");
  });
});

describe("nextReminderAfter", () => {
  it("advances by exactly one interval when fired on time", () => {
    expect(nextReminderAfter("2026-08-10 09:00", "daily", "2026-08-10 09:01")).toBe("2026-08-11 09:00");
  });

  it("jumps straight past a multi-day backlog instead of replaying every missed occurrence", () => {
    expect(nextReminderAfter("2026-08-10 09:00", "daily", "2026-08-13 15:00")).toBe("2026-08-14 09:00");
  });

  it("handles a weekly backlog spanning nearly a month", () => {
    expect(nextReminderAfter("2026-08-03 09:00", "weekly", "2026-09-01 00:00")).toBe("2026-09-07 09:00");
  });

  it("defaults to 09:00 when reminderAt has no time portion", () => {
    expect(nextReminderAfter("2026-08-10", "daily", "2026-08-10 09:00")).toBe("2026-08-11 09:00");
  });
});

describe("functions that read the system clock", () => {
  beforeEach(() => {
    // Wednesday, 2026-08-05, 14:30 local time.
    vi.setSystemTime(new Date(2026, 7, 5, 14, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("todayStr reads today's date", () => {
    expect(todayStr()).toBe("2026-08-05");
  });

  it("nowTimestamp reads the current date and zero-padded HH:MM", () => {
    expect(nowTimestamp()).toBe("2026-08-05 14:30");
  });

  describe("isOverdue", () => {
    it("is never overdue with no due date, or once completed", () => {
      expect(isOverdue(null, null, false)).toBe(false);
      expect(isOverdue("2026-08-01", null, true)).toBe(false);
    });

    it("is overdue once the due date is in the past", () => {
      expect(isOverdue("2026-08-01", null, false)).toBe(true);
    });

    it("is not overdue for a future due date", () => {
      expect(isOverdue("2026-08-10", null, false)).toBe(false);
    });

    it("due today with no time set is not overdue", () => {
      expect(isOverdue("2026-08-05", null, false)).toBe(false);
    });

    it("due today only flips overdue once the specific time has passed", () => {
      expect(isOverdue("2026-08-05", "10:00", false)).toBe(true); // already past 14:30
      expect(isOverdue("2026-08-05", "18:00", false)).toBe(false); // still ahead
    });
  });

  describe("getWeekRange", () => {
    it("returns the Sunday-start week containing today", () => {
      expect(getWeekRange(0)).toEqual(["2026-08-02", "2026-08-08"]);
    });

    it("returns the Monday-start week containing today", () => {
      expect(getWeekRange(1)).toEqual(["2026-08-03", "2026-08-09"]);
    });
  });
});
