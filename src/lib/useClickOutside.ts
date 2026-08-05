import { useEffect, useRef, type RefObject } from "react";

// Closes a popover/dropdown on any mousedown outside `ref`'s element, but only
// while `active` is true, so an idle popover doesn't pay for a document-wide
// listener. The wrapper `ref` is attached should contain BOTH the toggle
// button and the panel itself — otherwise clicking the toggle button to open
// it would immediately register as an "outside" click and re-close it.
// `onOutsideClick` is read through a ref rather than as an effect dependency,
// so callers can pass a fresh inline arrow function each render without
// needing to memoize it.
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  active: boolean,
  onOutsideClick: () => void
): void {
  const callbackRef = useRef(onOutsideClick);
  callbackRef.current = onOutsideClick;

  useEffect(() => {
    if (!active) return;
    function handlePointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callbackRef.current();
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [active, ref]);
}
