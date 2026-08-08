import type { CSSProperties } from "react";

// The base "surface card" look shared by every static content container in
// the app — task-list boxes, day-group panels, stat cards — before any
// per-site sizing/spacing/border-color override is added on top. Spread
// this rather than referencing it directly wherever a call site needs to
// override any single property (e.g. a colored border), since mutating a
// shared object would leak across every other user of it.
export const CARD_STYLE: CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
};

// Centered dialog boxes (Add Task, Add List, Manage Tags, Command Palette)
// — the same card look, just constrained to fill whatever maxWidth the
// backdrop's flex-centering gives it. maxWidth/padding still vary per modal
// (each dialog is a different size/layout), so those stay call-site overrides.
export const MODAL_STYLE: CSSProperties = {
  ...CARD_STYLE,
  width: "100%",
};

// Small anchored floating panels — dropdown menus, settings popovers — a
// tighter corner radius than a full card and always above everything else.
// Deliberately doesn't include position/top/left/right/width/padding, since
// those differ at every call site depending on what the popover is anchored
// to and how it's triggered (click vs. right-click).
export const POPOVER_STYLE: CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  boxShadow: "var(--shadow-card)",
  zIndex: 30,
};

// A single clickable row within a popover/menu — plain text button, no
// border or background of its own, full width of whatever panel it's in.
export const MENU_ITEM_STYLE: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "6px 8px",
  border: "none",
  background: "none",
  color: "var(--color-text)",
  fontSize: 13,
  borderRadius: "var(--radius-sm)",
};
