import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildBaselineAnalysisPrompt } from './baseline-prompt.ts';
import { SYMBOL_LINK_CASES, type SymbolLinkCase, validateCases } from './cases.ts';
import {
  costUsd,
  differOnlyOnLinkFields,
  scorePair,
  scoredSymbols,
  summarizeVariant,
  symbolsParagraph,
} from './scoring.ts';

const windmill: Pick<SymbolLinkCase, 'a' | 'b' | 'expectedSymbolId'> = {
  a: { transcript: 'Un moulin.', target: /moulin|windmill/iu },
  b: { transcript: 'De grandes ailes qui tournent sur la colline.', target: /moulin|ailes|windmill/iu },
};

Deno.test('answered symbols are normalized as production stores them, duplicates and all', () => {
  const symbols = scoredSymbols({
    symbols: [
      { name: 'Le moulin', meaning: 'x', symbolId: 'none', key: 'Old Windmill' },
      { name: 'Chaton', meaning: 'x', symbolId: 'none', key: 'cat' },
      { name: 'Les ailes', meaning: 'x', symbolId: 'none', key: 'old-windmill' },
      { name: 'Geste', meaning: 'x', symbolId: 'none', key: '' },
      { name: '', meaning: 'not shown by the app', symbolId: 'cat', key: '' },
    ],
  });
  assertEquals(symbols, [
    { name: 'Le moulin', key: 'old-windmill', link: 'p:old-windmill' },
    { name: 'Chaton', symbolId: 'cat', link: 'd:cat' },
    { name: 'Les ailes', key: 'old-windmill', link: 'p:old-windmill' },
    { name: 'Geste', link: null },
  ]);
  assertEquals(scoredSymbols({ symbols: 'nope' }), []);
});

Deno.test('a returning element is linked by its reused link, whatever B calls it', () => {
  const a = scoredSymbols({ symbols: [{ name: 'Le moulin', meaning: 'x', symbolId: 'none', key: 'windmill' }] });
  const reused = scoredSymbols({ symbols: [{ name: 'Les ailes sur la colline', meaning: 'x', symbolId: 'none', key: 'windmill' }] });
  const known = [{ key: 'windmill', name: 'Le moulin' }];
  const linked = scorePair(windmill, a, reused, known);
  assertEquals([linked.targetInA, linked.targetInB, linked.linked], [true, true, true]);
  assertEquals([linked.reusedKeys, linked.keptNames], [1, 0]);

  const renamed = scoredSymbols({ symbols: [{ name: 'Les ailes', meaning: 'x', symbolId: 'none', key: 'wind-sails' }] });
  assertEquals([scorePair(windmill, a, renamed, known).targetInB, scorePair(windmill, a, renamed, known).linked], [true, false]);

  const omitted = scoredSymbols({ symbols: [{ name: 'Le bateau', meaning: 'x', symbolId: 'boat', key: '' }] });
  assertEquals([scorePair(windmill, a, omitted, known).targetInB, scorePair(windmill, a, omitted, known).linked], [false, false]);
});

Deno.test('dictionary targets, duplicates and key lengths are counted per reading', () => {
  const kitten = { a: { transcript: 'Un chaton.', target: /chaton|\bchat\b/iu }, b: { transcript: 'Un matou.', target: /matou|\bchat\b/iu }, expectedSymbolId: 'cat' };
  const a = scoredSymbols({ symbols: [
    { name: 'Chaton', meaning: 'x', symbolId: 'cat', key: '' },
    { name: 'Le chat', meaning: 'x', symbolId: 'none', key: 'cat' },
    { name: 'Paillasson', meaning: 'x', symbolId: 'none', key: 'front-door-mat' },
  ] });
  const b = scoredSymbols({ symbols: [{ name: 'Le matou', meaning: 'x', symbolId: 'none', key: 'tomcat' }] });
  const outcome = scorePair(kitten, a, b, []);
  assertEquals([outcome.dictionaryTargets, outcome.dictionaryHits], [2, 1]);
  assertEquals(outcome.duplicates, 1);
  assertEquals(outcome.keyWords, [3, 1]);
  assertEquals(outcome.linked, false);
});

