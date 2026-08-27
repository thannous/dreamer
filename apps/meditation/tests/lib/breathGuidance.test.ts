import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

import {
  BREATH_HAPTIC_SIGNATURES,
  playBreathHaptic,
  speakBreathPhase,
  stopBreathVoice,
} from '@/lib/breathGuidance';

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Heavy: 'heavy', Rigid: 'rigid', Soft: 'soft' },
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
}));

describe('breathGuidance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps one distinct haptic signature per phase, including the first breath', async () => {
    const methods = Object.values(BREATH_HAPTIC_SIGNATURES).map((signature) =>
      signature.method === 'impactAsync'
        ? `${signature.method}:${signature.style}`
        : signature.method
    );

    expect(new Set(methods).size).toBe(4);

    await playBreathHaptic('inhale');
    await playBreathHaptic('hold');
    await playBreathHaptic('exhale');
    await playBreathHaptic('rest');

    expect(Haptics.impactAsync).toHaveBeenNthCalledWith(1, 'heavy');
    expect(Haptics.impactAsync).toHaveBeenNthCalledWith(2, 'rigid');
    expect(Haptics.impactAsync).toHaveBeenNthCalledWith(3, 'soft');
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('drops a queued utterance before speaking a later phase', async () => {
    await speakBreathPhase('Breathe in', 'en');

    expect(Speech.stop).toHaveBeenCalledTimes(1);
    expect(Speech.speak).toHaveBeenCalledWith('Breathe in', {
      language: 'en-US',
      pitch: 1,
      rate: 0.9,
    });
    expect(jest.mocked(Speech.stop).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(Speech.speak).mock.invocationCallOrder[0]
    );
  });

  it('speaks localised copy and stops on cleanup', async () => {
    await speakBreathPhase('Inspirez', 'fr');
    expect(Speech.speak).toHaveBeenCalledWith('Inspirez', expect.objectContaining({
      language: 'fr-FR',
    }));

    await stopBreathVoice();
    expect(Speech.stop).toHaveBeenCalled();
  });
});
