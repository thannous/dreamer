import { useCallback, useState, useSyncExternalStore } from 'react';
import { useDreamsActions, useDreamsData } from '@/context/DreamsContext';
import { hasAiConsent } from '@/lib/aiConsent';
import { trackDreamSaveMilestone } from '@/lib/analytics';
import { captureHasAnswer } from '@/lib/captureEditableDraft';
import { AiConsentWithdrawnError } from '@/lib/errors';
import { getInitialDreamCategorizationKey, trackInitialDreamCategorization } from '@/lib/initialDreamCategorization';
import { markPerformance, performanceTraceId } from '@/lib/performanceTrace';
import type { DreamAnalysis } from '@/lib/types';
import { recordBadgeEvent } from '@/services/badgeLedgerStore';
import { createCaptureSave, type CaptureToSave } from '@/services/captureSave';
import { categorizeDream } from '@/services/geminiService';

type SaveOptions = {
  prepare: () => Promise<CaptureToSave>;
  buildDream: (transcript: string) => DreamAnalysis;
  clearDraft: () => void;
  language: string;
  onCategorizationError: (error: unknown) => void;
};

/** React binding and post-commit enrichment; the screen owns presentation/navigation. */
export function useCaptureSave() {
  const { dreams } = useDreamsData();
  const { addDream, applyDreamCategorization } = useDreamsActions();
  const [operation] = useState(createCaptureSave);
  const state = useSyncExternalStore(operation.subscribe, operation.getSnapshot, operation.getSnapshot);

  const save = useCallback(async ({ prepare, buildDream, clearDraft, language, onCategorizationError }: SaveOptions) => {
    let isNewDream = false;
    let trace: number | undefined;
    const saved = await operation.save({
      prepare,
      buildDream,
      persist: async dream => {
        isNewDream = !dreams.some(existing => existing.id === dream.id);
        trace = performanceTraceId(`capture:${dream.clientRequestId ?? dream.id}`);
        markPerformance('journal.save_requested', { trace });
        const result = await addDream(dream);
        markPerformance('journal.save_acknowledged', { trace });
        return result;
      },
    });
    if (!saved) return null;

    // Only the durable journal acknowledgement may clear the recoverable draft.
    clearDraft();
    if (isNewDream) {
      void trackDreamSaveMilestone(dreams.length === 0);
      recordBadgeEvent({ type: 'dream_saved', dream: saved.dream, voiced: saved.capture.voiced,
        answered: captureHasAnswer(saved.capture.originalTranscript ?? saved.capture.transcript) });
    }
    // Navigation never waits for consent, categorization or its network failures.
    void trackInitialDreamCategorization(getInitialDreamCategorizationKey(saved.dream), async () => {
      if (!(await hasAiConsent())) return;
      const categorization = await categorizeDream(saved.capture.transcript, language);
      await applyDreamCategorization(saved.dream.id, categorization);
    }).catch((error: unknown) => {
      if (!(error instanceof AiConsentWithdrawnError)) onCategorizationError(error);
    });
    return { ...saved, isNewDream, trace };
  }, [addDream, applyDreamCategorization, dreams, operation]);

  return { state, save, reset: operation.reset };
}
