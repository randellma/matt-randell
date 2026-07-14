import { useRef, useEffect } from 'preact/hooks';
import type { RefObject } from 'preact';

/** Past this many px dragged down, releasing dismisses rather than snaps back. */
const CLOSE_PX = 90;
/** A downward flick faster than this (px/ms) dismisses regardless of distance. */
const FLICK_V = 0.5;
/** Movement below this is treated as a tap, not the start of a drag. */
const SLOP = 6;

/**
 * Drag-to-dismiss for a bottom sheet. Attach the returned ref to the sheet
 * element (the scrolling panel itself). A downward drag that starts while the
 * panel is scrolled to the top moves the whole sheet with the finger; releasing
 * past a threshold — or on a quick flick — calls `onClose`, otherwise it springs
 * back. Content scrolling is untouched: we only hijack the gesture once it's
 * clearly a downward pull from the top, which also stops the page behind from
 * scroll-chaining when the sheet's content fits.
 *
 * Touch and pen only — desktop mice keep the backdrop / × to close.
 */
export function useSwipeToClose(open: boolean, onClose: () => void): RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null);
  // Keep the latest onClose without re-subscribing listeners each render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const el = ref.current;
    if (!el || !open) return;

    let startY = 0;
    let dy = 0;
    let lastY = 0;
    let lastT = 0;
    let vel = 0;
    let candidate = false; // pointer down, still deciding scroll vs. drag
    let dragging = false; // actively translating the sheet

    const setY = (y: number) => {
      el.style.transform = y ? `translateY(${y}px)` : '';
      el.style.opacity = y ? String(Math.max(0.4, 1 - y / 420)) : '';
    };

    const reset = () => {
      candidate = false;
      dragging = false;
      dy = 0;
      vel = 0;
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      candidate = true;
      dragging = false;
      startY = lastY = e.clientY;
      lastT = e.timeStamp;
      dy = 0;
      vel = 0;
    };

    const onMove = (e: PointerEvent) => {
      if (!candidate && !dragging) return;
      dy = e.clientY - startY;

      if (candidate && !dragging) {
        if (Math.abs(dy) < SLOP) return;
        // Only take over when pulling down from the very top; otherwise it's a
        // normal scroll and we bow out for the rest of the gesture.
        if (dy > 0 && el.scrollTop <= 0) {
          dragging = true;
          candidate = false;
          el.style.transition = 'none';
          try {
            el.setPointerCapture(e.pointerId);
          } catch {
            /* capture unsupported — move events still arrive */
          }
        } else {
          candidate = false;
          return;
        }
      }

      if (dragging) {
        e.preventDefault();
        const dt = e.timeStamp - lastT;
        if (dt > 0) vel = (e.clientY - lastY) / dt;
        lastY = e.clientY;
        lastT = e.timeStamp;
        setY(Math.max(0, dy));
      }
    };

    const onUp = () => {
      if (!dragging) {
        reset();
        return;
      }
      const shouldClose = dy > CLOSE_PX || vel > FLICK_V;
      reset();
      if (shouldClose) {
        el.style.transition = 'transform 0.2s ease-in, opacity 0.2s ease-in';
        el.style.transform = `translateY(${el.getBoundingClientRect().height}px)`;
        el.style.opacity = '0';
        window.setTimeout(() => onCloseRef.current(), 190);
      } else {
        el.style.transition = 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.24s ease';
        setY(0);
      }
    };

    // pointermove must be non-passive so preventDefault can stop scroll-chaining.
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove, { passive: false });
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, [open]);

  return ref;
}
