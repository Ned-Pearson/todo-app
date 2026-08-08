import { describe, it, expect, afterEach, vi } from "vitest";
import { lastNDays, buildDailyCounts, computeStreaks, weekStartOf, buildWeeklyCounts } from "./stats";
import { makeTask } from "./taskFixtures";

describe("lastNDays", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns n consecutive dates ending on today", () => {
    vi.setSystemTime(new Date(2026, 7, 5));
    expect(lastNDays(5)).toEqual(["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05"]);
  });
});

describe("buildDailyCounts", () => {
  it("only counts completed tasks that have a completedAt timestamp", () => {
    const tasks = [
      makeTask({ id: 1, completed: true, completedAt: "2026-08-05 09:00" }),
      makeTask({ id: 2, completed: true, completedAt: "2026-08-05 18:00" }),
      makeTask({ id: 3, completed: true, completedAt: "2026-08-04 12:00" }),
      makeTask({ id: 4, completed: false, completedAt: null }),
      makeTask({ id: 5, completed: true, completedAt: null }), // shouldn't happen in practice, but guarded against
    ];
    const counts = buildDailyCounts(tasks);
    expect(counts.get("2026-08-05")).toBe(2);
    expect(counts.get("2026-08-04")).toBe(1);
    expect(counts.has("2026-08-06")).toBe(false);
  });
});

describe("computeStreaks", () => {
  const days = ["d1", "d2", "d3", "d4", "d5", "d6", "d7"]; // d7 is "today"

  it("counts every day when the whole window is active", () => {
    const counts = new Map(days.map((d) => [d, 1]));
    expect(computeStreaks(counts, days)).toEqual({ current: 7, longest: 7 });
  });

  it("doesn't let an empty today zero out an in-progress streak", () => {
    const counts = new Map<string, number>([
      ["d1", 1], ["d2", 1], ["d3", 0], ["d4", 1], ["d5", 1], ["d6", 1], ["d7", 0],
    ]);
    expect(computeStreaks(counts, days)).toEqual({ current: 3, longest: 3 });
  });

  it("zeroes the current streak once yesterday is also empty", () => {
    const counts = new Map<string, number>([
      ["d1", 1], ["d2", 1], ["d3", 1], ["d4", 1], ["d5", 1], ["d6", 0], ["d7", 0],
    ]);
    expect(computeStreaks(counts, days)).toEqual({ current: 0, longest: 5 });
  });

  it("bounds the current streak to the trailing run even when longest is elsewhere", () => {
    const counts = new Map<string, number>([
      ["d1", 1], ["d2", 1], ["d3", 0], ["d4", 1], ["d5", 1], ["d6", 1], ["d7", 1],
    ]);
    expect(computeStreaks(counts, days)).toEqual({ current: 4, longest: 4 });
  });

  it("returns zeroes for a completely empty window", () => {
    expect(computeStreaks(new Map(), days)).toEqual({ current: 0, longest: 0 });
  });
});

describe("weekStartOf", () => {
  it("returns the Sunday of the week containing the given date", () => {
    expect(weekStartOf("2026-08-05")).toBe("2026-08-02"); // Wednesday -> that week's Sunday
  });

  it("returns the date itself when it's already a Sunday", () => {
    expect(weekStartOf("2026-08-09")).toBe("2026-08-09");
  });
});

describe("buildWeeklyCounts", () => {
  it("sums each day's count into its containing week's bucket", () => {
    const days = [
      "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05",
      "2026-08-06", "2026-08-07", "2026-08-08", "2026-08-09",
    ];
    const counts = new Map([
      ["2026-08-02", 1],
      ["2026-08-05", 2],
      ["2026-08-09", 3],
    ]);
    const weekly = buildWeeklyCounts(counts, days);
    expect(weekly.get("2026-08-02")).toBe(3); // Aug 2 + Aug 5, same week
    expect(weekly.get("2026-08-09")).toBe(3); // Aug 9 starts a new week (it's a Sunday)
  });
});
