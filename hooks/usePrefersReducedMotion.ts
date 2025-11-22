import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Detects whether the user has enabled system-level "reduce motion".
 * Falls back to false if the platform does not support the check.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) {
          setPrefersReducedMotion(enabled);
        }
      })
      .catch(() => {
        // ignore – feature not supported on all platforms
      });

    const subscription = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      (enabled: boolean) => {
        if (mounted) {
          setPrefersReducedMotion(enabled);
        }
      }
    );

    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  return prefersReducedMotion;
}
