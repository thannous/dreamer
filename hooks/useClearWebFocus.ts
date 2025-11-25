import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { blurActiveElement } from '@/lib/accessibility';

/**
 * On web, React Navigation hides inactive screens with `aria-hidden`.
 * If a child remains focused when the screen blurs, the browser warns.
 * This hook clears focus whenever the screen loses focus or unmounts.
 */
export function useClearWebFocus() {
  useFocusEffect(
    useCallback(() => {
      return () => {
        blurActiveElement();
      };
    }, [])
  );
}
