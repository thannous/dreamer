import { useState, useCallback, useRef } from 'react';
import type { ClassifiedError } from '@/lib/errors';

export enum AnalysisStep {
  IDLE = 'idle',
  ANALYZING = 'analyzing',
  GENERATING_IMAGE = 'generating_image',
  FINALIZING = 'finalizing',
  COMPLETE = 'complete',
  ERROR = 'error',
}

export interface AnalysisProgress {
  step: AnalysisStep;
  progress: number; // 0-100
  message: string;
  error: ClassifiedError | null;
}

const STEP_CONFIG: Record<AnalysisStep, { progress: number; message: string }> = {
  [AnalysisStep.IDLE]: {
    progress: 0,
    message: 'Ready to analyze',
  },
  [AnalysisStep.ANALYZING]: {
    progress: 25,
    message: 'Analyzing your dream...',
  },
  [AnalysisStep.GENERATING_IMAGE]: {
    progress: 65,
    message: 'Generating dream imagery...',
  },
  [AnalysisStep.FINALIZING]: {
    progress: 90,
    message: 'Almost done...',
  },
  [AnalysisStep.COMPLETE]: {
    progress: 100,
    message: 'Complete',
  },
  [AnalysisStep.ERROR]: {
    progress: 0,
    message: 'Error occurred',
  },
};

export function useAnalysisProgress() {
  const [state, setState] = useState<AnalysisProgress>({
    step: AnalysisStep.IDLE,
    progress: 0,
    message: STEP_CONFIG[AnalysisStep.IDLE].message,
    error: null,
  });

  // Track the target progress for smooth animation
  const animationRef = useRef<NodeJS.Timeout | null>(null);

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
        message: config.message,
        error: null,
      }));
      animateProgress(config.progress);
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
      message: error.userMessage,
      error,
    });
  }, []);

  const reset = useCallback(() => {
    if (animationRef.current) {
      clearInterval(animationRef.current);
      animationRef.current = null;
    }
    setState({
      step: AnalysisStep.IDLE,
      progress: 0,
      message: STEP_CONFIG[AnalysisStep.IDLE].message,
      error: null,
    });
  }, []);

  return {
    ...state,
    setStep,
    setError,
    reset,
  };
}
