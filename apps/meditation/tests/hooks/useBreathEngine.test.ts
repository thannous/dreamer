import { act, renderHook } from '@testing-library/react-native';

import { PATTERN_BY_ID } from '@/content/breathing';
import { useBreathEngine } from '@/hooks/useBreathEngine';

jest.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));

describe('useBreathEngine', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stops on the tick that completes the exercise', () => {
    const { result } = renderHook(() =>
      useBreathEngine({
        pattern: PATTERN_BY_ID.calm,
        durationMin: 1 / 300,
        hapticsEnabled: false,
      })
    );

    act(() => result.current.start());
    expect(result.current.running).toBe(true);

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(result.current).toMatchObject({
      finished: true,
      remainingSec: 0,
      running: false,
    });
  });
});
