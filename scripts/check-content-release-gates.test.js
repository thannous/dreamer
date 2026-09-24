/* global describe, it, expect */
const fs = require('fs');
const path = require('path');
const {
  PLAN_FACT_COPY,
  buildPlanFacts,
  evaluatePlanFacts,
  readAppQuotas,
} = require('./check-content-release-gates');

const LIMITS_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'constants', 'limits.ts'), 'utf8');

describe('plan facts follow constants/limits.ts', () => {
  const quotas = readAppQuotas(LIMITS_SOURCE);

  it('reads the app quotas, with explorations unmetered', () => {
    expect(quotas.free).toMatchObject({ analysis: 3, exploration: null, messagesPerDream: 10 });
    expect(quotas.plus).toMatchObject({ analysis: null, exploration: null, messagesPerDream: 20 });
  });

  it('builds the required sentences for every landing language from the quotas', () => {
    expect(Object.keys(PLAN_FACT_COPY).sort()).toEqual(['de', 'en', 'es', 'fr', 'it', 'pt-br']);
    expect(buildPlanFacts('en', quotas).required).toEqual([
      '3 dream analyses per month',
      'Guided explorations with no monthly limit',
      'Up to 10 follow-up messages per analyzed dream',
      'Up to 20 follow-up messages per dream',
    ]);
  });

  it('accepts copy that states the current facts', () => {
    const facts = buildPlanFacts('en', quotas);
    const visibleText = `<ul>
      <li>3 dream analyses per month, each with an image</li>
      <li>Guided explorations with no monthly limit</li>
      <li>Up to 10 follow-up messages per analyzed dream</li>
      <li>Up to 20 follow-up messages per dream</li>
    </ul>`;
    expect(evaluatePlanFacts({ facts, visibleText, requireFacts: true })).toEqual([]);
  });

  it('rejects retired claims in visible text or structured data, spelled out or not', () => {
    const facts = buildPlanFacts('en', quotas);
    expect(
      evaluatePlanFacts({ facts, visibleText: '<p>Two guided explorations per month.</p>', requireFacts: false })
    ).toEqual(['retired plan claim "two guided explorations per month"']);
    expect(
      evaluatePlanFacts({
        facts,
        visibleText: '<p>Nothing here.</p>',
        schemaText: '{"text":"Unlimited follow-up messages per dream"}',
        requireFacts: false,
      })
    ).toEqual(['retired plan claim "unlimited follow-up messages"']);
    const fr = buildPlanFacts('fr', quotas);
    expect(evaluatePlanFacts({ facts: fr, visibleText: 'Explorations guidées illimitées', requireFacts: false })).toHaveLength(1);
  });

  it('reports missing facts only where they are required', () => {
    const facts = buildPlanFacts('de', quotas);
    expect(evaluatePlanFacts({ facts, visibleText: '<p>3 Traumanalysen pro Monat</p>', requireFacts: true })).toHaveLength(3);
    expect(evaluatePlanFacts({ facts, visibleText: '<p>3 Traumanalysen pro Monat</p>', requireFacts: false })).toEqual([]);
  });

  it('forces a copy update when the app limits change', () => {
    const raisedCap = readAppQuotas(LIMITS_SOURCE.replace('messagesPerDream: 20', 'messagesPerDream: 30'));
    expect(buildPlanFacts('en', raisedCap).required).toContain('Up to 30 follow-up messages per dream');

    const meteredAgain = readAppQuotas(LIMITS_SOURCE.replace(/exploration: null/g, 'exploration: 2'));
    expect(() => buildPlanFacts('en', meteredAgain)).toThrow(/meters explorations again/);
  });
});
