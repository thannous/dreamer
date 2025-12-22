// Deno Deploy / Supabase Edge Function (name: api)
// Routes:
// - POST /api/analyzeDream { transcript } -> { title, interpretation, shareableQuote, theme, dreamType, imagePrompt }
// - POST /api/categorizeDream { transcript } -> { title, theme, dreamType, hasPerson, hasAnimal }
// - POST /api/generateImage { prompt } -> { imageUrl | imageBytes }
// - POST /api/generateImageWithReference { prompt, referenceImages } -> { imageUrl } (auth required)
// - POST /api/analyzeDreamFull { transcript } -> { title, interpretation, shareableQuote, theme, dreamType, imagePrompt, imageBytes }
// - POST /api/chat { history, message, lang } -> { text }
// - POST /api/subscription/sync { source? } -> { ok, tier, updated, currentTier }
// - POST /api/subscription/reconcile { batchSize?, maxTotal?, minAgeHours? } -> { ok, processed, updated, changed }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from './lib/constants.ts';
import { handleChat } from './routes/chat.ts';
import { handleAnalyzeDream, handleAnalyzeDreamFull, handleCategorizeDream } from './routes/dreams.ts';
import { handleGenerateImage, handleGenerateImageWithReference } from './routes/images.ts';
import { handleGuestSession } from './routes/guestSession.ts';
import { handleAuthMarkUpgrade, handleQuotaStatus } from './routes/quota.ts';
import { handleSubscriptionReconcile, handleSubscriptionSync } from './routes/subscription.ts';
import type { ApiContext } from './types.ts';

type RouteHandler = (ctx: ApiContext) => Promise<Response>;

const routes = new Map<string, RouteHandler>([
  ['POST /guest/session', async (ctx) => handleGuestSession(ctx.req)],
  ['POST /subscription/sync', handleSubscriptionSync],
  ['POST /subscription/reconcile', handleSubscriptionReconcile],
  ['POST /quota/status', handleQuotaStatus],
  ['POST /auth/mark-upgrade', handleAuthMarkUpgrade],
  ['POST /chat', handleChat],
  ['POST /analyzeDream', handleAnalyzeDream],
  ['POST /analyzeDreamFull', handleAnalyzeDreamFull],
  ['POST /categorizeDream', handleCategorizeDream],
  ['POST /generateImage', handleGenerateImage],
  ['POST /generateImageWithReference', handleGenerateImageWithReference],
]);

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const { pathname } = new URL(req.url);
  const segments = pathname.split('/').filter(Boolean); // [ 'api', ...]
  const subPath = '/' + segments.slice(1).join('/'); // '/analyzeDream'

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  const { data: authData } = await supabase.auth.getUser().catch(() => ({ data: null }));
  const user = authData?.user ?? null;

  const storageBucket = Deno.env.get('SUPABASE_STORAGE_BUCKET') ?? 'dream-images';
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? null;

  const handler = routes.get(`${req.method} ${subPath}`);
  if (!handler) {
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  return await handler({
    req,
    supabase,
    user,
    supabaseUrl,
    supabaseServiceRoleKey,
    storageBucket,
  });
});
