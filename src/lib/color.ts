// The app's one danger/destructive/overdue red — previously repeated as a
// bare hex literal in App.tsx, TaskRow.tsx, and TrashView.tsx (delete
// buttons, the Overdue section, overdue due-date badges). Deliberately
// distinct from lib/priority.ts's "high priority" color and lib/tagColor.ts's
// palette entry, which happen to share this exact value but represent
// unrelated concepts that could diverge independently later.
export const DANGER_COLOR = "#c9184a";

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
