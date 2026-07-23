import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const { mockPlatform, mockRequireOptionalNativeModule, mockOpenSettings } = ((factory: any) =>
  factory())(() => ({
  mockPlatform: { OS: 'android' as 'android' | 'ios' },
  mockRequireOptionalNativeModule: jest.fn(),
  mockOpenSettings: jest.fn(),
}));

jest.mock('react-native', () => ({
  Platform: mockPlatform,
}));

jest.mock('expo', () => ({
  requireOptionalNativeModule: mockRequireOptionalNativeModule,
}));

jest.mock('expo-linking', () => ({
  openSettings: mockOpenSettings,
}));

const {
  openGoogleAppSettings,
  openGoogleVoiceSettingsBestEffort,
  openSpeechRecognitionLanguageSettings,
} = require('../speechRecognitionSettings') as typeof import('../speechRecognitionSettings');

describe('speechRecognitionSettings', () => {
  const startActivity = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatform.OS = 'android';
    mockRequireOptionalNativeModule.mockReturnValue({ startActivity });
    startActivity.mockResolvedValue(undefined);
    mockOpenSettings.mockResolvedValue(undefined);
  });

  it('falls back through Android voice setting activities before opening app settings', async () => {
    startActivity
      .mockRejectedValueOnce(new Error('voice settings unavailable'))
      .mockRejectedValueOnce(new Error('generic settings unavailable'));

    await expect(openSpeechRecognitionLanguageSettings()).resolves.toBeUndefined();

    expect(startActivity).toHaveBeenNthCalledWith(1, 'android.settings.VOICE_INPUT_SETTINGS', {});
    expect(startActivity).toHaveBeenNthCalledWith(2, 'android.settings.SETTINGS', {});
    expect(mockOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('keeps Google-only settings as no-ops outside Android', async () => {
    mockPlatform.OS = 'ios';

    await expect(openGoogleAppSettings()).resolves.toBeUndefined();
    await expect(openGoogleVoiceSettingsBestEffort()).resolves.toBe(false);

    expect(mockRequireOptionalNativeModule).not.toHaveBeenCalled();
    expect(mockOpenSettings).not.toHaveBeenCalled();
  });

  it('tries every Google voice component and absorbs final settings errors', async () => {
    startActivity.mockRejectedValue(new Error('activity unavailable'));
    mockOpenSettings.mockRejectedValue(new Error('settings unavailable'));

    await expect(openGoogleVoiceSettingsBestEffort()).resolves.toBe(false);

    const componentCalls = startActivity.mock.calls.filter(
      (call: any[]) => call[0] === 'android.intent.action.MAIN'
    );
    expect(componentCalls).toHaveLength(4);
    expect(startActivity).toHaveBeenCalledWith('android.settings.VOICE_INPUT_SETTINGS', {});
    expect(startActivity).toHaveBeenCalledWith('android.settings.SETTINGS', {});
    expect(mockOpenSettings).toHaveBeenCalledTimes(1);
  });
});
