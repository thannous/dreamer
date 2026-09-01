import { describe, expect, it } from '@jest/globals';

import { APP_TRANSCRIPTION_LOCALES } from '@/lib/locale';
import {
  canDictate,
  isFullyOffline,
  mayLeaveDevice,
  normalizeSpeechLocale,
  resolveSpeechCapability,
  type SpeechCapabilityInput,
} from '@/lib/speechCapability';

const baseInput = (overrides: Partial<SpeechCapabilityInput> = {}): SpeechCapabilityInput => ({
  platform: 'android',
  androidApiLevel: 34,
  recognitionAvailable: true,
  onDeviceRecognitionSupported: true,
  installedLocales: ['fr-FR', 'en-US'],
  requestedLocale: 'fr-FR',
  appLocales: APP_TRANSCRIPTION_LOCALES,
  canRecordAudio: true,
  ...overrides,
});

describe('resolveSpeechCapability — API level ladder', () => {
  // minSdk is 28: every level from 28 up must still allow dictation.
  it.each([28, 29, 30])('falls back to the network recognizer on API %i', (androidApiLevel: number) => {
    const capability = resolveSpeechCapability(
      baseInput({
        androidApiLevel,
        // Below API 31 the native module reports no on-device support and
        // getSupportedLocales resolves to an empty list.
        onDeviceRecognitionSupported: false,
        installedLocales: [],
      })
    );

    expect(capability.tier).toBe('network');
    expect(capability.reason).toBe('on_device_unsupported');
    expect(capability.requiresOnDeviceRecognition).toBe(false);
    expect(canDictate(capability)).toBe(true);
  });

  it.each([31, 32])(
    'does not force on-device on API %i where locales cannot be introspected',
    (androidApiLevel: number) => {
      const capability = resolveSpeechCapability(
        baseInput({
          androidApiLevel,
          onDeviceRecognitionSupported: true,
          // getSupportedLocales is gated on API 33 and resolves empty below it.
          installedLocales: [],
        })
      );

      expect(capability.tier).toBe('network');
      expect(capability.reason).toBe('locale_introspection_unavailable');
      expect(capability.requiresOnDeviceRecognition).toBe(false);
    }
  );

  it('prefers on-device from API 33 when the locale is installed', () => {
    const capability = resolveSpeechCapability(baseInput({ androidApiLevel: 33 }));

    expect(capability.tier).toBe('on_device');
    expect(capability.reason).toBe('locale_installed');
    expect(capability.requiresOnDeviceRecognition).toBe(true);
    expect(isFullyOffline(capability)).toBe(true);
    expect(mayLeaveDevice(capability)).toBe(false);
  });

  it('never forces on-device when the requested locale is not installed', () => {
    const capability = resolveSpeechCapability(
      baseInput({ requestedLocale: 'de-DE', installedLocales: ['fr-FR'] })
    );

    expect(capability.tier).toBe('network');
    expect(capability.reason).toBe('locale_not_installed');
    expect(capability.requiresOnDeviceRecognition).toBe(false);
  });
});

describe('resolveSpeechCapability — degradation and blocking', () => {
  it('keeps dictation alive through the server when no RecognitionService exists', () => {
    const capability = resolveSpeechCapability(
      baseInput({ recognitionAvailable: false, onDeviceRecognitionSupported: false })
    );

    expect(capability.tier).toBe('server_only');
    expect(capability.reason).toBe('no_recognition_service');
    expect(canDictate(capability)).toBe(true);
    expect(mayLeaveDevice(capability)).toBe(true);
  });

  it('blocks voice only when the device cannot capture audio', () => {
    const capability = resolveSpeechCapability(baseInput({ canRecordAudio: false }));

    expect(capability.tier).toBe('unavailable');
    expect(capability.reason).toBe('no_microphone');
    expect(canDictate(capability)).toBe(false);
    expect(capability.localAlternatives).toEqual([]);
  });

  it('blocks voice even when a recognizer exists but audio cannot be captured', () => {
    const capability = resolveSpeechCapability(
      baseInput({ canRecordAudio: false, recognitionAvailable: true })
    );

    expect(capability.tier).toBe('unavailable');
  });
});

describe('resolveSpeechCapability — offline alternatives', () => {
  it('offers other app languages that are installed locally', () => {
    const capability = resolveSpeechCapability(
      baseInput({ requestedLocale: 'it-IT', installedLocales: ['fr-FR', 'en-US', 'ru-RU'] })
    );

    // ru-RU is installed but the app does not ship it, so it is not offered.
    expect(capability.localAlternatives).toEqual(['en-US', 'fr-FR']);
  });

  it('excludes the requested locale from its own alternatives', () => {
    const capability = resolveSpeechCapability(
      baseInput({ requestedLocale: 'fr-FR', installedLocales: ['fr-FR', 'de-DE'] })
    );

    expect(capability.localAlternatives).toEqual(['de-DE']);
  });

  it('reports no alternatives when nothing can be introspected', () => {
    const capability = resolveSpeechCapability(
      baseInput({ androidApiLevel: 28, installedLocales: [], onDeviceRecognitionSupported: false })
    );

    expect(capability.localAlternatives).toEqual([]);
  });

  it('matches locales regardless of separator and case', () => {
    const capability = resolveSpeechCapability(
      baseInput({ requestedLocale: 'fr-FR', installedLocales: ['fr_fr'] })
    );

    expect(capability.tier).toBe('on_device');
  });
});

describe('resolveSpeechCapability — non-Android platforms', () => {
  it('does not apply Android API gating on iOS', () => {
    const capability = resolveSpeechCapability(
      baseInput({ platform: 'ios', androidApiLevel: null })
    );

    expect(capability.tier).toBe('on_device');
  });

  it('degrades to the network recognizer on web', () => {
    const capability = resolveSpeechCapability(
      baseInput({ platform: 'web', androidApiLevel: null, onDeviceRecognitionSupported: false })
    );

    expect(capability.tier).toBe('network');
  });
});

describe('resolveSpeechCapability — Tell capture contract', () => {
  it('keeps Raconter usable when a local model is installed', () => {
    const capability = resolveSpeechCapability(baseInput());

    expect(capability.tier).toBe('on_device');
    expect(canDictate(capability)).toBe(true);
    expect(isFullyOffline(capability)).toBe(true);
    expect(mayLeaveDevice(capability)).toBe(false);
  });

  it('keeps Raconter usable offline-unproven devices via network instead of hiding the mic', () => {
    const capability = resolveSpeechCapability(
      baseInput({
        androidApiLevel: 28,
        onDeviceRecognitionSupported: false,
        installedLocales: [],
      })
    );

    expect(canDictate(capability)).toBe(true);
    expect(isFullyOffline(capability)).toBe(false);
    expect(mayLeaveDevice(capability)).toBe(true);
  });
});

describe('normalizeSpeechLocale', () => {
  it('normalizes separator and case', () => {
    expect(normalizeSpeechLocale('fr_FR')).toBe('fr-fr');
    expect(normalizeSpeechLocale('en-US')).toBe('en-us');
  });
});
