import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Hook to run callbacks when the app transitions between background/foreground.
 *
 * @param onForeground Called when app becomes active from background/inactive
 * @param onBackground Called when app leaves active state
 */
export function useAppState(
  onForeground?: () => void,
  onBackground?: () => void
) {
  const appState = useRef(AppState.currentState);
  const onForegroundRef = useRef(onForeground);
  const onBackgroundRef = useRef(onBackground);

  useEffect(() => {
    onForegroundRef.current = onForeground;
  }, [onForeground]);

  useEffect(() => {
    onBackgroundRef.current = onBackground;
  }, [onBackground]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        onForegroundRef.current?.();
      } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        onBackgroundRef.current?.();
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
