/**
 * Local development API for `node tools/dev-local/dev-local.mjs`. Never deployed: the hosted
 * functions do not import this directory.
 *
 * One port serves the app: Auth, Data API and Storage are forwarded to the
 * native Supabase stack, and /functions/v1/{api,capture-recall} run the real
 * route table. Model calls get fixed answers (deterministic-ai.ts); every other
 * external destination is refused. Guest sessions keep the real flow with
 * local verifiers: App Attest in its development environment for this team's
 * builds, any Play Integrity token, any Turnstile token. Store sync reports the
 * stored entitlement instead of calling RevenueCat.
 */
import { parseDevLocalManifest } from './manifest.ts';
import { answerProviderRequest } from './deterministic-ai.ts';

const manifestPath = Deno.env.get('DEV_LOCAL_MANIFEST');
if (!manifestPath) throw new Error('DEV_LOCAL_MANIFEST is required; start with node tools/dev-local/dev-local.mjs');
const manifest = parseDevLocalManifest(JSON.parse(await Deno.readTextFile(manifestPath)));
const stackOrigin = new URL(manifest.status.API_URL).origin;
const publicOrigin = manifest.publicOrigin;

// Handlers read their configuration from the environment. Set it before they
// load; provider keys are placeholders the transport below never sends anywhere.
const env: Record<string, string> = {
  SUPABASE_URL: publicOrigin,
  SUPABASE_ANON_KEY: manifest.status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: manifest.status.SERVICE_ROLE_KEY,
  SUPABASE_STORAGE_BUCKET: 'dream-images',
  GUEST_SESSION_SECRET: manifest.guestSessionSecret,
  ANTHROPIC_API_KEY: 'dev-local-fixed-answers',
  GEMINI_API_KEY: 'dev-local-fixed-answers',
  GOOGLE_CLOUD_STT_API_KEY: 'dev-local-fixed-answers',
  // Cloudflare's documented always-pass test secret; the verifier below never calls Cloudflare.
  TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
  IOS_APP_ATTEST_ALLOWED_APPS: JSON.stringify(manifest.iosAppAttest.bundleIds.map((bundleId) => ({
    teamId: manifest.iosAppAttest.teamId, bundleId, environment: 'development', minimumBundleVersion: '1',
  }))),
  PRODUCT_ANALYTICS_INGEST_ENABLED: 'false',
};
for (const [key, value] of Object.entries(env)) Deno.env.set(key, value);
for (const key of ['PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64', 'REVENUECAT_SECRET_API_KEY', 'APPLE_PRIVATE_KEY']) {
  Deno.env.delete(key);
}

const { createApiHandler } = await import('../../supabase/functions/api/router.ts');
const { apiRoutes } = await import('../../supabase/functions/api/routeTable.ts');
const { handleGuestSession } = await import('../../supabase/functions/api/routes/guestSession.ts');
const { handleRecallQuestion } = await import('../../supabase/functions/api/routes/recall.ts');
const { handleFormatRecall } = await import('../../supabase/functions/api/routes/formatRecall.ts');
const { handleAnalysisJobWorkerRequest } = await import('../../supabase/functions/analysis-job-worker/index.ts');
const { handleImageJobWorkerRequest } = await import('../../supabase/functions/image-job-worker/index.ts');

