// Deno Deploy / Supabase Edge Function (name: api)
// Routes:
// - POST /api/analyzeDream { transcript } -> { title, interpretation, shareableQuote, theme, dreamType, imagePrompt }
// - POST /api/categorizeDream { transcript } -> { title, theme, dreamType, hasPerson, hasAnimal }
// - POST /api/generateImage { prompt } -> { imageUrl | imageBytes }
// - POST /api/generateImageWithReference { prompt|transcript, referenceImages } -> { imageUrl }
// - POST /api/analyzeDreamFull { transcript } -> { title, interpretation, shareableQuote, theme, dreamType, imagePrompt, imageBytes }
// - POST /api/chat { history, message, lang } -> { text }
// - POST /api/transcribe { contentBase64, encoding, languageCode, sampleRateHertz? } -> { transcript }
// - POST /api/subscription/refresh { source? } -> { ok, tier, version, updated }
// - POST /api/subscription/sync { source? } -> { ok, tier, version, updated }
// - POST /api/subscription/reconcile { batchSize?, maxTotal?, minAgeHours? } -> { ok, processed, updated, changed }
// - DELETE /api/account -> { deleted }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleDeleteAccount } from './routes/account.ts';
import { handleStoreAppleAuthToken } from './routes/appleAuthToken.ts';
import { handleChat } from './routes/chat.ts';
import { handleAnalyzeDream, handleAnalyzeDreamFull, handleCategorizeDream } from './routes/dreams.ts';
import { handleCreateImageJob, handleGetImageJobStatus } from './routes/imageJobs.ts';
import { handleGenerateImage, handleGenerateImageWithReference } from './routes/images.ts';
import { handleGuestSession } from './routes/guestSession.ts';
import {
  handleGuestQaEnroll,
  handleGuestQaRevoke,
  handleGuestQaStatus,
} from './routes/guestQa.ts';
import { handleAuthMarkUpgrade, handleQuotaStatus } from './routes/quota.ts';
import { handleSubscriptionRefresh, handleSubscriptionReconcile, handleSubscriptionSync } from './routes/subscription.ts';
import { handleTranscribe } from './routes/transcribe.ts';
import { handleProductAnalytics } from './routes/analytics.ts';
import { handleAnalyticsGuestSession } from './routes/analyticsSession.ts';
import {
  handleCreateAnalysisJob,
  handleGetAnalysisJobStatus,
} from './routes/analysisJobs.ts';
import { createApiHandler, type RouteHandler } from './router.ts';

const routes = new Map<string, RouteHandler>([
  ['POST /guest/session', async (ctx) => handleGuestSession(ctx.req)],
  ['POST /qa/guest-device/status', handleGuestQaStatus],
  ['POST /qa/guest-device/enroll', handleGuestQaEnroll],
  ['POST /qa/guest-device/revoke', handleGuestQaRevoke],
  ['POST /analytics/session', async (ctx) => handleAnalyticsGuestSession(ctx.req)],
  ['POST /analytics/events', handleProductAnalytics],
  ['DELETE /analytics/events', handleProductAnalytics],
  ['POST /subscription/refresh', handleSubscriptionRefresh],
  ['POST /subscription/sync', handleSubscriptionSync],
  ['POST /subscription/reconcile', handleSubscriptionReconcile],
  ['POST /quota/status', handleQuotaStatus],
  ['POST /auth/mark-upgrade', handleAuthMarkUpgrade],
  ['POST /auth/apple-token', handleStoreAppleAuthToken],
  ['DELETE /account', handleDeleteAccount],
  ['POST /chat', handleChat],
  ['POST /transcribe', handleTranscribe],
  ['POST /analyzeDream', handleAnalyzeDream],
  ['POST /analyzeDreamFull', handleAnalyzeDreamFull],
  ['POST /categorizeDream', handleCategorizeDream],
  ['POST /analysis-jobs', handleCreateAnalysisJob],
  ['POST /analysis-jobs/status', handleGetAnalysisJobStatus],
  ['POST /image-jobs', handleCreateImageJob],
  ['POST /image-jobs/status', handleGetImageJobStatus],
  ['POST /generateImage', handleGenerateImage],
  ['POST /generateImageWithReference', handleGenerateImageWithReference],
]);

serve(createApiHandler({ routes }));
