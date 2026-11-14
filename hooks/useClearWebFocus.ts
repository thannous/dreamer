import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { blurActiveElement } from '@/lib/accessibility';

function useClearFocusOnBlur() {
  useFocusEffect(
    useCallback(() => {
      return () => {
        blurActiveElement();
      };
    }, [])
  );
}

/**
 * On web, React Navigation hides inactive screens with `aria-hidden`.
 * If a child remains focused when the screen blurs, the browser warns.
 * This hook clears focus whenever the screen loses focus or unmounts.
 *
 * Only the web has such an element. On a phone the hook does nothing at all: the router's
 * focus effect renders the screen that calls it once more after it mounts.
 */
export const useClearWebFocus: () => void = process.env.EXPO_OS === 'web' ? useClearFocusOnBlur : () => {};
