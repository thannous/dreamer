import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { triggerImageJobWorker } from './imageJobs.ts';

Deno.test('triggerImageJobWorker uses the anon JWT for the Functions gateway', async () => {
  const originalFetch = globalThis.fetch;
  const originalAnon = Deno.env.get('SUPABASE_ANON_KEY');
  const requests: Request[] = [];

  Deno.env.set('SUPABASE_ANON_KEY', 'anon-jwt');
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push(request);
    return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  }) as typeof fetch;

  try {
    const triggered = await triggerImageJobWorker({
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'sb_secret_worker_key',
      jobId: 'job-1',
    });

    assertEquals(triggered, true);
    assertEquals(requests.length, 1);
    assertEquals(requests[0].headers.get('authorization'), 'Bearer anon-jwt');
    assertEquals(requests[0].headers.get('apikey'), 'sb_secret_worker_key');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalAnon == null) {
      Deno.env.delete('SUPABASE_ANON_KEY');
    } else {
      Deno.env.set('SUPABASE_ANON_KEY', originalAnon);
    }
  }
});
