/* global describe, it, expect */
const {
  evaluateLucidMicrophoneContract,
  LUCID_LOCAL_MICROPHONE_PERMISSION,
} = require('./lucid-microphone-contract');

const validConfig = {
  plugins: [
    ['expo-audio', { microphonePermission: LUCID_LOCAL_MICROPHONE_PERMISSION }],
  ],
  android: {
    permissions: ['android.permission.RECORD_AUDIO'],
    blockedPermissions: ['android.permission.READ_EXTERNAL_STORAGE'],
  },
  ios: {
    infoPlist: {
      NSMicrophoneUsageDescription: LUCID_LOCAL_MICROPHONE_PERMISSION,
    },
  },
};

describe('Lucid morning-voice microphone contract', () => {
  it('accepts RECORD_AUDIO with a local-only expo-audio usage string and no speech collection', () => {
    expect(evaluateLucidMicrophoneContract(validConfig)).toMatchObject({ ok: true });
  });

  it('rejects the previous speech-collection-removed contract', () => {
    expect(
      evaluateLucidMicrophoneContract({
        plugins: [['expo-audio', { microphonePermission: false }]],
        android: {
          permissions: [],
          blockedPermissions: ['android.permission.RECORD_AUDIO'],
        },
        ios: { infoPlist: {} },
      }).ok
    ).toBe(false);
  });

  it('rejects speech recognition leftovers even when the microphone is allowed', () => {
    expect(
      evaluateLucidMicrophoneContract({
        ...validConfig,
        plugins: [...validConfig.plugins, 'expo-speech-recognition'],
        ios: {
          infoPlist: {
            NSMicrophoneUsageDescription: LUCID_LOCAL_MICROPHONE_PERMISSION,
            NSSpeechRecognitionUsageDescription: 'Allow speech recognition.',
          },
        },
      }).ok
    ).toBe(false);
  });
});
