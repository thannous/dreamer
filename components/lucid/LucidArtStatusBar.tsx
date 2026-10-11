import { useIsFocused } from 'expo-router';
import { useEffect, type RefObject } from 'react';
import { Platform, StatusBar } from 'react-native';
import { SystemBars, type SystemBarsEntry } from 'react-native-edge-to-edge';

export type LucidArtStatusBarController = RefObject<((overArt: boolean) => void) | null>;

/**
 * Light clock and battery while night artwork sits under them. Tabs stay
 * mounted, so only the focused screen may push this entry; the root layout's
 * theme style (`pageBar`) comes back once the page scrolls onto its light ground.
 *
 * The screen flips it from its scroll handler through `controllerRef`, in the same
 * event that swaps the status bar veils: a `SystemBars` element would wait for a
 * re-render and the next tick, and fade on iOS, leaving light icons over the
 * light veil (or dark icons over the night) for a few hundred milliseconds.
 */
export function LucidArtStatusBar({
  overArtRef,
  controllerRef,
  pageBar,
}: {
  overArtRef: RefObject<boolean>;
  controllerRef: LucidArtStatusBarController;
  pageBar: 'light' | 'dark';
}) {
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return undefined;
    let entry: SystemBarsEntry | null = null;
    const apply = (next: boolean, now: boolean) => {
      if (next === (entry !== null)) return;
      if (next) entry = SystemBars.pushStackEntry({ style: { statusBar: 'light' } });
      else if (entry) {
        SystemBars.popStackEntry(entry);
        entry = null;
      }
      if (!now) return;
      // The stack applies the same style on the next tick, which is then a no-op.
      const style = next ? 'light' : pageBar;
      if (Platform.OS === 'ios') StatusBar.setBarStyle(`${style}-content`, false);
      else SystemBars.setStyle({ statusBar: style });
    };
    apply(overArtRef.current === true, false);
    controllerRef.current = (next) => apply(next, true);
    return () => {
      controllerRef.current = null;
      if (entry) SystemBars.popStackEntry(entry);
    };
  }, [controllerRef, focused, overArtRef, pageBar]);
  return null;
}
