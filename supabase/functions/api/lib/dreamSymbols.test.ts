import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { DREAM_SYMBOL_IDS } from './dreamSymbolIds.ts';
import {
  collectKnownDreamSymbols,
  MAX_KNOWN_SYMBOLS,
  normalizePersonalSymbolKey,
  parseKnownDreamSymbols,
} from './dreamSymbols.ts';

Deno.test('personal keys are stable ASCII slugs', () => {
  assertEquals(normalizePersonalSymbolKey('  Maison de Grand-Mère  '), 'maison-de-grand-mere');
  assertEquals(normalizePersonalSymbolKey('none'), undefined);
  assertEquals(normalizePersonalSymbolKey('!!!'), undefined);
  assertEquals(normalizePersonalSymbolKey(42), undefined);
  assertEquals((normalizePersonalSymbolKey('a'.repeat(80)) ?? '').length, 48);
});

Deno.test('known symbols from an app request are bounded, deduplicated and named', () => {
  const many = Array.from({ length: 60 }, (_, index) => ({ key: `place-${index}`, name: `Lieu ${index}` }));
  assertEquals(parseKnownDreamSymbols(many).length, MAX_KNOWN_SYMBOLS);
  assertEquals(parseKnownDreamSymbols([
    { key: 'Old School', name: '  Mon   ancien collège ' },
    { key: 'old-school', name: 'Duplicate' },
    { key: 'nameless' },
    'not an object',
  ]), [{ key: 'old-school', name: 'Mon ancien collège' }]);
  assertEquals(parseKnownDreamSymbols('nope'), []);
});

Deno.test('known symbols from saved readings come most frequent first, under the name used most', () => {
  const readings = [
    { symbols: [{ name: 'La maison de grand-mère', meaning: 'x', key: 'grandmother-house' }, { name: 'Chat', meaning: 'x', symbolId: 'cat' }] },
    null,
    { symbols: [{ name: 'Le collège', meaning: 'x', key: 'old-school' }] },
    { symbols: [{ name: 'Maison de mamie', meaning: 'x', key: 'grandmother-house' }, { name: 'Maison', meaning: 'x', key: 'grandmother-house' }] },
  ];
  // At a tie, the oldest wording, as the app names it.
  assertEquals(collectKnownDreamSymbols(readings), [
    { key: 'grandmother-house', name: 'Maison de mamie' },
    { key: 'old-school', name: 'Le collège' },
  ]);
  const again = { symbols: [{ name: 'la maison de grand-mère', meaning: 'x', key: 'grandmother-house' }] };
  assertEquals(collectKnownDreamSymbols([again, ...readings])[0], { key: 'grandmother-house', name: 'la maison de grand-mère' });
});

Deno.test('a key that is a dictionary id is not a personal symbol and takes none of the slots', () => {
  // A newer reading whose keys are all dictionary ids, then an older one with a personal key.
  const dictionaryKeyed = DREAM_SYMBOL_IDS.slice(0, MAX_KNOWN_SYMBOLS).map((id) => ({ name: id, meaning: 'x', key: id.toUpperCase() }));
  assertEquals(collectKnownDreamSymbols([
    { symbols: dictionaryKeyed },
    { symbols: [{ name: 'Le moulin', meaning: 'x', key: 'windmill' }] },
  ]), [{ key: 'windmill', name: 'Le moulin' }]);
});
