// The deployed `api` function's routes. Kept apart from index.ts so the local
// development backend (tools/dev-local) serves the same table without listening.
import { handleDeleteAccount } from './routes/account.ts';
import { handleStoreAppleAuthToken } from './routes/appleAuthToken.ts';
import { handleChat } from './routes/chat.ts';
import { handleRecallQuestion } from './routes/recall.ts';
import { handleFormatRecall } from './routes/formatRecall.ts';
import { handleMoonLetter } from './routes/moonLetter.ts';
import { handleAnalysisPreview } from './routes/analysisPreview.ts';
import { handleAnalyzeDream, handleAnalyzeDreamFull, handleCategorizeDream } from './routes/dreams.ts';
import { handleCreateImageJob, handleGetImageJobStatus } from './routes/imageJobs.ts';
import { handleGenerateImage } from './routes/images.ts';
import { handleGuestSession, handleIosGuestChallenge } from './routes/guestSession.ts';
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
import type { RouteHandler } from './router.ts';

export const apiRoutes = new Map<string, RouteHandler>([
  ['POST /guest/session', async (ctx) => handleGuestSession(ctx.req)],
  ['POST /guest/session/challenge', async (ctx) => handleIosGuestChallenge(ctx.req)],
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
  ['POST /recall-question', handleRecallQuestion], ['POST /format-recall', handleFormatRecall],
  ['POST /moon-letter', handleMoonLetter],
  ['POST /analysis-preview', handleAnalysisPreview],
  ['POST /transcribe', handleTranscribe],
  ['POST /analyzeDream', handleAnalyzeDream],
  ['POST /analyzeDreamFull', handleAnalyzeDreamFull],
  ['POST /categorizeDream', handleCategorizeDream],
  ['POST /analysis-jobs', handleCreateAnalysisJob],
  ['POST /analysis-jobs/status', handleGetAnalysisJobStatus],
  ['POST /image-jobs', handleCreateImageJob],
  ['POST /image-jobs/status', handleGetImageJobStatus],
  ['POST /generateImage', handleGenerateImage],
]);
