import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { GUEST_DREAM_LIMIT } from '@/constants/limits';
import { useAuth } from '@/context/AuthContext';
import { useDreams } from '@/context/DreamsContext';
import { useQuota } from '@/hooks/useQuota';
import { useTranslation } from '@/hooks/useTranslation';
import { classifyError, QuotaError } from '@/lib/errors';
import type { DreamAnalysis } from '@/lib/types';
import { categorizeDream } from '@/services/geminiService';

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
  const { canAnalyzeNow } = useQuota();
  const { t } = useTranslation();

  const [isPersisting, setIsPersisting] = useState(false);
  const [draftDream, setDraftDream] = useState<DreamAnalysis | null>(null);

  const deriveDraftTitle = useCallback((transcript: string) => {
    const trimmed = transcript.trim();
    if (!trimmed) {
      return t('recording.draft.default_title');
    }
    const firstLine = trimmed.split('\n')[0]?.trim() ?? '';
    if (!firstLine) {
      return t('recording.draft.default_title');
    }
    return firstLine.length > 64 ? `${firstLine.slice(0, 64)}…` : firstLine;
  }, [t]);

  const buildDraftDream = useCallback((transcript: string): DreamAnalysis => {
    const trimmed = transcript.trim();
    const title = deriveDraftTitle(trimmed);
    return {
      id: Date.now(),
      transcript: trimmed,
      title,
      interpretation: '',
      shareableQuote: '',
      theme: undefined,
      dreamType: 'Symbolic Dream',
      imageUrl: '',
      thumbnailUrl: undefined,
      chatHistory: trimmed
        ? [{ role: 'user', text: `Here is my dream: ${trimmed}` }]
        : [],
      isFavorite: false,
      imageGenerationFailed: false,
      isAnalyzed: false,
      analysisStatus: 'none',
    };
  }, [deriveDraftTitle]);

  const saveDream = useCallback(
    async (transcript: string): Promise<DreamAnalysis | null> => {
      const trimmedTranscript = transcript.trim();
      if (!trimmedTranscript) {
        Alert.alert(t('recording.alert.empty.title'), t('recording.alert.empty.message'));
        return null;
      }

      // Check guest limit
      if (!user && dreams.length >= GUEST_DREAM_LIMIT - 1) {
        const draft = draftDream && draftDream.transcript === trimmedTranscript
          ? draftDream
          : buildDraftDream(trimmedTranscript);
        options.onGuestLimitReached?.(draft);
        return null;
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
            const metadata = await categorizeDream(trimmedTranscript);
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
        const message = error instanceof Error ? error.message : 'Unexpected error occurred. Please try again.';
        Alert.alert(t('common.error_title'), message);
        return null;
      } finally {
        setIsPersisting(false);
      }
    },
    [addDream, buildDraftDream, draftDream, dreams.length, options, t, user]
  );

  const analyzeAndSaveDream = useCallback(
    async (
      dream: DreamAnalysis,
      onProgress?: { setStep: (step: number) => void; setError: (error: unknown) => void; reset: () => void }
    ): Promise<DreamAnalysis | null> => {
      if (!canAnalyzeNow) {
        const tier = user ? 'free' : 'guest';
        const limit = tier === 'guest' ? 2 : 5;
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

        const analyzedDream = await analyzeDream(dream.id, dream.transcript);

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
    [analyzeDream, canAnalyzeNow, options, t, user]
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
