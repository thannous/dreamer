import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  ANALYSIS_JOB_WORKER_AUTH_HEADER,
  triggerAnalysisWorker,
} from './analysisJobs.ts';

Deno.test('triggerAnalysisWorker sends internal credentials without a bearer', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Request[] = [];

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push(request);
    return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 202 }));
  }) as typeof fetch;

  try {
    await triggerAnalysisWorker({
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'sb_secret_worker_key',
      jobId: 'job-1',
    });

    assertEquals(requests.length, 1);
    assertEquals(requests[0].headers.get('authorization'), null);
    assertEquals(requests[0].headers.get('apikey'), 'sb_secret_worker_key');
    assertEquals(
      requests[0].headers.get(ANALYSIS_JOB_WORKER_AUTH_HEADER),
      'sb_secret_worker_key'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
