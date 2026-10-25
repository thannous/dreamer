// Reproduce review round 2 with the real worker and a stubbed PostgREST transport.
import { deepStrictEqual as assertEquals } from 'node:assert';
import { processAnalysisJob } from './index.ts';
import { hashAnalysisTranscript } from '../api/lib/analysisTranscriptHash.ts';

const transcript = 'A door opened onto the sea.';
const job = {
  id: '11111111-1111-4111-8111-111111111111', user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', guest_fingerprint: null,
  dream_id: 7, job_type: 'analyze_dream', status: 'queued', request_payload: { lang: 'en', transcript_sha256: await hashAnalysisTranscript(transcript) },
  result_payload: null, error_code: null, error_message: null, attempt_count: 0, max_attempts: 3,
  client_request_id: '22222222-2222-4222-8222-222222222222', quota_claimed: true, quota_claimed_at: null,
  created_at: new Date().toISOString(), started_at: null, finished_at: null,
};


const run = async (failure: unknown, attempt: number) => {
  const currentJob = { ...job, attempt_count: attempt - 1 };
  const writes: { table: string; body: Record<string, unknown>; query: string }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.pathname === '/functions/v1/analysis-job-worker') return json({ ok: true }, 202);
    if (url.pathname === '/rest/v1/ai_jobs' && request.method === 'GET') return json([currentJob]);
    if (url.pathname === '/rest/v1/ai_jobs' && request.method === 'PATCH') {
      const body = await request.json();
      if (body.status === 'running') {
        const row = { ...currentJob, ...body };
        return request.headers.get('Accept')?.includes('vnd.pgrst.object') ? json(row) : json([row]);
      }
      writes.push({ table: 'ai_jobs', body, query: url.search });
      return new Response(null, { status: 204 });
    }
    if (url.pathname === '/rest/v1/dreams' && request.method === 'GET') {
      if (failure === 'network') throw new TypeError('fetch failed');
      if (failure === 'html') return new Response('<html>502 Bad Gateway</html>', { status: 502 });
      return json(failure, 500);
    }
    if (url.pathname === '/rest/v1/dreams' && request.method === 'PATCH') {
      writes.push({ table: 'dreams', body: await request.json(), query: url.search });
      return new Response(null, { status: 204 });
    }
    if (url.pathname === '/rest/v1/rpc/get_effective_subscription_tier') {
      return json({ code: '57014', message: 'canceling statement due to statement timeout', details: null, hint: null }, 500);
    }
    throw new Error(`unexpected ${request.method} ${url.pathname}`);
  };
  try {
    await processAnalysisJob({ supabaseUrl: 'https://supabase.test', serviceRoleKey: 'synthetic', storageBucket: 'dream-images', jobId: job.id });
  } finally { globalThis.fetch = original; }
  return writes.filter(w => w.table === 'ai_jobs').map(w => ({ status: w.body.status, error_code: w.body.error_code, guardedOnRunning: w.query.includes('status=eq.running') }));
};

for (const failure of ['network', 'html', { code: '', message: 'fetch failed' },
  { code: '57014', message: 'statement timeout' }, { code: '40P01', message: 'deadlock' },
  { code: 'PGRST000', message: 'unavailable' }, { code: 'P0001', message: 'completion invalid' }]) {
  Deno.test(`worker retries then records refundable terminal failure: ${JSON.stringify(failure)}`, async () => {
    for (const attempt of [1, 3]) {
      assertEquals(await run(failure, attempt), [{
        status: attempt === 1 ? 'queued' : 'failed',
        error_code: 'ANALYSIS_SERVER_ERROR', guardedOnRunning: true,
      }]);
    }
  });
}
