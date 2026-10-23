/**
 * Disposable recovery QA API. Auth, route handlers, worker and database RPCs are
 * the real implementation. Only the paid model transport is deterministic.
 * ImageScript initializes its pinned WASM dependency from deno.land at import.
 * That startup-only permission is revoked before this server can accept work.
 * App/provider execution then has loopback permission only; never a hosted key.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { assertBackendTarget } from '../../../scripts/lib/backend-e2e-local.cjs';
import type { ApiContext } from '../../../supabase/functions/api/types.ts';
import { handleCreateAnalysisJob, handleGetAnalysisJobStatus } from '../../../supabase/functions/api/routes/analysisJobs.ts';
import { handleChat } from '../../../supabase/functions/api/routes/chat.ts';
import { handleQuotaStatus } from '../../../supabase/functions/api/routes/quota.ts';
import { handleCategorizeDream } from '../../../supabase/functions/api/routes/dreams.ts';
import { processAnalysisJob } from '../../../supabase/functions/analysis-job-worker/index.ts';

await Deno.permissions.revoke({ name: 'net', host: 'deno.land:443' });

const manifestPath = Deno.env.get('E2E_NATIVE_BACKEND_MANIFEST');
const webRecovery = Deno.env.get('E2E_BACKEND_RECOVERY') === '1';
if (webRecovery && manifestPath) throw new Error('Choose exactly one owned recovery backend');
let status: { API_URL: string; DB_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string;
  LOCAL_E2E_STACK: { id: string; runtime: 'native' } };
let controlToken: unknown;
if (webRecovery) {
  const statusPath = Deno.env.get('E2E_BACKEND_STATUS_FILE');
  if (!statusPath) throw new Error('The backend runner status file is required');
  status = JSON.parse(await Deno.readTextFile(statusPath));
  controlToken = Deno.env.get('E2E_BACKEND_RECOVERY_CONTROL_TOKEN');
} else {
  if (!manifestPath) throw new Error('E2E_NATIVE_BACKEND_MANIFEST is required');
  const manifest = JSON.parse(await Deno.readTextFile(manifestPath));
  if (manifest.kind !== 'noctalia-native-backend' || manifest.schemaVersion !== 1) {
    throw new Error('Only this invocation\'s native backend manifest is accepted');
  }
  status = manifest.status;
  controlToken = manifest.proxy?.controlToken;
}
const backend = assertBackendTarget(status);
const serviceRoleKey = status.SERVICE_ROLE_KEY;
if (typeof controlToken !== 'string' || controlToken.length < 32) throw new Error('Missing control capability');
const port = Number(Deno.env.get('E2E_NATIVE_RECOVERY_PORT') ?? 31284);
if (!Number.isSafeInteger(port) || port < 20000 || port > 32767) throw new Error('Invalid loopback port');

// Never inherit real provider credentials. The guard below rejects every
// non-stack request except this deterministic, in-process provider response.
Deno.env.set('GEMINI_API_KEY', 'native-e2e-no-network-provider');
Deno.env.set('ANTHROPIC_API_KEY', 'native-e2e-no-network-provider');
const originalFetch = globalThis.fetch;
let analysisHold = false;
let releaseAnalysis: (() => void) | undefined;
let analysisGate = Promise.resolve();
let chatDropDone = false;
const state = {
  analysisProviderCalls: 0, chatProviderCalls: 0, categorizationProviderCalls: 0, analysisDispatches: 0,
  droppedChatCompletions: 0, analysisRequests: [] as string[], chatRequests: [] as string[],
  blockedExternalRequests: 0, workerFailures: 0,
  backendFailures: [] as { route: string; status: number; code?: string; message?: string }[],
};
const jobs = new Set<Promise<void>>();
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json' },
});
const analysisText = 'A lighthouse can be a point of orientation. What does this particular lighthouse bring to mind for you?';
const chatText = 'The blue door is the detail you chose. What association does that door have for you?';
const providerAnalysis = {
  title: 'The lighthouse and the blue door', interpretation: analysisText,
  shareableQuote: '', quoteSourceExcerpts: [], theme: 'calm', dreamType: 'Everyday Dream',
  imagePrompt: 'A lighthouse beside the sea with a blue door.', symbols: [], emotions: [], reflectionQuestions: ['What does this lighthouse bring to mind?'],
};

globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.origin === backend.origin && url.pathname === '/functions/v1/analysis-job-worker') {
    const { jobId } = await request.json();
    state.analysisDispatches += 1;
    // Hold dispatch after real durable admission, before calling the real worker.
    // This keeps a slow device restart independent of the provider's production
    // request timeout while exercising recovery of an acknowledged queued job.
    const task = (async () => {
      if (analysisHold) await analysisGate;
      await processAnalysisJob({
        supabaseUrl: backend.origin, serviceRoleKey, storageBucket: 'dream-images', jobId,
      });
    })().catch(() => { state.workerFailures += 1; }).finally(() => jobs.delete(task));
    jobs.add(task);
    return json({ ok: true, status: 'accepted' }, 202);
  }
  if (url.origin === backend.origin && /^\/(?:auth|rest|storage)\/v1\//.test(url.pathname)) {
    const response = await originalFetch(request);
    if (!response.ok) {
      const failure = await response.clone().json().catch(() => ({}));
      state.backendFailures.push({ route: url.pathname, status: response.status, code: failure.code, message: failure.message });
    }
    return response;
  }
  if (url.origin === 'https://api.anthropic.com' && url.pathname === '/v1/messages') {
    const body = await request.json();
    const structured = body.output_config?.format?.type === 'json_schema';
    const isAnalysis = structured && 'interpretation' in (body.output_config.format.schema?.properties ?? {});
    let answer: string;
    if (isAnalysis) {
      state.analysisProviderCalls += 1;
      answer = JSON.stringify(providerAnalysis);
    } else if (structured) {
      state.categorizationProviderCalls += 1;
      answer = JSON.stringify({ title: 'The lighthouse and the blue door', theme: 'calm', dreamType: 'Everyday Dream' });
    } else {
      state.chatProviderCalls += 1;
      answer = chatText;
    }
    const message = {
      id: `msg_native_fixture_${crypto.randomUUID()}`, type: 'message', role: 'assistant', model: body.model,
      content: [{ type: 'text', text: answer }], stop_reason: 'end_turn', stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    };
    if (!body.stream) return json(message);
    const frames = [
      { type: 'message_start', message: { ...message, content: [], stop_reason: null } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: answer } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 0 } },
      { type: 'message_stop' },
    ];
    return new Response(frames.map(frame => `event: ${frame.type}\ndata: ${JSON.stringify(frame)}\n\n`).join(''), {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }
  state.blockedExternalRequests += 1;
  throw new Error('Native recovery fixture blocked a non-allowlisted network destination');
};

async function apiContext(req: Request): Promise<ApiContext> {
  const authorization = req.headers.get('authorization') ?? '';
  const supabase = createClient(backend.origin, status.ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authorization.replace(/^Bearer\s+/i, '');
  const result = token ? await supabase.auth.getUser(token) : null;
  return {
    req, supabase, user: result?.data.user ?? null, supabaseUrl: backend.origin,
    supabaseServiceRoleKey: serviceRoleKey, storageBucket: 'dream-images',
  };
}

Deno.serve({ hostname: '127.0.0.1', port, onListen: () => console.log(`Native recovery API ready on loopback:${port}`) }, async req => {
  const path = new URL(req.url).pathname;
  if (path === '/__state' || path === '/__control') {
    if (req.headers.get('X-E2E-Control-Token') !== controlToken) return json({ error: 'Unauthorized' }, 401);
    if (path === '/__state') return json({ ...state, analysisHold, pendingWorkers: jobs.size, analysisText, chatText });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const command = await req.json();
    if (command.reset === true) {
      if (jobs.size) return json({ error: 'Cannot reset while a real worker is active' }, 409);
      state.analysisProviderCalls = state.chatProviderCalls = state.categorizationProviderCalls = 0;
      state.analysisDispatches = 0;
      state.droppedChatCompletions = state.blockedExternalRequests = state.workerFailures = 0;
      state.analysisRequests = []; state.chatRequests = [];
      state.backendFailures = [];
      chatDropDone = false;
    }
    if (command.analysisHold === true && !analysisHold) {
      analysisHold = true;
      analysisGate = new Promise<void>(resolve => { releaseAnalysis = resolve; });
    } else if (command.analysisHold === false) {
      analysisHold = false; releaseAnalysis?.(); releaseAnalysis = undefined;
    }
    if (typeof command.chatDropDone === 'boolean') chatDropDone = command.chatDropDone;
    return json({ ok: true });
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const context = await apiContext(req);
    // Guest AI is outside these authenticated recovery journeys. Failure is
    // explicit, never a fabricated session or a fabricated successful result.
    if (!context.user) return json({ error: 'Sign in required' }, 401);
    switch (path.replace(/^\/functions\/v1\/api/, '')) {
      case '/analysis-jobs': {
        const body = await req.clone().json();
        state.analysisRequests.push(body.analysisRequestId);
        return handleCreateAnalysisJob(context);
      }
      case '/analysis-jobs/status': return handleGetAnalysisJobStatus(context);
      case '/quota/status': return handleQuotaStatus(context);
      case '/categorizeDream': return handleCategorizeDream(context);
      case '/chat': {
        const body = await req.clone().json();
        state.chatRequests.push(body.clientRequestId);
        const response = await handleChat(context);
        if (!chatDropDone || !response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) return response;
        // Read the actual stream through the real atomic commit, then remove
        // only its final acknowledgement. The client sees a broken stream and
        // must retry the same request, whose server receipt already exists.
        const stream = await response.text();
        if (!stream.split('\n').some(line => line.startsWith('data: ') && JSON.parse(line.slice(6)).done === true)) {
          return new Response(stream, { status: response.status, headers: response.headers });
        }
        chatDropDone = false;
        state.droppedChatCompletions += 1;
        const truncated = stream.split('\n\n').filter(frame => !frame.split('\n').some(line =>
          line.startsWith('data: ') && JSON.parse(line.slice(6)).done === true)).join('\n\n');
        return new Response(truncated, { status: response.status, headers: response.headers });
      }
      default: return json({ error: 'Route excluded from native recovery QA' }, 503);
    }
  } catch {
    return json({ error: 'Native recovery fixture failed' }, 500);
  }
});
