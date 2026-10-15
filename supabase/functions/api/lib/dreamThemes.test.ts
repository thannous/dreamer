import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { describeDreamThemes, normalizeDreamTheme, offeredDreamThemes } from './dreamThemes.ts';

Deno.test('an app that does not say which themes it shows is offered only the four it has always known', () => {
  assertEquals(offeredDreamThemes(undefined), ['surreal', 'mystical', 'calm', 'noir']);
  assertEquals(offeredDreamThemes('luminous'), ['surreal', 'mystical', 'calm', 'noir']);
  // Its prompt is the one it always had.
  assertEquals(describeDreamThemes(offeredDreamThemes(undefined)), '"surreal", "mystical", "calm", "noir"');
});

Deno.test('newer themes are offered only to an app that shows them, unknown ones never', () => {
  assertEquals(
    offeredDreamThemes(['mystical', 'luminous', 'calm', 'nostalgic', 'noir', 'surreal', 'radiant', 7]),
    ['surreal', 'mystical', 'calm', 'noir', 'luminous', 'nostalgic']
  );
  assertEquals(offeredDreamThemes(['nostalgic']), ['surreal', 'mystical', 'calm', 'noir', 'nostalgic']);
});

Deno.test('a theme outside those offered falls back to surreal', () => {
  assertEquals(normalizeDreamTheme('luminous', ['surreal', 'mystical', 'calm', 'noir']), 'surreal');
  assertEquals(normalizeDreamTheme('luminous', ['surreal', 'mystical', 'calm', 'noir', 'luminous']), 'luminous');
});
