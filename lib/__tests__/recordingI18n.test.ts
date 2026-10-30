import { describe, expect, it } from '@jest/globals';

import { getTranslator, loadTranslations } from '../i18n';
import { GUEST_DREAM_RECORDING_LIMIT } from '@/constants/limits';

const languages: ('en' | 'fr' | 'es' | 'de' | 'it' | 'pt')[] = ['en', 'fr', 'es', 'de', 'it', 'pt'];

const analyzePromptSheetKeys = [
  'recording.analysis_offer.title',
  'recording.analysis_offer.view',
] as const;

const analysisLimitSheetKeys = [
  'recording.analysis_limit.title_guest',
  'recording.analysis_limit.title_free',
  'recording.analysis_limit.title_login',
  'recording.analysis_limit.message_guest',
  'recording.analysis_limit.message_free',
  'recording.analysis_limit.message_login',
  'recording.analysis_limit.assurance_guest',
  'recording.analysis_limit.assurance_free',
  'recording.analysis_limit.feature_analyses',
  'recording.analysis_limit.feature_explorations',
  'recording.analysis_limit.feature_priority',
  'recording.analysis_limit.cta_guest',
  'recording.analysis_limit.cta_free',
  'recording.analysis_limit.cta_login',
  'recording.analysis_limit.journal',
  'recording.analysis_limit.dismiss',
] as const;

const recordingStatusKeys = [
  'recording.tell.title',
  'recording.tell.empty',
  'recording.tell.edit',
  'recording.status.preparing.title',
  'recording.status.recording.title',
  'recording.status.duration',
  'recording.status.fallback.permission_denied',
  'recording.status.fallback.stt_unavailable',
  'recording.status.fallback.language_pack_missing',
  'recording.status.fallback.no_speech',
  'recording.status.fallback.start_failed',
  'recording.status.retry_voice',
  'recording.save.confirmation',
] as const;

const recordingModeKeys = [
  'recording.mode.switch_to_voice',
] as const;

// This label is still shared by remembered dreams in the journal and detail.
// The retired activation insight card's other copy is no longer a UI contract.
const rememberedDreamLabelKeys = [
  'recording.activation_insight.signal.memory',
] as const;

const recordingMicKeys = [
  'recording.mic.start',
  'recording.mic.pause',
  'recording.mic.resume',
  'recording.mic.start_hint',
  'recording.mic.pause_hint',
] as const;

const recordingPreferenceKeys = [
  'recording.preference.label',
  'recording.preference.text',
  'recording.preference.voice',
] as const;

const micRationaleKeys = [
  'recording.mic_rationale.title',
  'recording.mic_rationale.message',
  'recording.mic_rationale.allow',
  'recording.mic_rationale.text_fallback',
  'recording.mic_rationale.dismiss',
] as const;

const onboardingTourKeys = [
  'recording.onboarding.voice.body',
  'recording.onboarding.preference.settings_hint',
  'recording.voice_hint.understood',
] as const;

const firstRunOnboardingKeys = [
  'onboarding.skip',
  'onboarding.back',
  'onboarding.progress',
  'onboarding.persistence_error',
  'onboarding.retry',
  'onboarding.continue_session',
  'onboarding.intro.title_lead',
  'onboarding.intro.title_accent',
  'onboarding.intro.subtitle',
  'onboarding.intro.cta',
  'onboarding.intro.signal.capture.title',
  'onboarding.intro.signal.capture.body',
  'onboarding.intro.signal.decode.title',
  'onboarding.intro.signal.decode.body',
  'onboarding.intro.signal.profile.title',
  'onboarding.intro.signal.profile.body',
  'onboarding.privacy.link',
  'onboarding.privacy.title',
  'onboarding.privacy.body',
  'onboarding.privacy.no_content',
  'onboarding.privacy.toggle_label',
  'onboarding.privacy.error',
  'onboarding.title',
  'onboarding.path.title_lead',
  'onboarding.path.title_accent',
  'onboarding.subtitle',
  'onboarding.path.analyze.title',
  'onboarding.path.analyze.body',
  'onboarding.path.analyze.cta',
  'onboarding.path.memory.title',
  'onboarding.path.memory.body',
  'onboarding.path.memory.cta',
  'onboarding.path.dictionary.title',
  'onboarding.path.dictionary.body',
  'onboarding.path.dictionary.cta',
] as const;

