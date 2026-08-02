type RequestFrame = (callback: FrameRequestCallback) => number;
type CancelFrame = (handle: number) => void;

/**
 * Wait until one full frame has had a chance to paint before exposing the
 * startup destination. The second callback runs before the following frame,
 * so the destination mounted behind the splash is no longer revealed between
 * its layout commit and its first visible draw.
 */
export function scheduleAfterStartupPaint(
  callback: () => void,
  requestFrame: RequestFrame = requestAnimationFrame,
  cancelFrame: CancelFrame = cancelAnimationFrame
): () => void {
  let cancelled = false;
  let secondFrame: number | null = null;

  const firstFrame = requestFrame(() => {
    if (cancelled) return;

    secondFrame = requestFrame(() => {
      if (!cancelled) callback();
    });
  });

  return () => {
    cancelled = true;
    cancelFrame(firstFrame);
    if (secondFrame !== null) cancelFrame(secondFrame);
  };
}
