import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { hasAiConsent } from '@/lib/aiConsent';
import { captureHasAnswer } from '@/lib/captureEditableDraft';
import { formatCaptureNarrative } from '@/services/captureConversation';
import { createCaptureReviewPreparation } from '@/services/captureReviewPreparation';

/** The screen remounts for another account, so a preparation ends with its screen. */
export function useCaptureReviewPreparation(language: string) {
  const [operation] = useState(createCaptureReviewPreparation);
  const state = useSyncExternalStore(operation.subscribe, operation.getSnapshot, operation.getSnapshot);
  useEffect(() => operation.cancel, [operation]);

  const prepare = useCallback((readSource: () => Promise<string>) => operation.prepare({
    readSource,
    weave: async (source, signal) => {
      if (!captureHasAnswer(source) || !(await hasAiConsent()) || signal.aborted) return null;
      return formatCaptureNarrative(source, language, signal);
    },
  }), [language, operation]);

  return { state, prepare, cancel: operation.cancel, getSnapshot: operation.getSnapshot };
}
