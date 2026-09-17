import React from 'react';
import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import { InteractiveBreathHalo } from '@/components/onboarding/InteractiveBreathHalo';
import { useWorldSoundscape } from '@/hooks/useWorldSoundscape';
import * as audio from '@/services/audioService';
jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@/components/ui', () => ({ Text: jest.requireActual('react-native').Text }));
jest.mock('@/context/LanguageContext', () => ({ useTranslation: () => ({ t: (s: string) => s }) }));
jest.mock('@/context/BreathContext', () => {
  const stable = { progress: { get: () => 0 }, isStill: true,
    holdAtExhale: jest.fn(), playOneCycle: jest.fn(), resumeAmbient: jest.fn() };
  return { useBreath: () => stable };
});
jest.mock('expo-haptics', () => ({
  AndroidHaptics: { Confirm: 'confirm' }, ImpactFeedbackStyle: { Soft: 'soft' },
  performAndroidHapticsAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/audioService', () => ({
  configureAudioSession: jest.fn().mockResolvedValue(undefined),
  configureLocalCueSession: jest.fn().mockResolvedValue(undefined),
  resolvePlayableSource: jest.fn(async (source) => source),
  createPlayer: jest.fn(), createLocalCuePlayer: jest.fn(),
  play: jest.fn(), pause: jest.fn(), release: jest.fn(), seekTo: jest.fn(),
  setLoop: jest.fn(), setRate: jest.fn(), setVolume: jest.fn(),
}));
describe.each(['world', 'halo'] as const)('%s deferred cue lifetime', (surface) => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.mocked(audio.createPlayer).mockImplementation(() => ({} as audio.PlayerHandle));
    jest.mocked(audio.createLocalCuePlayer).mockImplementation(() => ({} as audio.PlayerHandle));
    jest.mocked(audio.seekTo).mockResolvedValue(undefined);
  });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });
  async function start() {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    jest.mocked(audio.seekTo).mockReturnValueOnce(promise);
    let unmount!: () => void;
    if (surface === 'world') {
      const view = renderHook(() => useWorldSoundscape('constellation', true));
      unmount = view.unmount;
      await act(async () => {});
    } else {
      const view = render(<InteractiveBreathHalo />);
      unmount = view.unmount;
      fireEvent.press(view.getByRole('button'));
    }
    expect(audio.seekTo).toHaveBeenCalled();
    jest.mocked(audio.play).mockClear();
    return { resolve, reject, unmount };
  }
  it.each(['resolve', 'reject'] as const)('does not play after cleanup when seek %ss', async (outcome) => {
    const pending = await start();
    pending.unmount();
    await act(async () => {
      if (outcome === 'resolve') pending.resolve();
      else pending.reject(new Error('seek failed'));
    });
    expect(audio.release).toHaveBeenCalled();
    expect(audio.play).not.toHaveBeenCalled();
  });
  it('keeps fallback playback when seek fails while the cue is current', async () => {
    const pending = await start();
    await act(async () => { pending.reject(new Error('seek failed')); });
    expect(audio.play).toHaveBeenCalledTimes(1);
    pending.unmount();
  });
});
