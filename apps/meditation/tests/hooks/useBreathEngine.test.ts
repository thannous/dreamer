import { act, renderHook } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import { PATTERN_BY_ID } from '@/content/breathing';
import { useBreathEngine } from '@/hooks/useBreathEngine';

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Heavy: 'heavy', Rigid: 'rigid', Soft: 'soft' },
  NotificationFeedbackType: { Warning: 'warning' },
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
}));

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
      started: true,
      status: 'finished',
    });
  });

  it('stays ready until start, then pauses and resumes from the same elapsed time', () => {
    const { result } = renderHook(() =>
      useBreathEngine({
        pattern: PATTERN_BY_ID.calm,
        durationMin: 1,
        hapticsEnabled: false,
      })
    );

    expect(result.current).toMatchObject({
      status: 'ready',
      running: false,
      started: false,
      remainingSec: 60,
      state: { phase: 'inhale', cycleIndex: 0 },
    });

    act(() => result.current.start());
    expect(result.current.status).toBe('active');
    expect(result.current.running).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    const remainingAfterRun = result.current.remainingSec;
    expect(remainingAfterRun).toBeLessThan(60);
    expect(result.current.started).toBe(true);

    act(() => result.current.pause());
    expect(result.current.status).toBe('paused');
    expect(result.current.running).toBe(false);
    expect(result.current.remainingSec).toBe(remainingAfterRun);

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current.remainingSec).toBe(remainingAfterRun);

    act(() => result.current.start());
    expect(result.current.status).toBe('active');
  });

  it('keeps phase haptics under reduced motion so vibration-only practice still works', () => {
    const { result } = renderHook(() =>
      useBreathEngine({
        pattern: PATTERN_BY_ID.calm,
        durationMin: 1,
        hapticsEnabled: true,
      })
    );

    act(() => result.current.start());
    act(() => {
      jest.advanceTimersByTime(4100);
    });

    expect(result.current.state.phase).toBe('exhale');
    expect(Haptics.impactAsync).toHaveBeenNthCalledWith(1, 'heavy');
    expect(Haptics.impactAsync).toHaveBeenNthCalledWith(2, 'soft');
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  });

  it('fires the first-phase haptic and stays silent when haptics are off', () => {
    const withHaptics = renderHook(() =>
      useBreathEngine({
        pattern: PATTERN_BY_ID.box,
        durationMin: 1,
        hapticsEnabled: true,
      })
    );

    act(() => withHaptics.result.current.start());
    expect(Haptics.impactAsync).toHaveBeenCalledWith('heavy');
    withHaptics.unmount();
    jest.clearAllMocks();

    const silent = renderHook(() =>
      useBreathEngine({
        pattern: PATTERN_BY_ID.box,
        durationMin: 1,
        hapticsEnabled: false,
      })
    );

    act(() => silent.result.current.start());
    act(() => {
      jest.advanceTimersByTime(4100);
    });

    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  });

  it('repeats the current phase signature after resume so haptic-only guidance restarts clearly', () => {
    const { result } = renderHook(() =>
      useBreathEngine({
        pattern: PATTERN_BY_ID.calm,
        durationMin: 1,
        hapticsEnabled: true,
      })
    );

    act(() => result.current.start());
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);

    act(() => result.current.pause());
    act(() => result.current.start());

    expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);
    expect(Haptics.impactAsync).toHaveBeenNthCalledWith(2, 'heavy');
  });
});
