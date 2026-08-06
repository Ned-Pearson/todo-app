// Starts a drag-to-resize interaction for a horizontally-adjustable panel.
// Not a hook — it doesn't call any React hooks itself, just closes over the
// width/setter passed in and attaches plain DOM listeners for the duration
// of the drag, removing them on mouseup. "grow-right" means dragging the
// handle right increases width (e.g. the left sidebar); "grow-left" means
// dragging it left does (e.g. a right-docked panel).
export function startResize(
  e: React.MouseEvent,
  startWidth: number,
  setWidth: (width: number) => void,
  { min, max, direction }: { min: number; max: number; direction: "grow-right" | "grow-left" }
): void {
  e.preventDefault();
  const startX = e.clientX;
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";

  function onMouseMove(moveEvent: MouseEvent) {
    const delta = moveEvent.clientX - startX;
    const signedDelta = direction === "grow-right" ? delta : -delta;
    setWidth(Math.min(max, Math.max(min, startWidth + signedDelta)));
  }
  function onMouseUp() {
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
}
