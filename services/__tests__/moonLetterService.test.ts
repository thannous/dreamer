import { fetchMoonLetter } from '@/services/moonLetterService';

const mockFetch = jest.fn();
jest.mock('@/lib/apiSession', () => ({ fetchJSONWithSession: (...args: unknown[]) => mockFetch(...args) }));
jest.mock('@/lib/config', () => ({ getApiBaseUrl: () => 'https://api.test/functions/v1/api' }));
jest.mock('@/lib/env', () => ({ isMockModeEnabled: () => false }));

const letter = { fullMoonAt: '2026-10-26T04:11:49.432Z', lang: 'fr', opening: 'Une phrase.', body: 'La suite.', locked: false, dreamCount: 4 };
const result = (extra: Record<string, unknown> = {}) => ({
  fullMoonAt: '2026-10-26T04:11:49.432Z', letter, reason: null, dreamCount: 4, minDreams: 3, previous: [], ...extra,
});

beforeEach(() => mockFetch.mockReset());

it('asks the api for this cycle’s letter, or an earlier one by its full moon', async () => {
  mockFetch.mockResolvedValue(result());
  expect((await fetchMoonLetter({ lang: 'fr' })).letter?.body).toBe('La suite.');
  expect(mockFetch).toHaveBeenLastCalledWith('https://api.test/functions/v1/api/moon-letter', expect.objectContaining({
    method: 'POST', body: { lang: 'fr' }, retries: 0,
  }));
  await fetchMoonLetter({ lang: 'fr', fullMoonAt: '2026-09-26T16:49:03.885Z' });
  expect(mockFetch.mock.calls[1][1].body).toEqual({ lang: 'fr', fullMoonAt: '2026-09-26T16:49:03.885Z' });
});

it('accepts a locked letter only without its body, and a missing letter only with its reason', async () => {
  mockFetch.mockResolvedValue(result({ letter: { ...letter, locked: true, body: null } }));
  expect((await fetchMoonLetter({ lang: 'fr' })).letter?.locked).toBe(true);
  for (const broken of [
    result({ letter: { ...letter, locked: true } }),
    result({ letter: { ...letter, body: null } }),
    result({ letter: null }),
    result({ reason: 'later' }),
    result({ previous: [{ fullMoonAt: 'soon', opening: 'x', dreamCount: 1 }] }),
    null,
  ]) {
    mockFetch.mockResolvedValueOnce(broken);
    await expect(fetchMoonLetter({ lang: 'fr' })).rejects.toThrow('Invalid moon letter response');
  }
  mockFetch.mockResolvedValue(result({ letter: null, reason: 'too_few_dreams', dreamCount: 1 }));
  expect((await fetchMoonLetter({ lang: 'fr' })).reason).toBe('too_few_dreams');
});
