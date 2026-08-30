import type { DreamAnalysis } from '@/lib/types';
import {
  extractLucidDreamSignCandidates,
  getActiveLucidDreamSigns,
  LUCID_DREAM_SIGN_MIN_DISTINCT_DREAMS,
  normalizeLucidDreamSignText,
  reconcileLucidDreamSignDecisions,
  type LucidDreamSignCandidate,
} from '@/lib/lucid/dreamSigns';

function makeDream(
  partial: Pick<DreamAnalysis, 'id'> & Partial<Pick<DreamAnalysis, 'title' | 'transcript' | 'symbols' | 'emotions'>>
): Pick<DreamAnalysis, 'id' | 'title' | 'transcript' | 'symbols' | 'emotions'> {
  return {
    id: partial.id,
    title: partial.title ?? '',
    transcript: partial.transcript ?? '',
    symbols: partial.symbols,
    emotions: partial.emotions,
  };
}

const CORPUS = [
  makeDream({
    id: 101,
    title: 'Escalier infini',
    transcript: 'Je vois un escalier infini à l’école. Marie est là, le miroir tremble, et j’ai peur.',
    symbols: [{ name: 'Escalier', meaning: 'passage' }],
    emotions: [{ name: 'Peur', insight: 'alarme' }],
  }),
  makeDream({
    id: 102,
    title: 'ESCALIER INFINI',
    transcript: 'Encore l’escalier infini près de Marie à l’école. Le miroir se brise. Peur.',
  }),
  makeDream({
    id: 201,
    title: 'Infinite staircase',
    transcript: 'I keep climbing an infinite staircase at school. Marie is waiting by the mirror and I feel fear.',
  }),
  makeDream({
    id: 202,
    title: 'Staircase again',
    transcript: 'The infinite staircase returns. Marie holds a mirror. Fear follows.',
  }),
  makeDream({
    id: 301,
    title: 'Escalera infinita',
    transcript: 'Subo una escalera infinita en la escuela. Marie está junto al espejo y siento miedo.',
  }),
  makeDream({
    id: 302,
    title: 'Otra vez',
    transcript: 'La escalera infinita vuelve. Marie y el espejo. Miedo.',
  }),
  makeDream({
    id: 401,
    title: 'Unendliche Treppe',
    transcript: 'Ich steige eine unendliche Treppe in der Schule. Marie steht am Spiegel. Angst.',
  }),
  makeDream({
    id: 402,
    title: 'Wieder die Treppe',
    transcript: 'Die unendliche Treppe kehrt zurück. Marie und der Spiegel. Angst.',
  }),
  makeDream({
    id: 501,
    title: 'Scala infinita',
    transcript: 'Salgo una scala infinita a scuola. Marie è allo specchio e sento paura.',
  }),
  makeDream({
    id: 502,
    title: 'Ancora la scala',
    transcript: 'La scala infinita torna. Marie e lo specchio. Paura.',
  }),
] as const;

function byId(candidates: readonly LucidDreamSignCandidate[], id: string) {
  return candidates.find((candidate) => candidate.id === id);
}

