/**
 * Native builds use the URL and URLSearchParams that Expo installs
 * (expo/src/winter/runtime.native.ts, backed by whatwg-url-minimum) since
 * react-native-url-polyfill was removed. Jest runs on Node's URL, so these
 * cases run the app's URL-dependent code under both and require the same result.
 */
import { createClient } from '@supabase/supabase-js';
import { URL as ExpoURL, URLSearchParams as ExpoURLSearchParams } from 'whatwg-url-minimum';

import { parseNoctaliaHandoffUrl } from '@/lib/lucid/deepLinks';
import { normalizeAuthReturnDestination } from '@/lib/authReturnIntent';

const NodeURL = globalThis.URL;
const NodeURLSearchParams = globalThis.URLSearchParams;

async function underBoth<T>(run: () => T | Promise<T>): Promise<{ expo: T; node: T }> {
  try {
    globalThis.URL = ExpoURL as unknown as typeof URL;
    globalThis.URLSearchParams = ExpoURLSearchParams as unknown as typeof URLSearchParams;
    const expo = await run();
    globalThis.URL = NodeURL;
    globalThis.URLSearchParams = NodeURLSearchParams;
    const node = await run();
    return { expo, node };
  } finally {
    globalThis.URL = NodeURL;
    globalThis.URLSearchParams = NodeURLSearchParams;
  }
}

function describeUrl(href: string) {
  const url = new URL(href);
  return {
    href: url.href,
    protocol: url.protocol,
    host: url.host,
    hostname: url.hostname,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    query: [...url.searchParams.entries()],
    fragment: [...new URLSearchParams(url.hash.slice(1)).entries()],
  };
}

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1In0.c2ln-_';

describe('native URL runtime without react-native-url-polyfill', () => {
  it('is the implementation the native runtime installs', () => {
    expect(ExpoURL).toBeDefined();
    expect(() => require.resolve('react-native-url-polyfill')).toThrow();
  });

  it.each([
    `noctalia://auth/reset-password#access_token=${TOKEN}&refresh_token=r-1&expires_in=3600&token_type=bearer&type=recovery`,
    `noctalia-qa://auth/callback#access_token=${TOKEN}&refresh_token=r%2B1&provider_token=p%3D`,
    'noctalia://recording?code=7f1c2e3a-0b5d-4e8f-9a1b-2c3d4e5f6a7b',
    'noctalia:///auth/reset-password?token_hash=pkce_abc123&type=recovery',
    'noctalia://journal/abc-123?source=notification&title=R%C3%AAve%20%26%20mer',
    'noctalia://recording?v=1&source=lucid_trainer&technique=mild&outcome=lucid&lucidity=high&recall=medium',
    'https://dream.noctalia.app/auth/reset-password?code=abc#error=access_denied&error_description=Email+link+is+invalid',
    'https://abcdefghijklmnop.supabase.co/auth/v1/verify?token=abc&type=signup&redirect_to=noctalia%3A%2F%2Fauth%2Fcallback',
    'https://abcdefghijklmnop.supabase.co/storage/v1/object/sign/dream-images/u%201/a%20b.webp?token=t.k.n',
  ])('parses %s the same way', async (href) => {
    const { expo, node } = await underBoth(() => describeUrl(href));
    expect(expo).toEqual(node);
  });

  it('builds query strings the same way', async () => {
    const { expo, node } = await underBoth(() => {
      const query = new URLSearchParams({ q: 'rêve & mer', tags: 'a,b', empty: '', plus: '1+1' });
      query.append('redirect_to', 'noctalia://auth/callback?x=1#y');
      const url = new URL('https://dream.noctalia.app/recording');
      url.search = query.toString();
      url.hash = new URLSearchParams({ access_token: TOKEN }).toString();
      return url.toString();
    });
    expect(expo).toBe(node);
  });

  it('reads Lucid handoff links and auth return destinations the same way', async () => {
    const { expo, node } = await underBoth(() => [
      parseNoctaliaHandoffUrl('noctalia://recording?v=1&source=lucid_trainer&technique=mild&outcome=lucid&lucidity=high&recall=medium'),
      parseNoctaliaHandoffUrl('noctalia://recording/?v=1&source=lucid_trainer&technique=mild&outcome=lucid&lucidity=high&recall=medium#x'),
      parseNoctaliaHandoffUrl('https://dream.noctalia.app/lucid/handoff?v=1&source=lucid_trainer&technique=mild&outcome=lucid&lucidity=high&recall=medium'),
      normalizeAuthReturnDestination('/journal/abc?tab=story#top'),
      normalizeAuthReturnDestination('//evil.example/journal'),
      normalizeAuthReturnDestination('https://evil.example/'),
      normalizeAuthReturnDestination('/auth/callback?code=1'),
    ]);
    expect(expo).toEqual(node);
    expect(expo[0]).toMatchObject({ technique: 'mild', outcome: 'lucid' });
  });

  it('reads OAuth and PKCE callbacks the same way in auth-js', async () => {
    const { parseParametersFromURL } = jest.requireActual('@supabase/auth-js/dist/main/lib/helpers') as {
      parseParametersFromURL: (href: string) => Record<string, string>;
    };
    const { expo, node } = await underBoth(() => [
      parseParametersFromURL(`noctalia://auth/callback#access_token=${TOKEN}&refresh_token=r-1&expires_in=3600&token_type=bearer`),
      parseParametersFromURL('noctalia://auth/callback?code=7f1c2e3a&state=s%2Fx'),
      parseParametersFromURL('noctalia://auth/callback?error=access_denied&error_description=User+cancelled#error_code=403'),
    ]);
    expect(expo).toEqual(node);
    expect(expo[0]).toMatchObject({ access_token: TOKEN, refresh_token: 'r-1' });
    expect(expo[1]).toEqual({ code: '7f1c2e3a', state: 's/x' });
  });

  it('sends the same PostgREST filters and storage signed-URL requests', async () => {
    const run = async () => {
      const requests: string[] = [];
      const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
        requests.push(String(input));
        const body = String(input).includes('/storage/v1/object/sign/')
          ? (String(input).endsWith('/sign/dream-images')
            ? [{ path: 'u 1/a b.webp', signedURL: '/object/sign/dream-images/u%201/a%20b.webp?token=t1', error: null }]
            : { signedURL: '/object/sign/dream-images/u%201/a%20b.webp?token=t1' })
          : [];
        return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });
      const client = createClient('https://abcdefghijklmnop.supabase.co', 'anon-key', {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: fetchMock as unknown as typeof fetch },
      });
      await client.from('dreams').select('id,title,created_at')
        .eq('user_id', 'u 1')
        .in('id', [1, 2])
        .or('title.ilike.*rêve & mer*,mood.eq.calm')
        .gte('created_at', '2026-10-01T00:00:00+02:00')
        .order('created_at', { ascending: false })
        .range(0, 9);
      await client.rpc('get_quota', { p_kind: 'analysis' }, { get: true });
      const single = await client.storage.from('dream-images').createSignedUrl('u 1/a b.webp', 60, { download: 'rêve.webp' });
      const many = await client.storage.from('dream-images').createSignedUrls(['u 1/a b.webp'], 60);
      return { requests, single: single.data?.signedUrl, many: many.data?.map((entry) => entry.signedUrl) };
    };
    const { expo, node } = await underBoth(run);
    expect(expo).toEqual(node);
    expect(expo.requests[0]).toContain('user_id=eq.u+1');
    expect(expo.single).toContain('token=t1');
  });
});
