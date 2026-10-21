import { useCallback, useRef, useState } from 'react';
import { useWindowDimensions, type ViewInstance } from 'react-native';

/** Web: keep the window coordinates used by the plain scroll view. */
export function useTrendsReveal(enabled: boolean, skyEnabled: boolean) {
  const { height } = useWindowDimensions();
  const [lit, setLit] = useState(0);
  const litRef = useRef(0);
  const nightsRef = useRef<ViewInstance | null>(null);
  const returnsRef = useRef<ViewInstance | null>(null);
  const skyRef = useRef<ViewInstance | null>(null);
  const reveal = useCallback(() => {
    if (!enabled) return;
    const probe = (ref: typeof nightsRef, bit: number) => {
      if ((litRef.current & bit) || !ref.current) return;
      ref.current.measureInWindow((_x, y) => {
        if ((litRef.current & bit) || !Number.isFinite(y) || y >= height - 80) return;
        litRef.current |= bit;
        setLit(litRef.current);
      });
    };
    probe(nightsRef, 1);
    probe(returnsRef, 2);
    if (skyEnabled) probe(skyRef, 4);
  }, [enabled, height, skyEnabled]);
  return {
    nightsRef, returnsRef, skyRef,
    nightsLit: Boolean(lit & 1), returnsLit: Boolean(lit & 2), skyLit: Boolean(lit & 4),
    onRevealLayout: reveal,
    onRevealScroll: enabled && (lit & (skyEnabled ? 7 : 3)) !== (skyEnabled ? 7 : 3) ? reveal : undefined,
  };
}
