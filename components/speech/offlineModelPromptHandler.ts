import type { RefObject } from 'react';

import type { OfflineModelPromptHandler } from '@/services/nativeSpeechRecognition';

/**
 * The prompt handler of a screen that shows the download sheet itself: `isVisible` reads the
 * screen's ref each time it is asked. Built outside the component, as React Compiler does not
 * compile an object literal with a getter (see lib/attempt.ts).
 */
export function offlineModelPromptHandler(
  visible: RefObject<boolean>,
  show: OfflineModelPromptHandler['show']
): OfflineModelPromptHandler {
  return {
    get isVisible() {
      return visible.current;
    },
    show,
  };
}
