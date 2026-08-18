'use strict';

const { validateAutomationCoverage } = require('./check-social-automation-coverage');

function automation({ hours, minutes, prompt }) {
  return [
    'status = "ACTIVE"',
    'notification_policy = "failed_runs_only"',
    'target_thread_id = "thread"',
    `rrule = "RRULE:FREQ=DAILY;BYHOUR=${hours};BYMINUTE=${minutes}"`,
    `prompt = ${JSON.stringify(prompt)}`,
  ].join('\n');
}

const proofClause = 'Exécuter npm run social:health ; le sous-contrôle social:proof:due doit rester vert.';
const mainPrompt = `Cadence principale Europe/Paris. DreamViews d'abord. Reddit seulement après trois contributions DreamViews. La file du programme courant est complète et vérifiée jusqu'au 10/09. TikTok 50/84. Instagram 84/84. X 84/84. ${proofClause}`;
const secondaryPrompt = `À 10:45. Pinterest 17:30, YouTube 18:00, Facebook 18:15. Pinterest couvre 10/28 HERO exacts. YouTube couvre 18/28 HERO exacts. Facebook couvre 28/28 HERO exacts. Pinterest a également une dette HERO supérieure à 10 %. ${proofClause}`;
const coverage = 'TikTok : **50/84 lignes exactes**\nInstagram : **84/84 lignes couvertes**\nX `@NoctaliaDreams` : **84/84 lignes exactes**\nPinterest : **10/28 heroes exacts**\nYouTube : **18/28 heroes exacts**\nFacebook : **28/28 heroes exacts**';

describe('social automation coverage guard', () => {
  it('accepts the two complementary heartbeat grids', () => {
    const result = validateAutomationCoverage(
      automation({ hours: '12,15,16,19,20,22,23', minutes: '25,45', prompt: mainPrompt }),
      automation({ hours: '10,17,18', minutes: '5,45', prompt: secondaryPrompt }),
      coverage,
    );
    expect(result).toEqual({
      main: 14,
      secondary: 6,
      overlaps: 0,
      heroCounts: { Pinterest: 10, YouTube: 18, Facebook: 28 },
      primaryCounts: { TikTok: 50, Instagram: 84, X: 84 },
    });
  });

  it('rejects a missing Instagram execution wakeup', () => {
    expect(() => validateAutomationCoverage(
      automation({ hours: '12,15,16,19,20,22,23', minutes: '25', prompt: mainPrompt }),
      automation({ hours: '10,17,18', minutes: '5,45', prompt: secondaryPrompt }),
      coverage,
    )).toThrow('réveil 12:45 manquant');
  });

  it('rejects overlapping ownership', () => {
    expect(() => validateAutomationCoverage(
      automation({ hours: '12,15,16,19,20,22,23', minutes: '25,45', prompt: mainPrompt }),
      automation({ hours: '10,15,17,18', minutes: '5,45', prompt: secondaryPrompt }),
      coverage,
    )).toThrow('Chevauchement entre automations');
  });

  it('rejects a stale rolling HERO count in the secondary prompt', () => {
    expect(() => validateAutomationCoverage(
      automation({ hours: '12,15,16,19,20,22,23', minutes: '25,45', prompt: mainPrompt }),
      automation({ hours: '10,17,18', minutes: '5,45', prompt: secondaryPrompt }),
      coverage.replace('10/28', '11/28'),
    )).toThrow('compteur Pinterest désynchronisé');
  });

  it('rejects a heartbeat that does not run the same-day due-proof guard', () => {
    expect(() => validateAutomationCoverage(
      automation({ hours: '12,15,16,19,20,22,23', minutes: '25,45', prompt: mainPrompt.replace(proofClause, '') }),
      automation({ hours: '10,17,18', minutes: '5,45', prompt: secondaryPrompt }),
      coverage,
    )).toThrow('Principale: contrôle temporel');
  });

  it('rejects a stale rolling primary count in the main prompt', () => {
    expect(() => validateAutomationCoverage(
      automation({ hours: '12,15,16,19,20,22,23', minutes: '25,45', prompt: mainPrompt }),
      automation({ hours: '10,17,18', minutes: '5,45', prompt: secondaryPrompt }),
      coverage.replace('50/84', '51/84'),
    )).toThrow('compteur TikTok désynchronisé');
  });
});
