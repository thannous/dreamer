import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildSupabaseUserAuthHeaders, resolveSupabaseUserBearer } from './lib/authHeader.ts';
import { corsHeaders } from './lib/constants.ts';
import { errorResponse } from './lib/http.ts';
import type { ApiContext } from './types.ts';

export type RouteHandler = (ctx: ApiContext) => Promise<Response>;
export type RouteTable = Map<string, RouteHandler>;

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

      const { data: authData } = userBearer
        ? await supabase.auth.getUser(userBearer).catch(() => ({ data: null }))
        : { data: null };
      const user = authData?.user ?? null;

      const storageBucket = readEnv('SUPABASE_STORAGE_BUCKET') ?? 'dream-images';
      const supabaseServiceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY') ?? null;

      const handler = routes.get(route);
      if (!handler) {
        if (!user) {
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
