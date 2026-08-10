/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { ErrorType, type ClassifiedError } from '../../lib/errors';
import { useAnalysisProgress, AnalysisStep } from '../useAnalysisProgress';

// Mock useTranslation
jest.mock('../useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));


describe('useAnalysisProgress', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initial state', () => {
    it('starts with IDLE step', () => {
      const { result } = renderHook(() => useAnalysisProgress());

      expect(result.current.step).toBe(AnalysisStep.IDLE);
      expect(result.current.progress).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it('returns translated message', () => {
      const { result } = renderHook(() => useAnalysisProgress());

      expect(result.current.message).toBe('analysis.step.ready');
    });
  });

  describe('setStep', () => {
    it('given ANALYZING step when setting then updates state', async () => {
      const { result } = renderHook(() => useAnalysisProgress());

      act(() => {
        result.current.setStep(AnalysisStep.ANALYZING);
      });

      expect(result.current.step).toBe(AnalysisStep.ANALYZING);
      expect(result.current.message).toBe('analysis.step.analyzing');

      // Progress animates to 25
      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(result.current.progress).toBe(25);
    });

    it('given GENERATING_IMAGE step when setting then updates state', async () => {
      const { result } = renderHook(() => useAnalysisProgress());

      act(() => {
        result.current.setStep(AnalysisStep.GENERATING_IMAGE);
      });

      expect(result.current.step).toBe(AnalysisStep.GENERATING_IMAGE);
      expect(result.current.message).toBe('analysis.step.generating_image');

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(result.current.progress).toBe(65);
    });

    it('given FINALIZING step when setting then updates state', async () => {
      const { result } = renderHook(() => useAnalysisProgress());

      act(() => {
        result.current.setStep(AnalysisStep.FINALIZING);
      });

      expect(result.current.step).toBe(AnalysisStep.FINALIZING);
      expect(result.current.message).toBe('analysis.step.finalizing');

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(result.current.progress).toBe(90);
    });

    it('given COMPLETE step when setting then updates state', async () => {
      const { result } = renderHook(() => useAnalysisProgress());

      act(() => {
        result.current.setStep(AnalysisStep.COMPLETE);
      });

      expect(result.current.step).toBe(AnalysisStep.COMPLETE);
      expect(result.current.message).toBe('analysis.step.complete');

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(result.current.progress).toBe(100);
    });

    it('clears error when setting new step', async () => {
      const { result } = renderHook(() => useAnalysisProgress());

      const error: ClassifiedError = {
        type: ErrorType.NETWORK,
        originalError: new Error('Test'),
        userMessage: 'Network error',
        canRetry: true,
        message: 'Network error',
      };

      act(() => {
        result.current.setError(error);
      });

      expect(result.current.error).toBe(error);

      act(() => {
        result.current.setStep(AnalysisStep.ANALYZING);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('setError', () => {
    it('given error when setting then updates state', () => {
      const { result } = renderHook(() => useAnalysisProgress());

      const error: ClassifiedError = {
        type: ErrorType.NETWORK,
        originalError: new Error('Test'),
        userMessage: 'Network error occurred',
        canRetry: true,
        message: 'Network error occurred',
      };

      act(() => {
        result.current.setError(error);
      });

      expect(result.current.step).toBe(AnalysisStep.ERROR);
      expect(result.current.error).toBe(error);
      expect(result.current.progress).toBe(0);
      expect(result.current.message).toBe('Network error occurred');
    });

    it('stops progress animation when error occurs', async () => {
      const { result } = renderHook(() => useAnalysisProgress());

      // Start animating
      act(() => {
        result.current.setStep(AnalysisStep.ANALYZING);
      });

      // Set error before animation completes
      const error: ClassifiedError = {
        type: ErrorType.SERVER,
        originalError: new Error('Server error'),
        userMessage: 'Server error',
        canRetry: true,
        message: 'Server error',
      };

      act(() => {
        result.current.setError(error);
      });

      // Progress should be reset to 0
      expect(result.current.progress).toBe(0);
    });
  });

  describe('reset', () => {
    it('given active state when resetting then returns to IDLE', () => {
      const { result } = renderHook(() => useAnalysisProgress());

      act(() => {
        result.current.setStep(AnalysisStep.ANALYZING);
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.step).toBe(AnalysisStep.IDLE);
      expect(result.current.progress).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it('given error state when resetting then clears error', () => {
      const { result } = renderHook(() => useAnalysisProgress());

      const error: ClassifiedError = {
        type: ErrorType.NETWORK,
        originalError: new Error('Test'),
        userMessage: 'Error',
        canRetry: true,
        message: 'Error',
      };

      act(() => {
        result.current.setError(error);
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.step).toBe(AnalysisStep.IDLE);
    });
  });

  describe('step haptics', () => {
    const initialPlatform = Platform.OS;

    beforeEach(() => {
      Platform.OS = 'ios';
      jest.clearAllMocks();
    });

    afterEach(() => {
      Platform.OS = initialPlatform;
    });

    it('fires a light impact on each analysis milestone', () => {
      const { result } = renderHook(() => useAnalysisProgress());

      act(() => {
        result.current.setStep(AnalysisStep.ANALYZING);
      });
      act(() => {
        result.current.setStep(AnalysisStep.GENERATING_IMAGE);
      });
      act(() => {
        result.current.setStep(AnalysisStep.FINALIZING);
      });

      expect(Haptics.impactAsync).toHaveBeenCalledTimes(3);
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    });

    it('does not repeat the haptic when the same step is set twice', () => {
      const { result } = renderHook(() => useAnalysisProgress());

      act(() => {
        result.current.setStep(AnalysisStep.ANALYZING);
      });
      act(() => {
        result.current.setStep(AnalysisStep.ANALYZING);
      });

      expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    });

    it('fires a success notification on completion', () => {
      const { result } = renderHook(() => useAnalysisProgress());

      act(() => {
        result.current.setStep(AnalysisStep.COMPLETE);
      });

      expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
      expect(Haptics.impactAsync).not.toHaveBeenCalled();
    });

    it('fires an error notification when the analysis fails', () => {
      const { result } = renderHook(() => useAnalysisProgress());

      const error: ClassifiedError = {
        type: ErrorType.NETWORK,
        originalError: new Error('Test'),
        userMessage: 'Network error',
        canRetry: true,
        message: 'Network error',
      };

      act(() => {
        result.current.setError(error);
      });

      expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
    });

    it('fires again after a reset restarts the flow', () => {
      const { result } = renderHook(() => useAnalysisProgress());

      act(() => {
        result.current.setStep(AnalysisStep.ANALYZING);
      });
      act(() => {
        result.current.reset();
      });
      act(() => {
        result.current.setStep(AnalysisStep.ANALYZING);
      });

      expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);
    });

    it('stays silent on web', () => {
      Platform.OS = 'web';
      const { result } = renderHook(() => useAnalysisProgress());

      act(() => {
        result.current.setStep(AnalysisStep.ANALYZING);
      });
      act(() => {
        result.current.setStep(AnalysisStep.COMPLETE);
      });

      expect(Haptics.impactAsync).not.toHaveBeenCalled();
      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('progress animation', () => {
    it('animates progress smoothly', async () => {
      const { result } = renderHook(() => useAnalysisProgress());

      act(() => {
        result.current.setStep(AnalysisStep.ANALYZING);
      });

      // Initial progress should still be 0
      expect(result.current.progress).toBe(0);

      // Advance some time
      await act(async () => {
        await jest.advanceTimersByTimeAsync(250);
      });

      // Progress should be partially advanced
      expect(result.current.progress).toBeGreaterThan(0);
      expect(result.current.progress).toBeLessThan(25);

      // Complete animation
      await act(async () => {
        await jest.advanceTimersByTimeAsync(300);
      });

      expect(result.current.progress).toBe(25);
    });
  });
});