const rememberedDreamPromptKeys = [
  'recording.remembered.default_title',
  'recording.remembered.placeholder',
  'recording.remembered.save_button',
  'recording.remembered_profile.accordion_title',
  'recording.remembered_profile.expand_hint',
  'recording.remembered_profile.collapse_hint',
  'recording.remembered_profile.optional_badge',
  'recording.remembered_profile.title',
  'recording.remembered_profile.kind_label',
  'recording.remembered_profile.kind.old',
  'recording.remembered_profile.kind.recurring',
  'recording.remembered_profile.kind.nightmare',
  'recording.remembered_profile.kind.lucid',
  'recording.remembered_profile.kind.meaningful',
  'recording.remembered_profile.kind.person',
  'recording.remembered_profile.period_label',
  'recording.remembered_profile.period.recent',
  'recording.remembered_profile.period.months_ago',
  'recording.remembered_profile.period.years_ago',
  'recording.remembered_profile.period.childhood',
  'recording.remembered_profile.period.unknown',
  'recording.remembered_profile.fragment_label',
  'recording.remembered_profile.fragment.place',
  'recording.remembered_profile.fragment.person',
  'recording.remembered_profile.fragment.sensation',
  'recording.remembered_profile.fragment.image',
  'recording.remembered_profile.fragment.fear',
  'recording.remembered_profile.fragment.color',
] as const;

const settingsOnboardingKeys = [
  'analytics.privacy.title',
  'analytics.privacy.description',
  'analytics.privacy.enabled',
  'analytics.privacy.disabled',
  'analytics.privacy.toggle_label',
  'analytics.privacy.unavailable',
  'analytics.privacy.error',
] as const;

describe('Recording i18n - bottom sheets', () => {
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

  it('has translations for analysis-limit upsell sheet in all supported languages', async () => {
    await Promise.all(languages.map((lang) => loadTranslations(lang)));

    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const key of analysisLimitSheetKeys) {
        const value = t(key, { limit: 2 });
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

  it('has translations for the remembered dream label in all supported languages', async () => {
    await Promise.all(languages.map((lang) => loadTranslations(lang)));

    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const key of rememberedDreamLabelKeys) {
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

  it('uses verbal Write/Tell labels instead of a hidden capture menu', async () => {
    await Promise.all(languages.map((lang) => loadTranslations(lang)));

    const labels: Record<(typeof languages)[number], { text: string; voice: string }> = {
      fr: { text: 'Écrire', voice: 'Raconter' },
      en: { text: 'Write', voice: 'Tell' },
      es: { text: 'Escribir', voice: 'Contar' },
      de: { text: 'Schreiben', voice: 'Erzählen' },
      it: { text: 'Scrivere', voice: 'Raccontare' },
      pt: { text: 'Escrever', voice: 'Contar' },
    };

    for (const lang of languages) {
      const t = getTranslator(lang);
      expect(t('recording.preference.text')).toBe(labels[lang].text);
      expect(t('recording.preference.voice')).toBe(labels[lang].voice);
      expect(t('recording.preference.accessibility')).not.toMatch(/hamburger|menu cach|hidden menu|réglages de capture|capture settings/i);
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

  it('has translations for first-run onboarding paths in all supported languages', async () => {
    await Promise.all(languages.map((lang) => loadTranslations(lang)));

    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const key of firstRunOnboardingKeys) {
        const value = t(key);
        expect(value).not.toBe(key);
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it('states the finite guest recording cap in every language', async () => {
    await Promise.all(languages.map((lang) => loadTranslations(lang)));

    for (const lang of languages) {
      const value = getTranslator(lang)('recording.alert.limit.message', { limit: GUEST_DREAM_RECORDING_LIMIT });
      expect(value).toContain(String(GUEST_DREAM_RECORDING_LIMIT));
      expect(value).not.toMatch(/unlimited|illimit|ilimit|unbegrenzt/i);
      expect(value).not.toMatch(/\{limit\}/);
    }
  });

  it('has translations for remembered dream onboarding in all supported languages', async () => {
    await Promise.all(languages.map((lang) => loadTranslations(lang)));

    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const key of rememberedDreamPromptKeys) {
        const value = t(key);
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
