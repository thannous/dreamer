// Deno Deploy / Supabase Edge Function (name: api)
// Routes:
// - POST /api/analyzeDream { transcript } -> { title, interpretation, shareableQuote, theme, dreamType, imagePrompt }
// - POST /api/categorizeDream { transcript } -> { title, theme, dreamType, hasPerson, hasAnimal }
// - POST /api/generateImage { prompt } -> { imageUrl | imageBytes }
// - POST /api/analyzeDreamFull { transcript } -> { title, interpretation, shareableQuote, theme, dreamType, imagePrompt, imageBytes }
// - POST /api/chat { history, message, lang } -> { text }
// - POST /api/transcribe { contentBase64, encoding, languageCode, sampleRateHertz? } -> { transcript }
// - POST /api/subscription/refresh { source? } -> { ok, tier, version, updated }
// - POST /api/subscription/sync { source? } -> { ok, tier, version, updated }
// - POST /api/subscription/reconcile { batchSize?, maxTotal?, minAgeHours? } -> { ok, processed, updated, changed }
// - DELETE /api/account -> { deleted }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { apiRoutes } from './routeTable.ts';
import { createApiHandler } from './router.ts';

serve(createApiHandler({ routes: apiRoutes }));