describe('lucid dream-sign extraction', () => {
  it('normalizes accents, case and punctuation without inventing tokens', () => {
    expect(normalizeLucidDreamSignText('Escalier  INFINI!')).toBe('escalier infini');
    expect(normalizeLucidDreamSignText('ESCALERA infinita')).toBe('escalera infinita');
    expect(normalizeLucidDreamSignText("l’école")).toBe('l ecole');
  });

  it('counts distinct dreams, not intra-dream repeats, and keeps stable ids', () => {
    const candidates = extractLucidDreamSignCandidates([
      makeDream({
        id: 11,
        title: 'Marie Marie',
        transcript: 'Marie parle à Marie près du miroir. Marie rit.',
      }),
      makeDream({
        id: 12,
        title: 'Encore Marie',
        transcript: 'Marie ouvre le miroir.',
      }),
    ]);

    const marie = byId(candidates, 'sign:marie');
    expect(marie).toMatchObject({
      id: 'sign:marie',
      label: 'Marie',
      distinctDreamCount: 2,
      sourceDreamIds: ['11', '12'],
      category: 'person',
    });
    expect(marie?.evidence).toHaveLength(2);
    expect(marie?.evidence.every((item) => item.snippet.length > 0)).toBe(true);
  });

  it('covers a multilingual FR/EN/ES/DE/IT corpus with bounded evidence', () => {
    const candidates = extractLucidDreamSignCandidates(CORPUS);
    const ids = candidates.map((candidate) => candidate.id);

    expect(ids).toEqual([...ids].sort((left, right) => {
      const leftCount = byId(candidates, left)?.distinctDreamCount ?? 0;
      const rightCount = byId(candidates, right)?.distinctDreamCount ?? 0;
      return rightCount - leftCount || (left < right ? -1 : 1);
    }));

    expect(byId(candidates, 'sign:escalier_infini')).toMatchObject({
      distinctDreamCount: 2,
      sourceDreamIds: ['101', '102'],
      category: 'anomaly',
    });
    expect(byId(candidates, 'sign:infinite_staircase')).toMatchObject({
      distinctDreamCount: 2,
      sourceDreamIds: ['201', '202'],
      category: 'anomaly',
    });
    expect(byId(candidates, 'sign:escalera_infinita')).toMatchObject({
      distinctDreamCount: 2,
      sourceDreamIds: ['301', '302'],
      category: 'anomaly',
    });
    expect(byId(candidates, 'sign:unendliche_treppe')).toMatchObject({
      distinctDreamCount: 2,
      sourceDreamIds: ['401', '402'],
      category: 'anomaly',
    });
    expect(byId(candidates, 'sign:scala_infinita')).toMatchObject({
      distinctDreamCount: 2,
      sourceDreamIds: ['501', '502'],
      category: 'anomaly',
    });
    expect(byId(candidates, 'sign:marie')?.distinctDreamCount).toBe(CORPUS.length);
    expect(byId(candidates, 'sign:peur')?.category).toBe('emotion');
    expect(byId(candidates, 'sign:miroir')?.category).toBe('object');
    expect(byId(candidates, 'sign:ecole')?.sourceDreamIds).toEqual(['101', '102']);
    expect(byId(candidates, 'sign:ecole')?.category).toBe('place');
    expect(
      candidates.every((candidate) => candidate.evidence.length <= 3)
    ).toBe(true);
  });

  it('drops stopwords, one-off tokens and respects the frequency threshold', () => {
    const candidates = extractLucidDreamSignCandidates([
      makeDream({
        id: 1,
        title: 'Dans le rêve',
        transcript: 'Je vois quelque chose unique: un dragon. Puis je reviens.',
      }),
      makeDream({
        id: 2,
        title: 'The dream',
        transcript: 'I see the same school twice but only one lighthouse.',
      }),
      makeDream({
        id: 3,
        title: 'School again',
        transcript: 'The school returns without that tower.',
      }),
    ]);

    expect(byId(candidates, 'sign:dans')).toBeUndefined();
    expect(byId(candidates, 'sign:reve')).toBeUndefined();
    expect(byId(candidates, 'sign:dream')).toBeUndefined();
    expect(byId(candidates, 'sign:the')).toBeUndefined();
    expect(byId(candidates, 'sign:dragon')).toBeUndefined();
    expect(byId(candidates, 'sign:lighthouse')).toBeUndefined();
    expect(byId(candidates, 'sign:school')?.distinctDreamCount).toBe(2);
    expect(LUCID_DREAM_SIGN_MIN_DISTINCT_DREAMS).toBe(2);
  });

  it('does not promote repeated narration boilerplate as a personal sign', () => {
    const candidates = extractLucidDreamSignCandidates([
      makeDream({ id: 1, title: 'A dream', transcript: 'I was there and then I was back. I saw something.' }),
      makeDream({ id: 2, title: 'The dream', transcript: 'I was there and then I was back. I saw something.' }),
    ]);

    expect(candidates).toEqual([]);
  });

  it('recalculates after a source dream is removed and stays deterministic', () => {
    const withDeleted = extractLucidDreamSignCandidates(CORPUS);
    const withoutFrench = extractLucidDreamSignCandidates(CORPUS.filter((dream) => dream.id !== 101 && dream.id !== 102));

    expect(byId(withDeleted, 'sign:escalier_infini')).toBeDefined();
    expect(byId(withoutFrench, 'sign:escalier_infini')).toBeUndefined();
    expect(byId(withoutFrench, 'sign:marie')?.sourceDreamIds).toEqual(
      CORPUS.filter((dream) => dream.id !== 101 && dream.id !== 102).map((dream) => String(dream.id))
    );
    expect(extractLucidDreamSignCandidates(CORPUS)).toEqual(withDeleted);
    expect(extractLucidDreamSignCandidates([...CORPUS].reverse())).toEqual(withDeleted);
  });

  it('never treats pending or rejected candidates as active training signs', () => {
    const candidates = extractLucidDreamSignCandidates(CORPUS);
    const marie = byId(candidates, 'sign:marie');
    const staircase = byId(candidates, 'sign:escalier_infini');
    const mirror = byId(candidates, 'sign:miroir');
    expect(marie && staircase && mirror).toBeTruthy();

    const reconciled = reconcileLucidDreamSignDecisions(candidates, [
      { id: marie!.id, decision: 'confirmed', customLabel: 'Marie au miroir' },
      { id: staircase!.id, decision: 'pending' },
      { id: mirror!.id, decision: 'rejected' },
      { id: 'sign:ghost_removed', decision: 'confirmed' },
    ]);

    expect(reconciled.find((item) => item.id === marie!.id)).toMatchObject({
      decision: 'confirmed',
      displayLabel: 'Marie au miroir',
    });
    expect(reconciled.find((item) => item.id === staircase!.id)?.decision).toBe('pending');
    expect(reconciled.find((item) => item.id === mirror!.id)?.decision).toBe('rejected');
    expect(reconciled.some((item) => item.id === 'sign:ghost_removed')).toBe(false);

    const active = getActiveLucidDreamSigns(candidates, [
      { id: marie!.id, decision: 'confirmed', customLabel: 'Marie au miroir' },
      { id: staircase!.id, decision: 'pending' },
      { id: mirror!.id, decision: 'rejected' },
    ]);
    expect(active).toEqual([
      {
        id: marie!.id,
        label: 'Marie au miroir',
        category: 'person',
        distinctDreamCount: marie!.distinctDreamCount,
        sourceDreamIds: marie!.sourceDreamIds,
      },
    ]);
    expect(getActiveLucidDreamSigns(candidates, [])).toEqual([]);
  });
});
