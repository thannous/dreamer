import { describe, expect, it } from '@jest/globals';

import { getTranslator, loadTranslations } from '../i18n';

const languages: ('en' | 'fr' | 'es' | 'de' | 'it')[] = ['en', 'fr', 'es', 'de', 'it'];

const firstDreamSheetKeys = [
  'guest.first_dream.sheet.title',
  'guest.first_dream.sheet.subtitle',
  'guest.first_dream.sheet.analyze',
  'guest.first_dream.sheet.journal',
  'guest.first_dream.sheet.dismiss',
] as const;

const analyzePromptSheetKeys = [
  'recording.analyze_prompt.sheet.title',
  'recording.analyze_prompt.sheet.subtitle',
  'recording.analyze_prompt.sheet.analyze',
  'recording.analyze_prompt.sheet.journal',
  'recording.analyze_prompt.sheet.dismiss',
] as const;

const recordingStatusKeys = [
  'recording.status.permission_prompt.title',
  'recording.status.permission_prompt.detail',
  'recording.status.ready.title',
  'recording.status.ready.detail',
  'recording.status.hide',
  'recording.status.show',
  'recording.status.preparing.title',
  'recording.status.preparing.detail',
  'recording.status.recording.title',
  'recording.status.recording.detail',
  'recording.status.busy.title',
  'recording.status.busy.detail',
  'recording.status.duration',
  'recording.status.fallback.permission_denied',
  'recording.status.fallback.stt_unavailable',
  'recording.status.fallback.language_pack_missing',
  'recording.status.fallback.no_speech',
  'recording.status.fallback.start_failed',
  'recording.status.retry_voice',
] as const;

const recordingModeKeys = [
  'recording.mode.switch_to_text',
  'recording.mode.switch_to_text_hint',
  'recording.mode.switch_to_text_edit',
  'recording.mode.switch_to_text_edit_hint',
  'recording.mode.switch_to_voice',
  'recording.mode.voice_cta_detail',
  'recording.mode.voice_pause_detail',
  'recording.mode.voice_resume_detail',
] as const;

const recordingMicKeys = [
  'recording.mic.start',
  'recording.mic.stop',
  'recording.mic.pause',
  'recording.mic.resume',
  'recording.mic.start_hint',
  'recording.mic.stop_hint',
  'recording.mic.pause_hint',
  'recording.mic.resume_hint',
] as const;

const recordingPreferenceKeys = [
  'recording.preference.label',
  'recording.preference.view_title',
  'recording.preference.text',
  'recording.preference.voice',
  'recording.preference.selected',
  'recording.preference.text_hint',
  'recording.preference.voice_hint',
  'recording.preference.accessibility',
] as const;

const micRationaleKeys = [
  'recording.mic_rationale.title',
  'recording.mic_rationale.message',
  'recording.mic_rationale.allow',
  'recording.mic_rationale.text_fallback',
  'recording.mic_rationale.dismiss',
] as const;

const onboardingTourKeys = [
  'recording.onboarding.step_count',
  'recording.onboarding.voice.body',
  'recording.onboarding.text.body',
  'recording.onboarding.explore.body',
  'recording.onboarding.preference.badge',
  'recording.onboarding.preference.title',
  'recording.onboarding.preference.voice_detail',
  'recording.onboarding.preference.text_detail',
  'recording.onboarding.preference.settings_hint',
  'recording.onboarding.skip',
  'recording.onboarding.next',
  'recording.onboarding.done',
] as const;

const settingsOnboardingKeys = [
  'settings.onboarding.title',
  'settings.onboarding.description',
  'settings.onboarding.restart',
  'settings.onboarding.restart_hint',
] as const;

describe('Recording i18n - bottom sheets', () => {
  it('has translations for first-dream sheet in all supported languages', async () => {
    await Promise.all(languages.map((lang) => loadTranslations(lang)));

    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const key of firstDreamSheetKeys) {
        const value = t(key);
        expect(value).not.toBe(key);
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it('has translations for analyze-prompt sheet in all supported languages', async () => {
    await Promise.all(languages.map((lang) => loadTranslations(lang)));

    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const key of analyzePromptSheetKeys) {
        const value = t(key);
        expect(value).not.toBe(key);
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it('has translations for recording status and fallback copy in all supported languages', async () => {
    await Promise.all(languages.map((lang) => loadTranslations(lang)));

    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const key of recordingStatusKeys) {
        const value = t(key, { duration: '0:05' });
        expect(value).not.toBe(key);
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it('has translations for recording mode switch copy in all supported languages', async () => {
    await Promise.all(languages.map((lang) => loadTranslations(lang)));

    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const key of recordingModeKeys) {
        const value = t(key);
        expect(value).not.toBe(key);
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it('has translations for microphone controls in all supported languages', async () => {
    await Promise.all(languages.map((lang) => loadTranslations(lang)));

    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const key of recordingMicKeys) {
        const value = t(key);
        expect(value).not.toBe(key);
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it('has translations for recording preference controls in all supported languages', async () => {
    await Promise.all(languages.map((lang) => loadTranslations(lang)));

    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const key of recordingPreferenceKeys) {
        const value = t(key);
        expect(value).not.toBe(key);
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it('has translations for the microphone rationale in all supported languages', async () => {
    await Promise.all(languages.map((lang) => loadTranslations(lang)));

    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const key of micRationaleKeys) {
        const value = t(key);
        expect(value).not.toBe(key);
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it('has translations for the recording onboarding tour in all supported languages', async () => {
    await Promise.all(languages.map((lang) => loadTranslations(lang)));

    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const key of onboardingTourKeys) {
        const value = t(key, { current: 1, total: 3 });
        expect(value).not.toBe(key);
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it('has translations for replaying recording onboarding from settings', async () => {
    await Promise.all(languages.map((lang) => loadTranslations(lang)));

    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const key of settingsOnboardingKeys) {
        const value = t(key);
        expect(value).not.toBe(key);
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });
});
