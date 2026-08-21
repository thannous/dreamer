import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether a screen reader is running.
 *
 * Used to decide whether to speak something that has no visual equivalent —
 * never to change what the app does, only what it announces.
 */
export function useScreenReader(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isScreenReaderEnabled()
      .then((value) => {
        if (mounted) setEnabled(value);
      })
      .catch(() => {
        // Unsupported platform — assume none, and announce nothing.
      });

    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', (value) =>
      setEnabled(value)
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return enabled;
}
