import type { Priority } from "../types";

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
