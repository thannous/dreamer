import { useCallback, useState } from 'react';
import { useWindowDimensions, type ViewInstance } from 'react-native';
import { measure, useAnimatedReaction, useAnimatedRef, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useHeaderScrollY } from '@/components/ui/scrollDepth';

/**
 * Native: measure section tops on the UI thread after layout, then compare the
 * scroll offset there. Only a newly visible section needs a JavaScript call.
 * Window/section/content layout invalidates the cached positions; a period change
 * keeps sections that have already lit, just as revisiting the tab does.
 */
export function useTrendsReveal(enabled: boolean, skyEnabled: boolean) {
  const { height } = useWindowDimensions();
  const scrollY = useHeaderScrollY();
  const nightsRef = useAnimatedRef<ViewInstance>();
  const returnsRef = useAnimatedRef<ViewInstance>();
  const skyRef = useAnimatedRef<ViewInstance>();
  const layout = useSharedValue(0);
  const tops = useSharedValue<(number | null)[]>([null, null, null]);
  const revealed = useSharedValue(0);
  const [lit, setLit] = useState(0);
  const required = skyEnabled ? 7 : 3;
  const light = useCallback((mask: number) => { setLit((current) => current | mask); }, []);
  const onRevealLayout = useCallback(() => { layout.set((version) => version + 1); }, [layout]);

  useAnimatedReaction(
    () => enabled && (lit & required) !== required ? { y: scrollY.get(), layout: layout.get() } : null,
    (frame, previous) => {
      if (!frame) return;
      const before = revealed.get();
      if ((before & required) === required) return;
      const positions = !previous || frame.layout !== previous.layout
        ? [null, null, null] : [...tops.get()];
      let mask = before;
      // Only unlit, mounted sections are measured. Once known, a top stays valid
      // until layout changes; scrolling itself performs no native measurement.
      if (!(mask & 1)) {
        const box = positions[0] === null ? measure(nightsRef) : null;
        if (box && box.height > 0) positions[0] = box.pageY + frame.y;
        if (positions[0] !== null && positions[0] - frame.y < height - 80) mask |= 1;
      }
      if (!(mask & 2)) {
        const box = positions[1] === null ? measure(returnsRef) : null;
        if (box && box.height > 0) positions[1] = box.pageY + frame.y;
        if (positions[1] !== null && positions[1] - frame.y < height - 80) mask |= 2;
      }
      if (skyEnabled && !(mask & 4)) {
        const box = positions[2] === null ? measure(skyRef) : null;
        if (box && box.height > 0) positions[2] = box.pageY + frame.y;
        if (positions[2] !== null && positions[2] - frame.y < height - 80) mask |= 4;
      }
      tops.set(positions);
      if (mask !== before) {
        revealed.set(mask);
        scheduleOnRN(light, mask);
      }
    },
  );

  return {
    nightsRef, returnsRef, skyRef,
    nightsLit: Boolean(lit & 1), returnsLit: Boolean(lit & 2), skyLit: Boolean(lit & 4),
    onRevealLayout,
    onRevealScroll: undefined,
  };
}
