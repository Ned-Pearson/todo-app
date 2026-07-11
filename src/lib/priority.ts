import type { Priority } from "../types";

export const PRIORITY_LEVELS: Priority[] = ["high", "medium", "low"];

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  high: "#c9184a",
  medium: "#f2994a",
  low: "#3d5a80",
};

const PRIORITY_RANK: Record<Priority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function priorityRank(priority: Priority | null): number {
  return priority ? PRIORITY_RANK[priority] : 0;
}
