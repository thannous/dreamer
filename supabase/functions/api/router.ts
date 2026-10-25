import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildSupabaseUserAuthHeaders, hasApplicationClientClaim, resolveSupabaseUserBearer } from './lib/authHeader.ts';
import { corsHeaders } from './lib/constants.ts';
import { errorResponse } from './lib/http.ts';
import { isProductRouteAllowed } from './lib/productAuthorization.ts';
import type { ApiContext } from './types.ts';

export type RouteHandler = (ctx: ApiContext) => Promise<Response>;
export type RouteTable = Map<string, RouteHandler>;

// Reject reasons the router logs for a scoped bearer without a valid user.
// Only these literal codes reach the log; anything else becomes 'unknown'.
const ROUTER_REJECT_REASONS = ['scoped_bearer_lookup_failed', 'scoped_bearer_no_user'] as const;
export type RouterRejectReason = typeof ROUTER_REJECT_REASONS[number];
const ROUTER_REJECT_REASON_SET: ReadonlySet<string> = new Set(ROUTER_REJECT_REASONS);

export function toLoggedRouterReason(reason: unknown): RouterRejectReason | 'unknown' {
  return typeof reason === 'string' && ROUTER_REJECT_REASON_SET.has(reason)
    ? reason as RouterRejectReason
    : 'unknown';
}

const LOGGED_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']);
// A segment is logged as-is only when it reads like a route word: letters,
// '_' or '-', no digits, bounded length. Ids, tokens, emails or anything else
// a caller can put in a path become ':param', so the log never carries them.
const LOGGED_SEGMENT = /^[A-Za-z][A-Za-z_-]{0,47}$/;
const MAX_LOGGED_SEGMENTS = 6;

/** Method and route shape of a request, safe to log. */
export function toLoggedRoute(method: string, subPath: string): { method: string; route: string } {
  const segments = subPath.split('/').filter(Boolean);
  const shown = segments.slice(0, MAX_LOGGED_SEGMENTS)
    .map((segment) => (LOGGED_SEGMENT.test(segment) ? segment : ':param'));
  if (segments.length > MAX_LOGGED_SEGMENTS) shown.push(':more');
  return {
    method: LOGGED_METHODS.has(method) ? method : 'OTHER',
    route: '/' + shown.join('/'),
  };
}

export type ApiHandlerDependencies = {
  routes: RouteTable;
  createClient?: typeof createClient;
  readEnv?: (name: string) => string | undefined;
};

// Builds the request handler passed to serve() in index.ts. Kept separate from the
// entrypoint (which starts the server at module load) and from the route table
// (whose handlers pull in heavy dependencies) so the dispatch logic — including the
// global error boundary — can be unit-tested with an injected route table.
export const createApiHandler = (dependencies: ApiHandlerDependencies) => {
  const { routes } = dependencies;
  const createSupabaseClient = dependencies.createClient ?? createClient;
  const readEnv = dependencies.readEnv ?? ((name: string) => Deno.env.get(name));

  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const { pathname } = new URL(req.url);
    const segments = pathname.split('/').filter(Boolean); // [ 'api', ...]
    const subPath = '/' + segments.slice(1).join('/'); // '/analyzeDream'
    const route = `${req.method} ${subPath}`;

    try {
      const supabaseUrl = readEnv('SUPABASE_URL')!;
      const supabaseAnon = readEnv('SUPABASE_ANON_KEY')!;
      const userBearer = resolveSupabaseUserBearer(req.headers.get('Authorization'));
      const supabase = createSupabaseClient(supabaseUrl, supabaseAnon, {
        global: { headers: buildSupabaseUserAuthHeaders(req.headers.get('Authorization')) },
      });

      let userLookupFailed = false;
      const { data: authData } = userBearer
        ? await supabase.auth.getUser(userBearer).catch(() => {
          userLookupFailed = true;
          return { data: null };
        })
        : { data: null };
      const user = authData?.user ?? null;

      if (hasApplicationClientClaim(req.headers.get('Authorization'))) {
        // An invalid scoped bearer must not fall through to a guest handler.
        if (!user) {
          // Reason code and method only: never the bearer, its claims or the caller.
          console.warn('[api] scoped bearer rejected', {
            reason: toLoggedRouterReason(userLookupFailed ? 'scoped_bearer_lookup_failed' : 'scoped_bearer_no_user'),
            method: toLoggedRoute(req.method, subPath).method,
          });
          return errorResponse('Unauthorized', 401);
        }
        try {
          // PostgREST validates the caller JWT again. The RPC reads its signed
          // client_id against a private registry, never a request/body appId.
          const { data: product, error } = await supabase.rpc('current_app_product');
          if (error) return errorResponse('Application authorization unavailable', 503);
          if (!isProductRouteAllowed(product, route)) return errorResponse('Forbidden', 403);
        } catch {
          return errorResponse('Application authorization unavailable', 503);
        }
      }

      const storageBucket = readEnv('SUPABASE_STORAGE_BUCKET') ?? 'dream-images';
      const supabaseServiceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY') ?? null;

      const handler = routes.get(route);
      if (!handler) {
        if (!user) {
          // Route shape and method only: path ids, headers and tokens stay out.
          console.warn('[api] unmatched route without user', toLoggedRoute(req.method, subPath));
          return errorResponse('Unauthorized', 401);
        }

        return errorResponse('Not found', 404);
      }

      return await handler({
        req,
        supabase,
        user,
        supabaseUrl,
        supabaseServiceRoleKey,
        storageBucket,
      });
    } catch (error) {
      // Security: never log request bodies, headers, tokens or dream content here.
      console.error('[api] unhandled error', {
        route,
        method: req.method,
        message: error instanceof Error ? error.message : String(error),
      });
      return errorResponse('Internal server error', 500);
    }
  };
};
