import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Anything that loops forever must stop when the user asks the system for less
 * motion. Vestibular disorders and slow ambient animation do not mix.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {
        // Unsupported platform — assume motion is fine.
      });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => setReduced(value)
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
