// Auto-scrolls the main task list while a row is being dragged near its top
// or bottom edge, so reordering across a list too long to fit on screen
// doesn't require the mouse to leave the visible area. Not a hook — mirrors
// resize.ts's shape (plain functions closing over module state for the
// duration of an interaction) rather than threading a scroll-container ref
// down through TaskRow's already-large, recursively-passed prop list.
//
// Scoped to task-row drags specifically: TaskRow's own dragstart/dragend
// call start/stop here, so dragging a list around in the sidebar (a
// separate, non-scrolling drag) never triggers this — there's nothing to
// mix up in practice anyway, since the sidebar and main column are disjoint
// regions and a dragover over one never fires on the other, but scoping it
// explicitly means this only ever runs while it actually means something.
const EDGE_ZONE_PX = 60;
const MAX_SCROLL_SPEED_PX = 14;

let container: HTMLElement | null = null;
let latestClientY: number | null = null;
let frame: number | null = null;

function tick() {
  if (container && latestClientY != null) {
    const rect = container.getBoundingClientRect();
    const distanceFromTop = latestClientY - rect.top;
    const distanceFromBottom = rect.bottom - latestClientY;
    if (distanceFromTop >= 0 && distanceFromTop < EDGE_ZONE_PX) {
      container.scrollTop -= MAX_SCROLL_SPEED_PX * (1 - distanceFromTop / EDGE_ZONE_PX);
    } else if (distanceFromBottom >= 0 && distanceFromBottom < EDGE_ZONE_PX) {
      container.scrollTop += MAX_SCROLL_SPEED_PX * (1 - distanceFromBottom / EDGE_ZONE_PX);
    }
  }
  frame = requestAnimationFrame(tick);
}

export function startTaskDragAutoScroll(scrollContainer: HTMLElement) {
  container = scrollContainer;
  latestClientY = null;
  if (frame == null) frame = requestAnimationFrame(tick);
}

// Called on every dragover within the scroll container (not just over a
// row) so the edge zones work even over the padding above the first row or
// below the last one, not just while literally hovering another task.
export function updateTaskDragPosition(clientY: number) {
  latestClientY = clientY;
}

export function stopTaskDragAutoScroll() {
  container = null;
  latestClientY = null;
  if (frame != null) {
    cancelAnimationFrame(frame);
    frame = null;
  }
}
