import { AppState } from 'react-native';

const mockPlayer = { volume: 1, seekTo: jest.fn(async () => {}), play: jest.fn() };
const mockSetAudioMode = jest.fn(async (_mode: unknown) => {});
const mockStore = new Map<string, string>();
let mockIdle = true;
let mockWriteFails = false;

const mockHaptic = jest.fn(async () => {});
jest.mock('expo-haptics', () => ({
  impactAsync: () => mockHaptic(),
  notificationAsync: () => mockHaptic(),
  ImpactFeedbackStyle: { Soft: 'soft', Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('expo-audio', () => ({
  setAudioModeAsync: (mode: unknown) => mockSetAudioMode(mode),
  createAudioPlayer: () => mockPlayer,
}));
jest.mock('@/services/lucidKeyValueStorage', () => ({
  getLucidKeyValueStorage: () => ({
    getItem: async (key: string) => mockStore.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      if (mockWriteFails) throw new Error('storage full');
      mockStore.set(key, value);
    },
  }),
}));
let mockIdleAnswer: Promise<boolean> | null = null;
jest.mock('@/services/nativeSpeechRecognition', () => ({
  isSpeechRecognitionIdle: async () => (mockIdleAnswer ? mockIdleAnswer : mockIdle),
}));

type Sounds = typeof import('../signatureSounds');
// The preference is cached for the app's life: each case starts from a fresh launch.
const launch = (): Sounds => {
  let sounds: Sounds | undefined;
  jest.isolateModules(() => { sounds = require('../signatureSounds'); });
  return sounds!;
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  mockStore.clear();
  mockIdle = true;
  mockIdleAnswer = null;
  mockWriteFails = false;
  jest.clearAllMocks();
  (AppState as { currentState: string }).currentState = 'active';
});

it('plays a cue that the ringer switch silences and that mixes with the dreamer’s music', async () => {
  launch().playSignature('seal');
  await settle();
  expect(mockSetAudioMode).toHaveBeenCalledWith(expect.objectContaining({
    playsInSilentMode: false,
    interruptionMode: 'mixWithOthers',
    allowsRecording: false,
  }));
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);
});

it('stays quiet once turned off, at the next launch too', async () => {
  await launch().setSignatureSoundsEnabled(false);
  const sounds = launch();
  expect(await sounds.getSignatureSoundsEnabled()).toBe(false);
  sounds.playSignature('painting');
  await settle();
  expect(mockSetAudioMode).not.toHaveBeenCalled();
  expect(mockPlayer.play).not.toHaveBeenCalled();
});

it('never touches the audio session under a live dictation or in the background', async () => {
  mockIdle = false;
  launch().playSignature('painting');
  await settle();
  mockIdle = true;
  (AppState as { currentState: string }).currentState = 'background';
  launch().playSignature('painting');
  await settle();
  expect(mockSetAudioMode).not.toHaveBeenCalled();
  expect(mockPlayer.play).not.toHaveBeenCalled();
  // Only the dictation case was felt: a late cue in the background does not buzz the pocket.
  expect(mockHaptic).toHaveBeenCalledTimes(1);
});

it('waits for a recording made without a dictation session, as Android falls back to', async () => {
  let sounds: Sounds | undefined;
  let microphone: typeof import('../microphoneHold') | undefined;
  jest.isolateModules(() => {
    sounds = require('../signatureSounds');
    microphone = require('../microphoneHold');
  });
  const release = microphone!.holdMicrophone();
  sounds!.playSignature('painting');
  await settle();
  expect(mockSetAudioMode).not.toHaveBeenCalled();
  release();
  release();
  sounds!.playSignature('painting');
  await settle();
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);
});

it('keeps the sounds on when turning them off could not be stored', async () => {
  const sounds = launch();
  expect(await sounds.getSignatureSoundsEnabled()).toBe(true);
  mockWriteFails = true;
  await expect(sounds.setSignatureSoundsEnabled(false)).rejects.toThrow('storage full');
  // What storage holds is read anew.
  expect(await sounds.getSignatureSoundsEnabled()).toBe(true);
  sounds.playSignature('seal');
  await settle();
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);
});

it('keeps a choice made while the setting was still being read', async () => {
  const sounds = launch();
  const reading = sounds.getSignatureSoundsEnabled();
  await sounds.setSignatureSoundsEnabled(false);
  expect(await reading).toBe(false);
  sounds.playSignature('seal');
  await settle();
  expect(mockPlayer.play).not.toHaveBeenCalled();
});

it('lets a recording that starts while a cue waits keep the audio session', async () => {
  let answer!: (idle: boolean) => void;
  mockIdleAnswer = new Promise((resolve) => {
    answer = resolve;
  });
  let sounds: Sounds | undefined;
  let microphone: typeof import('../microphoneHold') | undefined;
  jest.isolateModules(() => {
    sounds = require('../signatureSounds');
    microphone = require('../microphoneHold');
  });
  sounds!.playSignature('painting');
  // The cue now waits on the dictation's state, and the recording starts.
  await settle();
  const release = microphone!.holdMicrophone();
  answer(true);
  await settle();
  release();

  expect(mockSetAudioMode).not.toHaveBeenCalled();
  expect(mockPlayer.play).not.toHaveBeenCalled();
});

it('leaves the echo’s answer unfelt once the app is left', () => {
  jest.useFakeTimers();
  try {
    launch().playSignature('echo');
    (AppState as { currentState: string }).currentState = 'background';
    jest.advanceTimersByTime(1000);
    expect(mockHaptic).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});
