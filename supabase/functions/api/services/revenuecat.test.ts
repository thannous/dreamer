import { deepStrictEqual as equal, ok, rejects } from 'node:assert';
import { createRevenueCatClient, RevenueCatHttpError } from './revenuecat.ts';

function httpFixture(handler: (request: Request) => Response | Promise<Response>) {
  const requests: Request[] = [];
  const fetch: typeof globalThis.fetch = (input, init) => {
    const request = new Request(input, init);
    requests.push(request);
    return Promise.resolve().then(() => handler(request));
  };
  return { fetch, requests };
}

Deno.test('RevenueCat transport encodes identities, authenticates GETs and preserves customer and alias values', async () => {
  const customer = { id: 'person/with spaces', active_entitlements: { items: [] } };
  const fixture = httpFixture((request) => request.url.endsWith('/aliases')
    ? Response.json({ items: [{ id: ' first ' }, { id: '' }, { id: null }, { id: 'second' }] })
    : Response.json(customer));
  const client = createRevenueCatClient({ fetch: fixture.fetch });
  equal(await client.fetchRevenueCatCustomer('person/with spaces', 'fixture-key', 'project/a'), customer);
  equal(await client.fetchRevenueCatCustomerAliases('person/with spaces', 'fixture-key', 'project/a'), ['first', 'second']);
  equal(fixture.requests.map((request) => request.url), [
    'https://api.revenuecat.com/v2/projects/project%2Fa/customers/person%2Fwith%20spaces',
    'https://api.revenuecat.com/v2/projects/project%2Fa/customers/person%2Fwith%20spaces/aliases',
  ]);
  for (const request of fixture.requests) {
    equal(request.method, 'GET');
    equal(request.headers.get('authorization'), 'Bearer fixture-key');
    equal(request.headers.get('accept'), 'application/json');
  }
});

Deno.test('RevenueCat transport keeps HTTP failures distinguishable from a missing entitlement', async () => {
  for (const status of [404, 429, 503]) {
    const fixture = httpFixture(() => new Response('provider detail', { status, statusText: 'Fixture failure' }));
    const client = createRevenueCatClient({ fetch: fixture.fetch });
    await rejects(client.fetchRevenueCatCustomer('person', 'fixture-key', 'project'), (error: unknown) => {
      ok(error instanceof RevenueCatHttpError);
      equal(error.status, status);
      equal(error.statusText, 'Fixture failure');
      equal(error.bodyText, 'provider detail');
      equal(error.url, 'https://api.revenuecat.com/v2/projects/project/customers/person');
      return true;
    });
    equal(fixture.requests.length, 1);
  }
});

Deno.test('RevenueCat request deadline aborts a stalled HTTP response', async () => {
  const fixture = httpFixture((request) => new Promise((_resolve, reject) => {
    request.signal.addEventListener('abort', () => reject(request.signal.reason), { once: true });
  }));
  const client = createRevenueCatClient({ fetch: fixture.fetch });
  await rejects(client.fetchRevenueCatCustomer('person', 'fixture-key', 'project', 1), { name: 'AbortError' });
  equal(fixture.requests.length, 1);
  equal(fixture.requests[0].signal.aborted, true);
});

Deno.test('RevenueCat pagination follows relative and absolute links and retains usable entitlement names', async () => {
  const pages = [
    { items: [{ id: ' ent1 ', lookup_key: ' plus ' }, { id: '', lookup_key: 'ignored' }], next_page: '/v2/projects/p/entitlements?page=2' },
    { items: [{ id: 'ent2', lookup_key: ' ', display_name: ' Noctalia Plus ' }, { id: 'ent3' }], next_page: 'https://api.revenuecat.com/v2/projects/p/entitlements?page=3' },
    { items: null },
  ];
  const fixture = httpFixture(() => Response.json(pages.shift()));
  const client = createRevenueCatClient({ fetch: fixture.fetch });
  equal(await client.getRevenueCatEntitlementLookup('fixture-key', 'p'), { ent1: 'plus', ent2: 'Noctalia Plus' });
  equal(fixture.requests.map((request) => request.url), [
    'https://api.revenuecat.com/v2/projects/p/entitlements',
    'https://api.revenuecat.com/v2/projects/p/entitlements?page=2',
    'https://api.revenuecat.com/v2/projects/p/entitlements?page=3',
  ]);
});

