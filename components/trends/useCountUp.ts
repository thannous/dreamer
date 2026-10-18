import { useEffect, useRef, useState } from 'react';

const COUNT_MS = 900;
const STEP_MS = 50;

/**
 * A whole number that travels to its value instead of jumping: from zero the first time
 * (`fromZero`), then from the value it showed to each new one. With `still` (reduced
 * motion, or nothing to arrive), it is the value at once.
 */
export function useCountUp(target: number, { fromZero, still, delay = 0 }: {
  fromZero: boolean;
  still: boolean;
  delay?: number;
}): number {
  const [shown, setShown] = useState(() => (fromZero && !still ? 0 : target));
  const shownRef = useRef(shown);
  // Held still, the value is the target; keep the state there too, so leaving reduced
  // motion later starts from what was on screen, not from a value seen before it.
  if (still && shown !== target) setShown(target);

  useEffect(() => {
    const from = shownRef.current;
    if (still) {
      shownRef.current = target;
      return;
    }
    if (from === target) return;
    let frame = 0;
    let started: number | null = null;
    let drawn = -Infinity;
    const step = (time: number) => {
      started ??= time;
      const progress = Math.min(1, (time - started) / COUNT_MS);
      // Each value shown costs a render; past about twenty a second the eye reads no
      // more of them, so the frames between are skipped.
      if (progress < 1 && time - drawn < STEP_MS) {
        frame = requestAnimationFrame(step);
        return;
      }
      drawn = time;
      // Decelerates into the value, like everything that arrives.
      const next = Math.round(from + (target - from) * (1 - (1 - progress) ** 3));
      shownRef.current = next;
      setShown(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    const timer = setTimeout(() => { frame = requestAnimationFrame(step); }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [delay, still, target]);

  return still ? target : shown;
}
