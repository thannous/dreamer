import { describe, expect, it } from '@jest/globals';

import { getTranslator, loadTranslations } from '../i18n';

const languages: ('en' | 'fr' | 'es' | 'de' | 'it')[] = ['en', 'fr', 'es', 'de', 'it'];

const obsoleteFirstRunOnboardingKeys = [
  'onboarding.path.library.title',
  'onboarding.path.library.body',
  'onboarding.path.library.kicker',
  'onboarding.path.library.detail_title',
  'onboarding.path.library.cta',
  'onboarding.capture.title',
  'onboarding.capture.mode.text.title',
  'onboarding.capture.mode.text.body',
  'onboarding.capture.mode.voice.title',
  'onboarding.capture.mode.voice.body',
  'onboarding.capture.hint',
  'onboarding.capture.cta',
] as const;

const frenchRecordingTutoiementKeys = [
  'recording.alert.stt_unavailable.message',
  'recording.alert.language_pack_missing.message',
  'recording.alert.offline_model.message',
  'recording.alert.limit.title',
  'recording.analysis_limit.assurance_guest',
  'guest.limit.banner.hint',
  'guest.limit.banner.reached',
  'guest.upsell.title',
  'guest.upsell.subtitle',
  'guest.upsell.benefit.unlimited',
  'guest.upsell.after1.message',
  'guest.first_dream.sheet.subtitle',
] as const;

const firstDreamSheetKeys = [
  'guest.first_dream.sheet.title',
  'guest.first_dream.sheet.subtitle',
  'guest.first_dream.sheet.analyze',
  'guest.first_dream.sheet.journal',
  'guest.first_dream.sheet.remembered_title',
  'guest.first_dream.sheet.remembered_subtitle',
  'guest.first_dream.sheet.remembered_primary',
  'guest.first_dream.sheet.remembered_analyze',
  'guest.first_dream.sheet.dismiss',
] as const;

const analyzePromptSheetKeys = [
  'recording.analyze_prompt.sheet.title',
  'recording.analyze_prompt.sheet.subtitle',
  'recording.analyze_prompt.sheet.analyze',
  'recording.analyze_prompt.sheet.journal',
  'recording.analyze_prompt.sheet.dismiss',
  'recording.analysis_offer.title',
  'recording.analysis_offer.quota_remaining',
  'recording.analysis_offer.unlimited',
  'recording.analysis_offer.unknown',
  'recording.analysis_offer.exhausted',
  'recording.analysis_offer.launch',
  'recording.analysis_offer.view',
  'recording.analysis_offer.later',
  'recording.analysis_offer.retry',
  'recording.analysis_offer.error',
  'recording.memory_offer.title',
  'recording.memory_offer.subtitle',
  'recording.memory_offer.view',
  'recording.memory_offer.analyze',
  'recording.memory_offer.later',
] as const;

const guestLimitSheetKeys = [
  'recording.guest_limit_sheet.title',
  'recording.guest_limit_sheet.message',
  'recording.guest_limit_sheet.draft_title',
  'recording.guest_limit_sheet.draft_message',
  'recording.guest_limit_sheet.cta',
  'recording.guest_limit_sheet.back_to_text',
] as const;

