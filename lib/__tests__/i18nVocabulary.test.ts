import { describe, expect, it } from '@jest/globals';

import dePack from '../i18n/de';
import enPack from '../i18n/en';
import esPack from '../i18n/es';
import frPack from '../i18n/fr';
// Aliased: a bare `it` import collides with the jest global of the same name.
import itPack from '../i18n/it';
import ptPack from '../i18n/pt';

/**
 * Vocabulary and tone contract (brand contract, "Ton"): one calm register per language,
 * one word for the analysis, and errors a person can act on. Screen tests run under a
 * marker translator, so only a catalogue-level check catches a string that drifts back.
 * Failures name the offending keys.
 */
const packs = { en: enPack, fr: frPack, es: esPack, de: dePack, it: itPack, pt: ptPack } as const;
type Language = keyof typeof packs;
const languages = Object.keys(packs) as Language[];
const entries = (language: Language) => Object.entries(packs[language]) as [string, string][];

/** Keys that name the analysis allowance or its result: the word is "analysis" everywhere. */
const ANALYSIS_QUOTA_KEYS = [
  'settings.quota.analysis_label',
  'settings.quota.subtitle',
  'settings.quota.free_reset_message',
  'settings.quota.plus_message',
  'settings.quota.guest_message',
  'recording.quota.analysis_label',
  'recording.analysis_offer.quota_remaining',
  'error.interpretation_limit',
  'error.chat_safety_limit',
  'journal.detail.quota_check_error',
  'subscription.paywall.card.feature.unlimited_analyses',
] as const;

/** Alert and section titles that must say what happened, never only "Error". */
const ERROR_TITLE_KEYS = [
  'common.error_title',
  'analysis_error.title',
  'subscription.paywall.error.title',
  'notifications.alert.update_failed.title',
] as const;
const BARE_ERROR_WORDS = new Set(['error', 'erreur', 'fehler', 'errore', 'erro']);

describe('i18n vocabulary and tone', () => {
  it('addresses the French reader with tu, never vous', () => {
    const formal = entries('fr')
      .filter(([, value]) => /\b(vous|votre|vos|veuillez)\b/i.test(value)
        // Second-person plural imperatives ("Touchez", "Réessayez") carry vous without the pronoun.
        || /\b(?!chez\b|assez\b|nez\b|rez\b)[A-Za-zÀ-ÿ]{3,}ez\b/.test(value))
      .map(([key]) => key);
    expect(formal).toEqual([]);
  });

  it.each(languages)('names the analysis allowance with the analysis word in %s', (language: Language) => {
    const pack = packs[language] as Record<string, string>;
    const drifted = ANALYSIS_QUOTA_KEYS.filter((key) => /interpr|deutung/i.test(pack[key] ?? ''));
    expect(drifted).toEqual([]);
  });

  it.each(languages)('never titles an error with the bare word for error in %s', (language: Language) => {
    const pack = packs[language] as Record<string, string>;
    const bare = ERROR_TITLE_KEYS.filter((key) => BARE_ERROR_WORDS.has((pack[key] ?? '').trim().toLowerCase()));
    expect(bare).toEqual([]);
  });

  it.each(languages)('does not shout in capitals in %s', (language: Language) => {
    const shouting = entries(language)
      .filter(([, value]) => /\b(NE|PAS|NOT|NICHT|NO|NON|NÃO)\b/.test(value))
      .map(([key]) => key);
    expect(shouting).toEqual([]);
  });

  it('keeps Portuguese in its Brazilian register', () => {
    const european = entries('pt')
      .filter(([, value]) => /\b(registad[oa]s?|ecrã|utilizador(es)?|telemóvel|partilh\w*|teu|tua|teus|tuas|estás|podes)\b/i.test(value))
      .map(([key]) => key);
    expect(european).toEqual([]);
  });
});
