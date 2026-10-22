import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  isPreparedReading,
  previewOf,
  previewOpening,
  spendPreparedReading,
  takePreparedReading,
  transcriptSha256,
} from './analysisPreview.ts';
import type { StructuredDreamAnalysis } from '../services/dreamAnalysis.ts';

const reading: StructuredDreamAnalysis = {
  title: 'La rivière de verre',
  interpretation: 'Ton rêve fait de la rivière un passage. La maison attend au bout.',
  shareableQuote: 'Une rivière de verre',
  theme: 'calm',
  dreamType: 'Symbolic Dream',
  imagePrompt: 'A river of glass',
  promptVersion: 'test',
  symbols: ['Rivière', 'Maison', 'Verre', 'Pont', 'Lampe', 'Porte', 'Clé'].map((name) => ({ name, meaning: `${name} veut dire…` })),
  emotions: [],
  reflectionQuestions: [],
};

Deno.test('a free account reads the first sentence of the reading, whole', () => {
  assertEquals(previewOpening('  Ton rêve fait de la rivière un passage.\nLa maison attend.'), 'Ton rêve fait de la rivière un passage.');
  assertEquals(previewOpening('Une question ? Puis la suite.'), 'Une question ?');
  // A decimal or an abbreviation without a space after it does not end the sentence.
  assertEquals(previewOpening('Il était 3.5 fois plus grand. Fin.'), 'Il était 3.5 fois plus grand.');
  const long = `${'mot '.repeat(120)}fin.`;
  const opening = previewOpening(long);
  assertEquals(opening.endsWith('…'), true);
  assertEquals(opening.length <= 281, true);
  assertEquals(opening.includes('mo…'), false);
});

Deno.test('the preview names at most six symbols and none of their meanings', () => {
  assertEquals(previewOf(reading, 'Titre'), {
    title: 'Titre',
    opening: 'Ton rêve fait de la rivière un passage.',
    symbols: ['Rivière', 'Maison', 'Verre', 'Pont', 'Lampe', 'Porte'],
  });
});

Deno.test('only a reading of the same text and language is taken, and it is spent once saved', async () => {
  const sha = await transcriptSha256('Je marchais.');
  assertEquals(sha, await transcriptSha256('Je marchais.'));
  assertEquals(sha === await transcriptSha256('Je marchais. '), false);
  const rows = [{ user_id: 'u1', dream_id: 7, status: 'ready', lang: 'fr', transcript_sha256: sha, reading }];
  const updates: Record<string, unknown>[] = [];
  const admin = {
    from: () => {
      const filters: [string, unknown][] = [];
      const builder = {
        select: () => builder,
        update: (values: Record<string, unknown>) => { updates.push(values); return builder; },
        eq: (column: string, value: unknown) => { filters.push([column, value]); return builder; },
        maybeSingle: async () => ({ data: rows.find((row) => filters.every(([column, value]) => (row as Record<string, unknown>)[column] === value)) ?? null, error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
      };
      return builder;
    },
  };
  const input = { userId: 'u1', dreamId: 7, lang: 'fr', transcriptSha256: sha };
  assertEquals(await takePreparedReading(admin, input), reading);
  assertEquals(await takePreparedReading(admin, { ...input, lang: 'en' }), null);
  assertEquals(await takePreparedReading(admin, { ...input, transcriptSha256: 'b'.repeat(64) }), null);
  assertEquals(await takePreparedReading(admin, { ...input, dreamId: 8 }), null);
  assertEquals(isPreparedReading({ ...reading, symbols: null }), false);

  await spendPreparedReading(admin, { userId: 'u1', dreamId: 7 });
  assertEquals(updates[0].status, 'used');
  assertEquals(updates[0].reading, null);
});
