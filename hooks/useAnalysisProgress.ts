import { useState, useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { ClassifiedError } from '@/lib/errors';
import { useTranslation } from '@/hooks/useTranslation';

export enum AnalysisStep {
  IDLE = 'idle',
  ANALYZING = 'analyzing',
  GENERATING_IMAGE = 'generating_image',
  FINALIZING = 'finalizing',
  COMPLETE = 'complete',
  ERROR = 'error',
}

type AnalysisProgressState = {
  step: AnalysisStep;
  progress: number;
  messageKey: string;
  error: ClassifiedError | null;
  customMessage?: string;
};

const STEP_CONFIG: Record<AnalysisStep, { progress: number; messageKey: string }> = {
  [AnalysisStep.IDLE]: {
    progress: 0,
    messageKey: 'analysis.step.ready',
  },
  [AnalysisStep.ANALYZING]: {
    progress: 25,
    messageKey: 'analysis.step.analyzing',
  },
  [AnalysisStep.GENERATING_IMAGE]: {
    progress: 65,
    messageKey: 'analysis.step.generating_image',
  },
  [AnalysisStep.FINALIZING]: {
    progress: 90,
    messageKey: 'analysis.step.finalizing',
  },
  [AnalysisStep.COMPLETE]: {
    progress: 100,
    messageKey: 'analysis.step.complete',
  },
  [AnalysisStep.ERROR]: {
    progress: 0,
    messageKey: 'analysis.step.error',
  },
};

// A gentle tick on each analysis milestone, a stronger cue on completion/error.
const triggerStepHaptic = (step: AnalysisStep) => {
  if (Platform.OS === 'web') {
    return;
  }
  switch (step) {
    case AnalysisStep.ANALYZING:
    case AnalysisStep.GENERATING_IMAGE:
    case AnalysisStep.FINALIZING:
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;
    case AnalysisStep.COMPLETE:
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;
    case AnalysisStep.ERROR:
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      break;
    default:
      break;
  }
};

export function useAnalysisProgress() {
  const { t } = useTranslation();
  const [state, setState] = useState<AnalysisProgressState>({
    step: AnalysisStep.IDLE,
    progress: 0,
    messageKey: STEP_CONFIG[AnalysisStep.IDLE].messageKey,
    error: null,
  });

  // Track the target progress for smooth animation
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Deduplicate haptics when the same step is set repeatedly
  const lastHapticStepRef = useRef<AnalysisStep>(AnalysisStep.IDLE);

  // Ensure we clean up any running interval when the hook's owner unmounts
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
    };
  }, []);

  const animateProgress = useCallback((targetProgress: number) => {
    if (animationRef.current) {
      clearInterval(animationRef.current);
    }

    setState((prev) => {
      const startProgress = prev.progress;
      const diff = targetProgress - startProgress;
      const duration = 500; // 500ms animation
      const steps = 20;
      const increment = diff / steps;
      let currentStep = 0;

      animationRef.current = setInterval(() => {
        currentStep++;
        if (currentStep >= steps) {
          setState((p) => ({ ...p, progress: targetProgress }));
          if (animationRef.current) {
            clearInterval(animationRef.current);
            animationRef.current = null;
          }
        } else {
          setState((p) => ({ ...p, progress: startProgress + increment * currentStep }));
        }
      }, duration / steps);

      return prev;
    });
  }, []);

  const setStep = useCallback(
    (step: AnalysisStep) => {
      const config = STEP_CONFIG[step];
      setState((prev) => ({
        ...prev,
        step,
        messageKey: config.messageKey,
        error: null,
        customMessage: undefined,
      }));
      animateProgress(config.progress);
      if (step !== lastHapticStepRef.current) {
        lastHapticStepRef.current = step;
        triggerStepHaptic(step);
      }
    },
    [animateProgress]
  );

  const setError = useCallback((error: ClassifiedError) => {
    if (animationRef.current) {
      clearInterval(animationRef.current);
      animationRef.current = null;
    }
    setState({
      step: AnalysisStep.ERROR,
      progress: 0,
      messageKey: STEP_CONFIG[AnalysisStep.ERROR].messageKey,
      error,
      customMessage: error.userMessage,
    });
    if (lastHapticStepRef.current !== AnalysisStep.ERROR) {
      lastHapticStepRef.current = AnalysisStep.ERROR;
      triggerStepHaptic(AnalysisStep.ERROR);
    }
  }, []);

  const reset = useCallback(() => {
    if (animationRef.current) {
      clearInterval(animationRef.current);
      animationRef.current = null;
    }
    lastHapticStepRef.current = AnalysisStep.IDLE;
    setState({
      step: AnalysisStep.IDLE,
      progress: 0,
      messageKey: STEP_CONFIG[AnalysisStep.IDLE].messageKey,
      error: null,
      customMessage: undefined,
    });
  }, []);

  return {
    step: state.step,
    progress: state.progress,
    message: state.customMessage ?? t(state.messageKey),
    error: state.error,
    setStep,
    setError,
    reset,
  };
}
