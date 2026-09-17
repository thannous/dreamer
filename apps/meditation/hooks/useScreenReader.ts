import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

let lastKnownScreenReaderState: boolean | null = null;

/**
 * Whether a screen reader is running.
 *
 * Used to decide whether to speak something that has no visual equivalent,
 * and to unwrap nested horizontal rails that TalkBack cannot leave.
 */
export function useScreenReader(): boolean {
  const [enabled, setEnabled] = useState(lastKnownScreenReaderState ?? false);

  useEffect(() => {
    let mounted = true;
    const update = (value: boolean) => {
      lastKnownScreenReaderState = value;
      if (mounted) setEnabled(value);
    };

    AccessibilityInfo.isScreenReaderEnabled()
      .then(update)
      .catch(() => {
        // Unsupported platform — assume none, and announce nothing.
      });

    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', update);

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return enabled;
}
