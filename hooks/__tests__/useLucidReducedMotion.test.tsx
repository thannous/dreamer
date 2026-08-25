/* @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

const mockUseOptionalLucidTrainer = jest.fn();
const mockUsePrefersReducedMotion = jest.fn();

jest.mock('@/context/LucidTrainerContext', () => ({
  useOptionalLucidTrainer: () => mockUseOptionalLucidTrainer(),
}));

jest.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => mockUsePrefersReducedMotion(),
}));

const { useLucidReducedMotion } = require('../useLucidReducedMotion');

describe('useLucidReducedMotion', () => {
  beforeEach(() => {
    mockUseOptionalLucidTrainer.mockReset();
    mockUsePrefersReducedMotion.mockReset();
    mockUseOptionalLucidTrainer.mockReturnValue(null);
    mockUsePrefersReducedMotion.mockReturnValue(false);
  });

  it('is off when neither Trainer nor the system asks to reduce motion', () => {
    const { result } = renderHook(() => useLucidReducedMotion());
    expect(result.current).toBe(false);
  });

  it('follows the Trainer preference even when the system still allows motion', () => {
    mockUseOptionalLucidTrainer.mockReturnValue({
      state: { onboarding: { accessibility: { reduceMotion: true } } },
    });

    const { result } = renderHook(() => useLucidReducedMotion());
    expect(result.current).toBe(true);
  });

  it('follows the system setting when Trainer has not opted in', () => {
    mockUsePrefersReducedMotion.mockReturnValue(true);

    const { result } = renderHook(() => useLucidReducedMotion());
    expect(result.current).toBe(true);
  });

  it('stays usable without a Trainer provider', () => {
    mockUseOptionalLucidTrainer.mockReturnValue(null);
    mockUsePrefersReducedMotion.mockReturnValue(true);

    const { result } = renderHook(() => useLucidReducedMotion());
    expect(result.current).toBe(true);
  });
});
