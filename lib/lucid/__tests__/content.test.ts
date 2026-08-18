import {
  getLucidContent,
  LUCID_CONTENT,
  LUCID_EVIDENCE_REFERENCES,
  LUCID_LOCALES,
  LUCID_PROGRAM_IDS,
  normalizeLucidLocale,
} from '../content';

function structuralShape(value: unknown): unknown {
  if (Array.isArray(value)) {
    return {
      kind: 'array',
      length: value.length,
      items: value.map(structuralShape),
    };
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, structuralShape(nestedValue)]),
    );
  }

  return typeof value;
}

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }

  if (value !== null && typeof value === 'object') {
    return Object.values(value).flatMap(collectStrings);
  }

  return [];
}

describe('Lucid Trainer embedded content', () => {
  it('ships five complete locales and falls back to English', () => {
    expect(LUCID_LOCALES).toEqual(['en', 'fr', 'es', 'de', 'it']);
    expect(Object.keys(LUCID_CONTENT).sort()).toEqual([...LUCID_LOCALES].sort());

    expect(normalizeLucidLocale('fr-FR')).toBe('fr');
    expect(normalizeLucidLocale('ES_mx')).toBe('es');
    expect(normalizeLucidLocale('de')).toBe('de');
    expect(normalizeLucidLocale('it-IT')).toBe('it');
    expect(normalizeLucidLocale('pt-BR')).toBe('en');
    expect(normalizeLucidLocale('ja')).toBe('en');
    expect(normalizeLucidLocale(null)).toBe('en');
    expect(getLucidContent('pt-BR')).toBe(LUCID_CONTENT.en);
  });

  it('keeps every localized content tree structurally equivalent to English', () => {
    const englishShape = structuralShape(LUCID_CONTENT.en);

    for (const locale of LUCID_LOCALES) {
      expect(structuralShape(LUCID_CONTENT[locale])).toEqual(englishShape);
    }
  });

  it('uses only canonical persisted identifiers for onboarding choices', () => {
    const expectedGoals = [
      'first_lucid_dream',
      'improve_recall',
      'more_frequent_lucidity',
      'stabilize_lucidity',
    ];
    const expectedExperience = ['beginner', 'occasional', 'experienced'];

    for (const locale of LUCID_LOCALES) {
      expect(LUCID_CONTENT[locale].onboarding.goals.map(({ id }) => id)).toEqual(
        expectedGoals
      );
      expect(
        LUCID_CONTENT[locale].onboarding.experienceLevels.map(({ id }) => id)
      ).toEqual(expectedExperience);
    }
  });

  it('provides a complete, sequential and cautious seven-session progression', () => {
    for (const locale of LUCID_LOCALES) {
      const localizedContent = LUCID_CONTENT[locale];

      for (const programId of LUCID_PROGRAM_IDS) {
        const program = localizedContent.programs[programId];
        const sessionIds = program.sessions.map((session) => session.id);

        expect(program.id).toBe(programId);
        expect(program.prerequisites.length).toBeGreaterThanOrEqual(3);
        expect(program.stopRules.length).toBeGreaterThanOrEqual(3);
        expect(program.sessions.length).toBeGreaterThanOrEqual(7);
        expect(new Set(sessionIds).size).toBe(sessionIds.length);
        expect(program.sessions.map((session) => session.session)).toEqual(
          program.sessions.map((_, index) => index + 1),
        );

        for (const session of program.sessions) {
          expect(session.id).toBe(
            `${programId}-${String(session.session).padStart(2, '0')}`,
          );
          expect(session.title.trim().length).toBeGreaterThan(3);
          expect(session.objective.trim().length).toBeGreaterThan(10);
          expect(session.durationMinutes).toBeGreaterThanOrEqual(5);
          expect(session.durationMinutes).toBeLessThanOrEqual(20);
          expect(session.steps.length).toBeGreaterThanOrEqual(3);
          expect(session.steps.every((step) => step.trim().length > 8)).toBe(true);
          expect(session.caution.trim().length).toBeGreaterThan(15);
          expect(session.reflectionPrompt.trim().length).toBeGreaterThan(10);
        }
      }
    }
  });

  it('includes the required structured evidence and only links known sources', () => {
    const identifiers = LUCID_EVIDENCE_REFERENCES.map(
      (reference) => reference.identifier.value,
    );
    const referenceIds = LUCID_EVIDENCE_REFERENCES.map((reference) => reference.id);
    const knownReferenceIds = new Set(referenceIds);

    expect(identifiers).toEqual(
      expect.arrayContaining([
        '10.3389/fpsyg.2020.01746',
        '10.1111/jsr.13786',
        '10.1016/j.concog.2012.07.003',
        '35167686',
        '10.5665/sleep.4716',
      ]),
    );
    expect(new Set(referenceIds).size).toBe(referenceIds.length);

    for (const reference of LUCID_EVIDENCE_REFERENCES) {
      expect(reference.url).toMatch(/^https:\/\//);
      expect(reference.title.trim().length).toBeGreaterThan(10);
      expect(reference.authors.trim().length).toBeGreaterThan(3);
      expect(reference.note.trim().length).toBeGreaterThan(20);
      expect(reference.topics.length).toBeGreaterThan(0);
    }

    for (const programId of LUCID_PROGRAM_IDS) {
      for (const referenceId of LUCID_CONTENT.en.programs[programId]
        .evidenceReferenceIds) {
        expect(knownReferenceIds.has(referenceId)).toBe(true);
      }
    }
  });

  it('contains no outcome guarantees or positive medical claims in any locale', () => {
    const allCopy = [
      ...collectStrings(LUCID_CONTENT),
      ...collectStrings(LUCID_EVIDENCE_REFERENCES),
    ].join('\n');

    const prohibitedClaims = [
      /\bguarantee(?:d|s)?\b/i,
      /\b(?:cures?|treats?|prevents?|diagnoses?)\b/i,
      /\byou will (?:have|induce|experience) (?:a )?lucid dream\b/i,
      /\bgaranti(?:e|es|s)?\b/i,
      /\b(?:guérit|soigne|prévient|diagnostique)\b/i,
      /\btu (?:auras|feras) un rêve lucide\b/i,
      /\bgarantiza(?:do|da)?\b/i,
      /\b(?:cura|trata|previene|diagnostica)\b/i,
      /\btendrás un sueño lúcido\b/i,
      /\bgarantiert\b/i,
      /\b(?:heilt|behandelt|verhindert|diagnostiziert)\b/i,
      /\bdu wirst (?:einen )?klartraum (?:haben|erleben)\b/i,
      /\bgarantisc(?:e|ono)\b/i,
      /\b(?:cura|tratta|previene|diagnostica)\b/i,
      /\bavrai un sogno lucido\b/i,
    ];

    for (const prohibitedClaim of prohibitedClaims) {
      expect(allCopy).not.toMatch(prohibitedClaim);
    }
  });

  it('contains no generated placeholders in essential embedded copy', () => {
    const allCopy = collectStrings(LUCID_CONTENT).join('\n');

    expect(allCopy).not.toMatch(/\{\{|\}\}|\$\{|\b(?:TODO|TBD)\b/);
  });
});