Deno.test('RevenueCat stops a repeating pagination link after the existing ten-page budget', async () => {
  const fixture = httpFixture(() => Response.json({ items: [], next_page: '/v2/projects/p/entitlements' }));
  const client = createRevenueCatClient({ fetch: fixture.fetch });
  equal(await client.getRevenueCatEntitlementLookup('fixture-key', 'p'), {});
  equal(fixture.requests.length, 10);
});

Deno.test('RevenueCat coalesces in-flight lookups and refreshes the cache after five minutes', async () => {
  let now = 0;
  let complete!: (response: Response) => void;
  const fixture = httpFixture(() => new Promise((resolve) => { complete = resolve; }));
  const client = createRevenueCatClient({ fetch: fixture.fetch, now: () => now });
  const first = client.getRevenueCatEntitlementLookup('fixture-key', 'p');
  const second = client.getRevenueCatEntitlementLookup('fixture-key', 'p');
  await Promise.resolve();
  equal(fixture.requests.length, 1);
  complete(Response.json({ items: [{ id: 'ent1', lookup_key: 'plus' }] }));
  equal(await Promise.all([first, second]), [{ ent1: 'plus' }, { ent1: 'plus' }]);
  now = 299_999;
  equal(await client.getRevenueCatEntitlementLookup('fixture-key', 'p'), { ent1: 'plus' });
  equal(fixture.requests.length, 1);
  now = 300_000;
  const refresh = client.getRevenueCatEntitlementLookup('fixture-key', 'p');
  await Promise.resolve();
  equal(fixture.requests.length, 2);
  complete(Response.json({ items: [{ id: 'ent2', lookup_key: 'Noctalia Plus' }] }));
  equal(await refresh, { ent2: 'Noctalia Plus' });
});

Deno.test('RevenueCat releases a failed lookup so a later request can recover', async () => {
  let fail = true;
  const fixture = httpFixture(() => {
    if (fail) throw new TypeError('offline');
    return Response.json({ items: [{ id: 'ent', lookup_key: 'plus' }] });
  });
  const client = createRevenueCatClient({ fetch: fixture.fetch });
  const first = client.getRevenueCatEntitlementLookup('fixture-key', 'p');
  const second = client.getRevenueCatEntitlementLookup('fixture-key', 'p');
  await Promise.all([rejects(first, /offline/), rejects(second, /offline/)]);
  equal(fixture.requests.length, 1);
  fail = false;
  equal(await client.getRevenueCatEntitlementLookup('fixture-key', 'p'), { ent: 'plus' });
  equal(fixture.requests.length, 2);
});

Deno.test('RevenueCat rejects malformed JSON and does not cache the failed page', async () => {
  let malformed = true;
  const fixture = httpFixture(() => malformed ? new Response('{') : Response.json({ items: [] }));
  const client = createRevenueCatClient({ fetch: fixture.fetch });
  await rejects(client.getRevenueCatEntitlementLookup('fixture-key', 'p'), SyntaxError);
  malformed = false;
  equal(await client.getRevenueCatEntitlementLookup('fixture-key', 'p'), {});
  equal(fixture.requests.length, 2);
});

Deno.test('RevenueCat client instances keep independent caches and respect the local runtime fetch guard', async () => {
  const originalFetch = globalThis.fetch;
  const first = createRevenueCatClient();
  const second = createRevenueCatClient();
  const fixture = httpFixture(() => Response.json({ items: [] }));
  globalThis.fetch = fixture.fetch;
  try {
    equal(await first.getRevenueCatEntitlementLookup('fixture-key', 'p'), {});
    equal(await second.getRevenueCatEntitlementLookup('fixture-key', 'p'), {});
    equal(fixture.requests.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
