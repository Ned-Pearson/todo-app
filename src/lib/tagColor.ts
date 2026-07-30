export const TAG_COLOR_PALETTE = [
  "#e07a5f",
  "#3d5a80",
  "#81b29a",
  "#f2cc8f",
  "#9d4edd",
  "#588157",
  "#c9184a",
  "#277da1",
  "#f3722c",
  "#43aa8b",
  "#ff6392",
  "#6d597a",
];

export function pickUnusedColor(usedColors: string[]): string {
  const used = new Set(usedColors.map((c) => c.toLowerCase()));
  const available = TAG_COLOR_PALETTE.filter((c) => !used.has(c.toLowerCase()));
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)];
  }
  return `#${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0")}`;
}
