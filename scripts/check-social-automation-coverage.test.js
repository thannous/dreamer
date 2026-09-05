'use strict';

const { validateAutomationCoverage } = require('./check-social-automation-coverage');

function automation({ hours, minutes, positions, prompt }) {
  const setPositions = positions ? ';BYSETPOS=' + positions : '';
  return [
    'status = "ACTIVE"',
    'notification_policy = "failed_runs_only"',
    'target_thread_id = "thread"',
    'rrule = "RRULE:FREQ=DAILY;BYHOUR=' + hours + ';BYMINUTE=' + minutes + setPositions + '"',
    'prompt = ' + JSON.stringify(prompt),
  ].join('\n');
}

const proofClause = 'Exécuter npm run social:health ; le sous-contrôle social:proof:due doit rester vert.';
const mainPrompt = 'Cadence principale Europe/Paris. DreamViews d’abord. Reddit seulement après trois contributions DreamViews. ' +
  '79-TWO-POSTS-PER-DAY-CALENDAR-2026-09-11-24.md. TikTok 50/84. Instagram 61/84. X 84/84. ' +
  'Pinterest 17:30, YouTube 18:00, Facebook 18:15. Pinterest couvre 10/28 HERO exacts. ' +
  'YouTube couvre 19/28 HERO exacts. Facebook couvre 28/28 HERO exacts. ' +
  'Pinterest a également une dette HERO supérieure à 10 %. ' + proofClause;
const coverage = 'TikTok : **50/84 lignes exactes**\nInstagram : **61/84 lignes couvertes**\n' +
  'X \x60@NoctaliaDreams\x60 : **84/84 lignes exactes**\nPinterest : **10/28 heroes exacts**\n' +
  'YouTube : **19/28 heroes exacts**\nFacebook : **28/28 heroes exacts**';
const schedule = {
  hours: '10,15,16,17,18,19,20,22',
  minutes: '5,25,45',
  positions: '3,5,8,10,12,13,15,17,18,20,24',
};

describe('social automation coverage guard', () => {
  it('accepts the consolidated heartbeat grid', () => {
    const result = validateAutomationCoverage(
      automation({ ...schedule, prompt: mainPrompt }),
      coverage,
    );
    expect(result).toEqual({
      passages: 11,
      heroCounts: { Pinterest: 10, YouTube: 19, Facebook: 28 },
      primaryCounts: { TikTok: 50, Instagram: 61, X: 84 },
    });
  });

  it('rejects a missing Instagram execution wakeup', () => {
    expect(() => validateAutomationCoverage(
      automation({ ...schedule, positions: '3,5,8,10,12,13,15,17,18,20', prompt: mainPrompt }),
      coverage,
    )).toThrow('réveil 22:45 manquant');
  });

  it('honors BYSETPOS instead of the full hour-minute cartesian product', () => {
    expect(() => validateAutomationCoverage(
      automation({ ...schedule, positions: '3,5,8,10,12,13,15,17,18,20,23', prompt: mainPrompt }),
      coverage,
    )).toThrow('réveil 22:45 manquant');
  });

  it('rejects a stale rolling HERO count in the prompt', () => {
    expect(() => validateAutomationCoverage(
      automation({ ...schedule, prompt: mainPrompt }),
      coverage.replace('10/28', '11/28'),
    )).toThrow('compteur Pinterest désynchronisé');
  });

  it('rejects a heartbeat that does not run the same-day due-proof guard', () => {
    expect(() => validateAutomationCoverage(
      automation({ ...schedule, prompt: mainPrompt.replace(proofClause, '') }),
      coverage,
    )).toThrow('Automation consolidée : contrôle temporel');
  });

  it('rejects a stale rolling primary count in the prompt', () => {
    expect(() => validateAutomationCoverage(
      automation({ ...schedule, prompt: mainPrompt }),
      coverage.replace('50/84', '51/84'),
    )).toThrow('compteur TikTok désynchronisé');
  });
});
