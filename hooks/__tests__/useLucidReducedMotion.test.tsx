/* @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

const mockUseOptionalLucidTrainer = jest.fn();
const mockUsePrefersReducedMotion = jest.fn();

jest.mock('@/context/lucidTrainerContextObject', () => ({
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

  // Dreamer bundles this hook through the shared auth sheet. Importing the
  // provider here shipped the whole Lucid domain, content and sync code
  // (about 700 KB of source) in the Dreamer bundle.
  it('reaches the Trainer through the context object alone, never through its provider', () => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const { join } = require('node:path') as typeof import('node:path');
    const read = (file: string) => readFileSync(join(__dirname, '../..', file), 'utf8');
    const runtimeImports = (source: string) =>
      [...source.matchAll(/^import\s+(?!type\b)[^;]*?from\s+'([^']+)'/gm)].map((match) => match[1]);

    expect(runtimeImports(read('hooks/useLucidReducedMotion.ts'))).not.toContain('@/context/LucidTrainerContext');
    expect(runtimeImports(read('context/lucidTrainerContextObject.ts'))).toEqual(['react']);
  });
});