const analysisLimitSheetKeys = [
  'recording.alert.analysis_limit.message_free',
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

const recordingActivationInsightKeys = [
  'recording.activation_insight.eyebrow',
  'recording.activation_insight.summary.memory',
  'recording.activation_insight.summary.memory_draft',
  'recording.activation_insight.summary.signals',
  'recording.activation_insight.summary.fragment',
  'recording.activation_insight.signal.memory',
  'recording.activation_insight.signal.emotion',
  'recording.activation_insight.signal.place',
  'recording.activation_insight.signal.person',
  'recording.activation_insight.signal.symbol',
  'recording.activation_insight.signal.recurrence',
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
  'recording.preference.dismiss_accessibility',
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
  'recording.onboarding.preference.cta',
  'recording.onboarding.preference.settings_hint',
  'recording.onboarding.skip',
  'recording.onboarding.next',
  'recording.onboarding.done',
  'recording.guide.title',
  'recording.guide.step_mode',
  'recording.guide.step_control',
  'recording.guide.next',
  'recording.guide.done',
  'recording.guide.dismiss',
] as const;

const firstRunOnboardingKeys = [
  'onboarding.skip',
  'onboarding.back',
  'onboarding.progress',
  'onboarding.persistence_error',
  'onboarding.retry',
  'onboarding.continue_session',
  'onboarding.intro.title',
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
  'onboarding.privacy.toggle_hint',
  'onboarding.privacy.enabled',
  'onboarding.privacy.disabled',
  'onboarding.privacy.error',
  'onboarding.title',
  'onboarding.path.title_lead',
  'onboarding.path.title_accent',
  'onboarding.subtitle',
  'onboarding.fresh_cta',
  'onboarding.path.analyze.title',
  'onboarding.path.analyze.body',
  'onboarding.path.analyze.kicker',
  'onboarding.path.analyze.detail_title',
  'onboarding.path.analyze.cta',
  'onboarding.path.memory.title',
  'onboarding.path.memory.body',
  'onboarding.path.memory.kicker',
  'onboarding.path.memory.detail_title',
  'onboarding.path.memory.outcome_1',
  'onboarding.path.memory.outcome_2',
  'onboarding.path.memory.outcome_3',
  'onboarding.path.memory.cta',
  'onboarding.path.dictionary.title',
  'onboarding.path.dictionary.body',
  'onboarding.path.dictionary.cta',
] as const;

const rememberedDreamPromptKeys = [
  'recording.remembered.default_title',
  'recording.remembered.placeholder',
  'recording.remembered.active_instruction',
  'recording.remembered.save_button',
  'recording.remembered.save_button_accessibility',
  'recording.remembered_prompt.eyebrow',
  'recording.remembered_prompt.title',
  'recording.remembered_prompt.body',
  'recording.remembered_prompt.yes',
  'recording.remembered_prompt.tonight',
  'recording.remembered_prompt.skip',
  'recording.remembered_profile.eyebrow',
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
  'settings.onboarding.title',
  'settings.onboarding.description',
  'settings.onboarding.restart',
  'settings.onboarding.restart_hint',
  'analytics.privacy.title',
  'analytics.privacy.description',
  'analytics.privacy.enabled',
  'analytics.privacy.disabled',
  'analytics.privacy.toggle_label',
  'analytics.privacy.unavailable',
  'analytics.privacy.error',
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

  it('has translations for guest-limit sheet in all supported languages', async () => {
    await Promise.all(languages.map((lang) => loadTranslations(lang)));

    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const key of guestLimitSheetKeys) {
        const value = t(key, { limit: 2 });
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

  it('has translations for first activation insight in all supported languages', async () => {
    await Promise.all(languages.map((lang) => loadTranslations(lang)));

    for (const lang of languages) {
      const t = getTranslator(lang);

      for (const key of recordingActivationInsightKeys) {
        const value = t(key, { signals: 'Emotion, Place' });
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

  it('does not retain obsolete library-path or onboarding capture translations', async () => {
    const packs = await Promise.all(languages.map((lang) => loadTranslations(lang)));

    for (const pack of packs) {
      for (const key of obsoleteFirstRunOnboardingKeys) {
        expect(pack).not.toHaveProperty(key);
      }
    }
  });

  it('keeps the cited French recording journey in tutoiement', async () => {
    const translations = await loadTranslations('fr');

    for (const key of frenchRecordingTutoiementKeys) {
      const value = translations[key];
      expect(value).toBeDefined();
      expect(value).not.toMatch(/\b(?:vous|votre|vos)\b/i);
      expect(value).not.toMatch(/\b(?:saisissez|téléchargez|choisissez|créez)\b/i);
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