Deno.test('variant metrics separate recall, omission, false links and pairs missing A', () => {
  const outcome = (fields: Partial<ReturnType<typeof scorePair>>): ReturnType<typeof scorePair> => ({
    targetInA: true, targetInB: true, linked: false, dictionaryTargets: 0, dictionaryHits: 0,
    duplicates: 0, unlinked: 0, keyWords: [], reusedKeys: 0, keptNames: 0, ...fields,
  });
  const metrics = summarizeVariant([
    { kind: 'same', outcome: outcome({ linked: true, keyWords: [1], reusedKeys: 1, keptNames: 1 }) },
    { kind: 'same', outcome: outcome({ targetInB: false, keyWords: [3] }) },
    { kind: 'same', outcome: outcome({ targetInA: false }) },
    { kind: 'return', outcome: outcome({ linked: true }) },
    { kind: 'trap', outcome: outcome({ linked: true, duplicates: 2 }) },
    { kind: 'trap', outcome: outcome({}) },
    { kind: 'dictionary', outcome: outcome({ dictionaryTargets: 2, dictionaryHits: 1 }) },
  ]);
  assertEquals(metrics.linkRecall.same, { hits: 1, total: 2, rate: 0.5 });
  assertEquals(metrics.omission.same, { hits: 1, total: 2, rate: 0.5 });
  assertEquals(metrics.linkRecall.return, { hits: 1, total: 1, rate: 1 });
  assertEquals(metrics.falseLinks, { hits: 1, total: 2, rate: 0.5 });
  assertEquals(metrics.dictionaryPrecision, { hits: 1, total: 2, rate: 0.5 });
  assertEquals(metrics.targetMissingInA, { same: 1, return: 0, trap: 0, dictionary: 0 });
  assertEquals(metrics.duplicatesPerReading, 2 / 14);
  assertEquals(metrics.meanKeyWords, 2);
  assertEquals(metrics.keptNameOnReuse, { hits: 1, total: 1, rate: 1 });
  assertEquals(summarizeVariant([]).linkRecall.same.rate, null);
});

Deno.test('cost uses the Haiku 5.5 list prices', () => {
  assertEquals(costUsd({ inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 0, cacheWriteTokens: 0 }), 0.6);
});

Deno.test('the corpus is valid; a stateful pattern or a repeated id is refused', () => {
  validateCases(SYMBOL_LINK_CASES);
  assertThrows(() => validateCases([{ ...SYMBOL_LINK_CASES[0], a: { ...SYMBOL_LINK_CASES[0].a, target: /phare/g } }]));
  assertThrows(() => validateCases([...SYMBOL_LINK_CASES, SYMBOL_LINK_CASES[0]]));
});

Deno.test('a paired run needs prompts that differ on the link-fields line only', () => {
  // Built from the frozen baseline so a later production prompt change does not fail this test;
  // the runner itself refuses a paid run when the real variants drift apart elsewhere.
  const baseline = buildBaselineAnalysisPrompt('Un phare.', 'French', false, undefined, [{ key: 'lighthouse', name: 'Le phare' }]);
  const linkLine = symbolsParagraph(baseline).split('\n')[1];
  const candidate = baseline.replace(linkLine, `${linkLine} Each non-empty key appears at most once in a reading.`);
  assertEquals(differOnlyOnLinkFields(baseline, candidate), true);
  assertEquals(differOnlyOnLinkFields(baseline, baseline), false);
  assertEquals(differOnlyOnLinkFields(baseline, candidate.replace('"title"', '"heading"')), false);
  assertEquals(differOnlyOnLinkFields(baseline, `${candidate}\nOne more line.`), false);
});
