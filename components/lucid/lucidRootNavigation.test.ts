import { lucidStartupDestination, normalizedLucidDestination } from './lucidRootNavigation';

it.each([
  ['noctalia-lucid://lucid/morning?entry=1', '/lucid/morning?entry=1'],
  ['https://lucid.noctalia.app/lucid/program/mild', '/lucid/program/mild'],
  ['noctalia-lucid://auth/reset-password#token=synthetic', '/auth/reset-password#token=synthetic'],
  ['noctalia-lucid://auth/callback/success?code=synthetic', '/auth/callback/success?code=synthetic'],
  ['noctalia-lucid://recording', '/lucid'],
  ['https://evil.example/lucid/morning', '/lucid'],
  ['noctalia-lucid://lucidity', '/lucid'],
  ['malformed', '/lucid'],
])('resolves %s to %s', (url, target) => {
  expect(lucidStartupDestination(url, '/', false)).toBe(target);
});
it('preserves local web paths and compares grouped routes after parameter delivery', () => {
  expect(lucidStartupDestination('http://localhost:8081/lucid/morning?a=1', '/lucid/morning', true)).toBe('/lucid/morning?a=1');
  expect(normalizedLucidDestination('/lucid/(tabs)/night?source=notification')).toBe('/lucid/night');
});