const localGuest = {
  // A local build's Play Integrity token cannot be decoded without Google; the
  // device binding (fingerprint, request hash) is still checked by the route.
  verifyIntegrity: async () => ({ ok: true, requestedAtMs: Date.now() }),
  isTurnstileConfigured: () => true,
  verifyTurnstile: async (input: { token: string }) =>
    input.token?.trim() ? { ok: true } : { ok: false, reason: 'missing_token' },
};
type Handler = Parameters<typeof createApiHandler>[0]['routes'] extends Map<string, infer H> ? H : never;
const routes = new Map<string, Handler>(apiRoutes);
routes.set('POST /guest/session', async (ctx) => handleGuestSession(ctx.req, localGuest));
// Store sync needs RevenueCat. Locally the stored entitlement is the truth: report it
// unchanged, so the Plus account stays Plus and the app gets no server error.
const { createClient } = await import('jsr:@supabase/supabase-js@2');
const storedSubscription: Handler = async (ctx) => {
  if (!ctx.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const admin = createClient(ctx.supabaseUrl, ctx.supabaseServiceRoleKey!, { auth: { persistSession: false } });
  const { data, error } = await admin.from('subscription_state').select('tier,is_active,version')
    .eq('user_id', ctx.user.id).maybeSingle();
  if (error) return Response.json({ error: 'Local subscription state unavailable' }, { status: 503 });
  return Response.json({
    ok: true, tier: data?.tier === 'plus' && data.is_active ? 'plus' : 'free', isActive: Boolean(data?.is_active),
    version: typeof data?.version === 'number' ? data.version : 0, updated: false, skipped: true, changed: false,
    outcome: 'local_backend',
  });
};
routes.set('POST /subscription/refresh', storedSubscription);
routes.set('POST /subscription/sync', storedSubscription);
const api = createApiHandler({ routes });
const captureRecall = createApiHandler({ routes: new Map<string, Handler>([
  ['POST /recall-question', handleRecallQuestion], ['POST /format-recall', handleFormatRecall],
]) });

const SUPABASE_SERVICE = /^\/(?:auth|rest|storage)\/v1(?:\/|$)/;
const originalFetch = globalThis.fetch;
let blocked = 0;

/** Handle a request addressed to this server, from a phone or from a handler. */
async function route(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (SUPABASE_SERVICE.test(path)) {
    const target = new URL(path + url.search, stackOrigin);
    const headers = new Headers(request.headers);
    headers.delete('host');
    const forwarded = await originalFetch(new Request(target, {
      method: request.method, headers, body: request.body, redirect: 'manual',
      // @ts-ignore Deno accepts duplex for streamed request bodies.
      duplex: 'half',
    }));
    if (forwarded.status >= 300 && forwarded.status < 400 && forwarded.headers.get('location')) {
      return Response.json({ error: 'Redirect refused by the local backend' }, { status: 502 });
    }
    return forwarded;
  }
  // Supabase strips /functions/v1 before a function sees its path.
  const functionPath = path.replace(/^\/functions\/v1(?=\/)/, '');
  const local = new Request(new URL(functionPath + url.search, publicOrigin), request);
  if (functionPath === '/api' || functionPath.startsWith('/api/')) return api(local);
  if (functionPath.startsWith('/capture-recall/')) return captureRecall(local);
  if (functionPath === '/analysis-job-worker') return handleAnalysisJobWorkerRequest(local);
  if (functionPath === '/image-job-worker') return handleImageJobWorkerRequest(local);
  return Response.json({ error: 'Not served by the local backend' }, { status: 404 });
}

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.origin === publicOrigin || url.origin === stackOrigin) return route(request);
  const provider = await answerProviderRequest(request);
  if (provider) return provider;
  blocked += 1;
  console.warn(`[dev-local] blocked ${request.method} ${url.hostname} (${blocked} so far): only this machine is reachable`);
  throw new Error(`The local backend does not reach ${url.hostname}`);
};

// Only the chosen private address answers (not every interface), so another network
// this machine joins never sees the local verifiers. `--host` picks the address.
Deno.serve({ hostname: new URL(publicOrigin).hostname, port: manifest.port, onListen: () => {
  console.log(JSON.stringify({ ready: true, origin: publicOrigin }));
} }, async (request) => {
  try {
    return await route(request);
  } catch (error) {
    console.error('[dev-local] request failed', error instanceof Error ? error.message : error);
    return Response.json({ error: 'Local backend failure' }, { status: 500 });
  }
});
