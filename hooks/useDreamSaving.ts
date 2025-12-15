import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { QUOTAS } from '@/constants/limits';
import { useAuth } from '@/context/AuthContext';
import { useDreams } from '@/context/DreamsContext';
import { useQuota } from '@/hooks/useQuota';
import { useTranslation } from '@/hooks/useTranslation';
import { isGuestDreamLimitReached } from '@/lib/guestLimits';
import { buildDraftDream as buildDraftDreamPure } from '@/lib/dreamUtils';
import { classifyError, QuotaError, QuotaErrorCode } from '@/lib/errors';
import type { DreamAnalysis } from '@/lib/types';
import { categorizeDream } from '@/services/geminiService';
import { getGuestRecordedDreamCount } from '@/services/quota/GuestDreamCounter';

export interface UseDreamSavingOptions {
  /** Callback after successful save */
  onSaveComplete?: (dream: DreamAnalysis, previousCount: number) => void;
  /** Callback when analysis completes */
  onAnalysisComplete?: (dream: DreamAnalysis) => void;
  /** Callback when guest limit is reached */
  onGuestLimitReached?: (dream: DreamAnalysis) => void;
}

export function useDreamSaving(options: UseDreamSavingOptions = {}) {
  const { addDream, dreams, analyzeDream } = useDreams();
  const { user } = useAuth();
  const { canAnalyzeNow, tier } = useQuota();
  const { t, currentLang } = useTranslation();

  const [isPersisting, setIsPersisting] = useState(false);
  const [draftDream, setDraftDream] = useState<DreamAnalysis | null>(null);

  const buildDraftDream = useCallback(
    (transcript: string): DreamAnalysis =>
      buildDraftDreamPure(transcript, {
        defaultTitle: t('recording.draft.default_title'),
      }),
    [t]
  );

  const saveDream = useCallback(
    async (transcript: string): Promise<DreamAnalysis | null> => {
      const trimmedTranscript = transcript.trim();
      if (!trimmedTranscript) {
        Alert.alert(t('recording.alert.empty.title'), t('recording.alert.empty.message'));
        return null;
      }

      // Check guest limit
      if (!user) {
        const used = await getGuestRecordedDreamCount(dreams.length);
        if (isGuestDreamLimitReached(used)) {
          const draft = draftDream && draftDream.transcript === trimmedTranscript
            ? draftDream
            : buildDraftDream(trimmedTranscript);
          options.onGuestLimitReached?.(draft);
          return null;
        }
      }

      setIsPersisting(true);
      try {
        const preCount = dreams.length;

        let dreamToSave = draftDream && draftDream.transcript === trimmedTranscript
          ? draftDream
          : buildDraftDream(trimmedTranscript);

        // Attempt quick categorization if we have a transcript
        if (trimmedTranscript) {
          try {
            const metadata = await categorizeDream(trimmedTranscript, currentLang);
            dreamToSave = {
              ...dreamToSave,
              ...metadata,
            };
          } catch (err) {
            if (__DEV__) {
              console.warn('[DreamSaving] Quick categorization failed:', err);
            }
          }
        }

        const savedDream = await addDream(dreamToSave);
        setDraftDream(savedDream);
        options.onSaveComplete?.(savedDream, preCount);
        return savedDream;
      } catch (error) {
        if (error instanceof QuotaError && error.code === QuotaErrorCode.GUEST_LIMIT_REACHED) {
          const draft = draftDream && draftDream.transcript === trimmedTranscript
            ? draftDream
            : buildDraftDream(trimmedTranscript);
          options.onGuestLimitReached?.(draft);
          return null;
        }
        const message = error instanceof Error ? error.message : 'Unexpected error occurred. Please try again.';
        Alert.alert(t('common.error_title'), message);
        return null;
      } finally {
        setIsPersisting(false);
      }
    },
    [addDream, buildDraftDream, currentLang, draftDream, dreams.length, options, t, user]
  );

  const analyzeAndSaveDream = useCallback(
    async (
      dream: DreamAnalysis,
      onProgress?: { setStep: (step: number) => void; setError: (error: unknown) => void; reset: () => void }
    ): Promise<DreamAnalysis | null> => {
      if (!canAnalyzeNow) {
        const limit = QUOTAS[tier].analysis ?? 0;
        const title = tier === 'guest'
          ? t('recording.alert.analysis_limit.title_guest')
          : t('recording.alert.analysis_limit.title_free');
        const message = tier === 'guest'
          ? t('recording.alert.analysis_limit.message_guest', { limit })
          : t('recording.alert.analysis_limit.message_free', { limit });

        Alert.alert(
          title,
          message,
          [
            {
              text: t('recording.alert.limit.cta'),
              onPress: () => router.push('/(tabs)/settings'),
            },
            { text: t('common.cancel'), style: 'cancel' },
          ]
        );
        return null;
      }

      setIsPersisting(true);
      try {
        onProgress?.reset();
        onProgress?.setStep(1); // ANALYZING

        const analyzedDream = await analyzeDream(dream.id, dream.transcript, { lang: currentLang });

        onProgress?.setStep(3); // COMPLETE
        options.onAnalysisComplete?.(analyzedDream);

        await new Promise((resolve) => setTimeout(resolve, 300));
        return analyzedDream;
      } catch (error) {
        if (error instanceof QuotaError) {
          const title = error.tier === 'guest'
            ? t('recording.alert.analysis_limit.title_guest')
            : t('recording.alert.analysis_limit.title_free');
          Alert.alert(
            title,
            error.userMessage,
            [
              {
                text: t('recording.alert.limit.cta'),
                onPress: () => router.push('/(tabs)/settings'),
              },
              { text: t('common.cancel'), style: 'cancel' },
            ]
          );
          onProgress?.reset();
        } else {
          const classified = classifyError(error as Error);
          onProgress?.setError(classified);
        }
        return null;
      } finally {
        setIsPersisting(false);
      }
    },
    [analyzeDream, canAnalyzeNow, currentLang, options, t, tier]
  );

  const resetDraft = useCallback(() => {
    setDraftDream(null);
  }, []);

  return {
    isPersisting,
    draftDream,
    setDraftDream,
    saveDream,
    analyzeAndSaveDream,
    buildDraftDream,
    resetDraft,
  };
}
