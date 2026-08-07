import { describe, it, expect } from "vitest";
import { formatDuration } from "./duration";

// A minimal smoke test proving the Vitest setup itself works end to end —
// real coverage of the rest of lib/ is a separate TODO item.
describe("formatDuration", () => {
  it("formats under a minute as M:SS", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(9)).toBe("0:09");
  });

  it("formats under an hour as M:SS", () => {
    expect(formatDuration(754)).toBe("12:34");
  });

  it("formats an hour or more as H:MM:SS", () => {
    expect(formatDuration(3661)).toBe("1:01:01");
  });

  it("floors fractional seconds and clamps negatives to zero", () => {
    expect(formatDuration(59.9)).toBe("0:59");
    expect(formatDuration(-5)).toBe("0:00");
  });
});
