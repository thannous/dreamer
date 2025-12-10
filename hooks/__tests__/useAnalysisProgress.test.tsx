/**
 * @vitest-environment happy-dom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorType, type ClassifiedError } from '../../lib/errors';

// Mock useTranslation
vi.mock('../useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { useAnalysisProgress, AnalysisStep } from '../useAnalysisProgress';

describe('useAnalysisProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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
        await vi.runAllTimersAsync();
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
        await vi.runAllTimersAsync();
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
        await vi.runAllTimersAsync();
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
        await vi.runAllTimersAsync();
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
        await vi.advanceTimersByTimeAsync(250);
      });

      // Progress should be partially advanced
      expect(result.current.progress).toBeGreaterThan(0);
      expect(result.current.progress).toBeLessThan(25);

      // Complete animation
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(result.current.progress).toBe(25);
    });
  });
});
