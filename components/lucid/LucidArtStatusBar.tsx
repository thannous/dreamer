import { useIsFocused } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useId, useState, type ReactNode, type RefObject } from 'react';
import { Platform, StatusBar } from 'react-native';

export type LucidArtStatusBarController = RefObject<((overArt: boolean) => void) | null>;

type LucidArtStatusBarRegistry = {
  setOverArt: (screenId: string, active: boolean) => void;
  active: boolean;
};

const LucidArtStatusBarContext = createContext<LucidArtStatusBarRegistry | null>(null);

export function LucidArtStatusBarProvider({ children }: { children: ReactNode }) {
  const [activeIds, setActiveIds] = useState<ReadonlySet<string>>(() => new Set());
  const setOverArt = useCallback((screenId: string, active: boolean) => {
    setActiveIds((current) => {
      const has = current.has(screenId);
      if (has === active) return current;
      const next = new Set(current);
      if (active) next.add(screenId);
      else next.delete(screenId);
      return next;
    });
  }, []);
  const value = React.useMemo(
    () => ({ setOverArt, active: activeIds.size > 0 }),
    [activeIds.size, setOverArt]
  );
  return (
    <LucidArtStatusBarContext.Provider value={value}>
      {children}
    </LucidArtStatusBarContext.Provider>
  );
}

export function useLucidArtStatusBarActive(): boolean {
  return useContext(LucidArtStatusBarContext)?.active ?? false;
}

/**
 * Light clock and battery while night artwork sits under them. Tabs stay
 * mounted, so only the focused screen may push this entry; the root layout's
 * theme style (`pageBar`) comes back once the page scrolls onto its light ground.
 *
 * On iOS with UIViewControllerBasedStatusBarAppearance, react-native-screens
 * delegates preferredStatusBarStyle to the active native-stack RNSScreen rather
 * than ExpoRootViewController. Notifying LucidArtStatusBarProvider keeps the
 * stack screen's `statusBarStyle` in sync with the night hero and scroll state,
 * while React Native's StatusBar stack continues to drive Android immediately.
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
  const screenId = useId();
  const registry = useContext(LucidArtStatusBarContext);
  const setOverArt = registry?.setOverArt;

  useEffect(() => {
    if (!focused || Platform.OS === 'web') return undefined;
    let entry: ReturnType<typeof StatusBar.pushStackEntry> | null = null;
    const apply = (next: boolean, now: boolean) => {
      if (next === (entry !== null)) return;
      if (next) entry = StatusBar.pushStackEntry({ barStyle: 'light-content', animated: false });
      else if (entry) {
        StatusBar.popStackEntry(entry);
        entry = null;
      }
      setOverArt?.(screenId, next);
      if (!now) return;
      // The stack applies the same style on the next tick, which is then a no-op.
      const style = next ? 'light' : pageBar;
      StatusBar.setBarStyle(`${style}-content`, false);
    };
    apply(overArtRef.current === true, false);
    controllerRef.current = (next) => apply(next, true);
    return () => {
      controllerRef.current = null;
      if (entry) StatusBar.popStackEntry(entry);
      setOverArt?.(screenId, false);
    };
  }, [controllerRef, focused, overArtRef, pageBar, screenId, setOverArt]);
  return null;
}
