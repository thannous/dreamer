import { createClient } from 'jsr:@supabase/supabase-js@2';
import { classifyClaudeError, requireAnthropicApiKey } from '../services/claude.ts';
import { requireUser } from '../lib/guards.ts';
import { jsonResponse } from '../lib/http.ts';
import { AI_REQUEST_LIMITS, normalizeAiLanguage } from '../lib/aiRequestPolicy.ts';
import { resolveStoredTranscriptForAi } from '../lib/prompts.ts';
import {
  ANALYSIS_PREVIEW_WINDOW_MS,
  PREVIEW_LANGUAGES,
  PREVIEW_PAINTING_TIMEOUT_MS,
  isPreparedReading,
  previewOf,
  transcriptSha256,
} from '../lib/analysisPreview.ts';
import { admitSynchronousAiRequest } from '../services/aiAdmission.ts';
import {
  CLAUDE_SYNC_ANALYSIS_TIMEOUT_MS,
  keepStoredDreamClass,
  loadKnownDreamSymbols,
  runDreamAnalysis,
} from '../services/dreamAnalysis.ts';
import type { StructuredDreamAnalysis } from '../services/dreamAnalysis.ts';
import { BAND_LINK_SECONDS, paintPreparedIllustration, removePreviewObjects } from '../services/previewIllustration.ts';
import type { ApiContext } from '../types.ts';

type Dependencies = {
  now?: () => number;
  createAdminClient?: typeof createClient;
  apiKey?: string;
  /** Defaults to ANTHROPIC_API_KEY; null fails closed. */
  anthropicApiKey?: string | null;
  admit?: typeof admitSynchronousAiRequest;
  analyze?: typeof runDreamAnalysis;
  paint?: typeof paintPreparedIllustration;
  /** Keeps a task running after the response; false when the caller must wait for it. */
  runInBackground?: (task: Promise<void>) => boolean;
};

/**
 * A request that holds a preview longer than this has failed; another may write it.
 * hold_analysis_preview (20261021235000) uses the same three minutes.
 */
const WRITING_TIMEOUT_MS = 3 * 60 * 1000;
/** A reading written later than this after its hold is not saved: the hold could be gone, the week taken. */
const SAVE_DEADLINE_MS = WRITING_TIMEOUT_MS - 30 * 1000;

const runInEdgeBackground = (task: Promise<void>): boolean => {
  const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
  if (typeof edgeRuntime?.waitUntil !== 'function') return false;
  edgeRuntime.waitUntil(task);
  return true;
};

type PreviewRow = {
  dream_id: number;
  status: 'writing' | 'ready' | 'used' | 'removed';
  lang: string;
  transcript_sha256: string;
  reading: unknown;
  image_status: 'none' | 'painting' | 'ready' | 'used' | 'failed';
  image_prompt: string | null;
  image_path: string | null;
  band_path: string | null;
  band_url: string | null;
  image_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

type DreamRow = {
  id: number;
  title: string | null;
  transcript: string | null;
  is_analyzed: boolean | null;
  analysis_status: string | null;
  theme: string | null;
  precise_theme: string | null;
  dream_type: string | null;
};

/** What save_analysis_preview answers. */
type Save = { state?: 'saved' | 'gone' | 'analyzed' | 'pending' | 'changed' | 'lost'; saved_at?: string; row?: PreviewRow };

/** What hold_analysis_preview answers. */
type Hold = {
  state?: 'held' | 'writing' | 'weekly_limit' | 'gone' | 'analyzed' | 'pending';
  held_at?: string;
  retry_at?: string;
  previous_image_path?: string | null;
  previous_band_path?: string | null;
};

const PREVIEW_COLUMNS =
  'dream_id, status, lang, transcript_sha256, reading, image_status, image_prompt, image_path, band_path, band_url, image_updated_at, created_at, updated_at';

const refused = (code: string, status: number) => jsonResponse({ error: 'Preview unavailable', code }, status);

/**
 * The prepared analysis of a dream, for a free account past its monthly analyses. Without
 * `prepare` it only says what the dream has: its preview, or whether one can be prepared.
 * With `prepare`, it writes the analysis once, keeps it on the server and returns its title,
 * first sentence and symbols' names, then paints its illustration, of which the account
 * sees a band only. A free account prepares one new analysis per rolling week; the dream's
 * analysis and image jobs take what was kept when the account opens it.
 */
export async function handleAnalysisPreview(ctx: ApiContext, deps: Dependencies = {}): Promise<Response> {
  const unauthorized = requireUser(ctx.user);
  if (unauthorized) return unauthorized;
  const userId: string = ctx.user.id;
  let body;
  try { body = await ctx.req.json(); } catch { return jsonResponse({ error: 'Invalid request' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return jsonResponse({ error: 'Invalid request' }, 400);
  const dreamId = body.dreamId;
  if (typeof dreamId !== 'number' || !Number.isSafeInteger(dreamId) || dreamId <= 0) {
    return jsonResponse({ error: 'Invalid dream' }, 400);
  }
  if (typeof body.lang !== 'string' || body.lang.length > AI_REQUEST_LIMITS.languageChars) {
    return jsonResponse({ error: 'Invalid language' }, 400);
  }
  const lang = normalizeAiLanguage(body.lang.trim());
  if (body.prepare !== undefined && typeof body.prepare !== 'boolean') return jsonResponse({ error: 'Invalid request' }, 400);
  // The app asks for the AI consent before a request that prepares.
  const prepare = body.prepare === true;
  const now = (deps.now ?? Date.now)();

  const serviceRoleKey = ctx.supabaseServiceRoleKey?.trim();
  if (!serviceRoleKey) return refused('PREVIEW_UNAVAILABLE', 503);
  const admin = (deps.createAdminClient ?? createClient)(ctx.supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: tierData, error: tierError } = await admin.rpc('get_effective_subscription_tier', { p_user_id: userId });
  if (tierError) return refused('PREVIEW_UNAVAILABLE', 503);
  // Plus analyzes the dream itself, and the analysis takes any reading prepared before.
  if (tierData === 'plus' || tierData === 'premium') return refused('PLUS_ANALYZES', 409);
  if (!PREVIEW_LANGUAGES.includes(lang)) return refused('LANGUAGE_UNSUPPORTED', 409);

  const previews = () => admin.from('analysis_previews');
  const readPreview = async (): Promise<PreviewRow | null> => {
    const { data, error } = await previews().select(PREVIEW_COLUMNS)
      .eq('user_id', userId).eq('dream_id', dreamId).maybeSingle();
    if (error) throw error;
    return (data as PreviewRow | null) ?? null;
  };
  /** The previews that hold this week's: a failed writing left behind gave nothing. */
  const weekPreviews = async (): Promise<PreviewRow[]> => {
    const { data, error } = await previews().select(PREVIEW_COLUMNS)
      .eq('user_id', userId).gt('created_at', new Date(now - ANALYSIS_PREVIEW_WINDOW_MS).toISOString())
      .order('created_at', { ascending: true }).limit(20);
    if (error) throw error;
    return ((data ?? []) as PreviewRow[])
      .filter((row) => row.status !== 'writing' || Date.parse(row.updated_at) > now - WRITING_TIMEOUT_MS);
  };
  const nextPreviewAt = (rows: PreviewRow[]) =>
    new Date(Math.max(...rows.map((row) => Date.parse(row.created_at))) + ANALYSIS_PREVIEW_WINDOW_MS).toISOString();

  try {
    // The caller's own dream, through its row-level security.
    const { data: dreamData, error: dreamError } = await ctx.supabase.from('dreams')
      .select('id, title, transcript, is_analyzed, analysis_status, theme, precise_theme, dream_type')
      .eq('id', dreamId).maybeSingle();
    if (dreamError) return refused('PREVIEW_UNAVAILABLE', 503);
    const dream = (dreamData as DreamRow | null) ?? null;
    if (!dream) return refused('DREAM_NOT_FOUND', 404);
    if (dream.is_analyzed === true) return refused('ALREADY_ANALYZED', 409);
    if (dream.analysis_status === 'pending') return refused('ANALYSIS_PENDING', 409);
    const transcript = resolveStoredTranscriptForAi(dream.transcript, AI_REQUEST_LIMITS.transcriptRequestChars);
    if (!transcript.ok) return refused('INVALID_TRANSCRIPT', 422);
    const sha256 = await transcriptSha256(transcript.storedTranscript);
    // The dream's text as stored, which the save checks again: an edit made while the model writes refuses the reading.
    const dreamSha256 = await transcriptSha256(String(dream.transcript ?? ''));

    // Only a reading of this very text, in this language, is the dream's preview.
    const matches = (row: PreviewRow | null): row is PreviewRow & { reading: StructuredDreamAnalysis } =>
      row?.status === 'ready' && row.lang === lang && row.transcript_sha256 === sha256 && isPreparedReading(row.reading);
    // The band's link is signed again at each read, for an hour only.
    const bandUrl = async (path: string | null) => {
      if (!path) return null;
      const { data, error } = await admin.storage.from(ctx.storageBucket).createSignedUrl(path, BAND_LINK_SECONDS);
      return error || !data?.signedUrl ? null : data.signedUrl as string;
    };
    const ready = async (row: PreviewRow & { reading: StructuredDreamAnalysis }) => {
      const band = row.image_status === 'ready' ? await bandUrl(row.band_path) : null;
      return jsonResponse({
        state: 'ready',
        // The rest of the reading and of the painting never leaves the server before the account opens it.
        preview: {
          ...previewOf(row.reading, keepStoredDreamClass(dream, row.reading).title),
          image: band
            ? { state: 'ready', bandUrl: band }
            // A painting under way, or done but whose link could not be signed this time: read again.
            : (row.image_status === 'painting' && Date.parse(row.image_updated_at ?? '') > now - PREVIEW_PAINTING_TIMEOUT_MS)
                || row.image_status === 'ready'
              ? { state: 'painting', bandUrl: null }
              : { state: 'none', bandUrl: null },
        },
        preparedAt: new Date(row.created_at).toISOString(),
        retryAt: null,
      });
    };
    const status = (state: 'available' | 'writing' | 'weekly_limit', retryAt: string | null = null) =>
      jsonResponse({ state, preview: null, preparedAt: null, retryAt });
    const apiKey = deps.apiKey ?? Deno.env.get('GEMINI_API_KEY');

    // The painting follows the reading: the account reads the start of its analysis meanwhile.
    // It is recorded only for the painting started at `since`.
    const paintFrom = async (prompt: string, since: string) => {
      // Opened meanwhile, the preview is spent but its painting is still the analysis's illustration.
      const stillPainting = (values: Record<string, unknown>) => previews().update(values)
        .eq('user_id', userId).eq('dream_id', dreamId).in('status', ['ready', 'used'])
        .eq('image_status', 'painting').eq('image_updated_at', since);
      try {
        const painted = await (deps.paint ?? paintPreparedIllustration)({
          admin, bucket: ctx.storageBucket, apiKey: apiKey!, userId, dreamId, prompt,
        });
        const { data, error } = await stillPainting({
          image_status: 'ready', image_path: painted.imagePath, band_path: painted.bandPath, band_url: painted.bandUrl,
          image_updated_at: new Date((deps.now ?? Date.now)()).toISOString(),
        }).select('dream_id');
        // Deleted or painted again meanwhile: this one goes.
        if (error || !data?.length) await removePreviewObjects(admin, ctx.storageBucket, [painted.imagePath, painted.bandPath]);
      } catch {
        // Provider payloads and prompts must not enter logs.
        console.warn('[api] /analysis-preview: painting failed');
        await stillPainting({ image_status: 'failed', image_updated_at: new Date((deps.now ?? Date.now)()).toISOString() })
          .then(() => undefined, () => undefined);
      }
    };
    /** Runs the painting after the response where the runtime allows it; the row as it then is. */
    const startPainting = async (row: PreviewRow & { reading: StructuredDreamAnalysis }, prompt: string, since: string) => {
      const task = paintFrom(prompt, since);
      if ((deps.runInBackground ?? runInEdgeBackground)(task)) return ready(row);
      await task;
      const painted = await readPreview();
      return matches(painted) ? ready(painted) : status('writing');
    };

    const existing = await readPreview();
    if (matches(existing)) {
      // A painting whose request stopped before it ended (its three minutes gone, nothing
      // recorded) starts again, once only: the first reader takes it over. A painting started
      // with the reading has the reading's time; a restarted one no longer does.
      const stalled = existing.status === 'ready' && existing.image_status === 'painting' && apiKey
        && typeof existing.image_prompt === 'string' && Date.parse(existing.image_updated_at ?? '') <= now - PREVIEW_PAINTING_TIMEOUT_MS
        && Date.parse(existing.image_updated_at ?? '') === Date.parse(existing.updated_at);
      if (stalled) {
        const since = new Date(now).toISOString();
        const { data: restarted, error: restartError } = await previews()
          .update({ image_updated_at: since })
          .eq('user_id', userId).eq('dream_id', dreamId).eq('status', 'ready').eq('image_status', 'painting')
          .eq('image_updated_at', existing.image_updated_at)
          .select(PREVIEW_COLUMNS);
        const row = (restarted as PreviewRow[] | null)?.[0] ?? null;
        if (!restartError && matches(row)) return startPainting(row, existing.image_prompt!, since);
      }
      return ready(existing);
    }
    if (existing?.status === 'writing' && Date.parse(existing.updated_at) > now - WRITING_TIMEOUT_MS) return status('writing');
    const week = await weekPreviews();
    if (week.length) return status('weekly_limit', nextPreviewAt(week));
    if (!prepare) return status('available');

    // An account with an analysis left analyzes the dream instead.
    const { data: quota, error: quotaError } = await ctx.supabase.rpc('get_authenticated_quota_snapshot', {
      p_target_dream_id: dreamId,
    });
    if (quotaError || !quota || typeof quota !== 'object') return refused('PREVIEW_UNAVAILABLE', 503);
    if ((quota as { canAnalyze?: unknown }).canAnalyze !== false) return refused('CAN_ANALYZE', 409);

    const anthropicApiKey = deps.anthropicApiKey === undefined ? Deno.env.get('ANTHROPIC_API_KEY')?.trim() : deps.anthropicApiKey;
    try { requireAnthropicApiKey(anthropicApiKey ?? ''); } catch (error) {
      const info = classifyClaudeError(error);
      return jsonResponse({ error: info.userMessage, code: 'PREVIEW_UNAVAILABLE' }, info.status);
    }
    if (!apiKey) return refused('PREVIEW_UNAVAILABLE', 503);

    // Under a lock per account, the database checks the dream and the week again and holds
    // the dream's preview while it is written: a second request waits instead of paying twice.
    const { data: holdData, error: holdError } = await admin.rpc('hold_analysis_preview', {
      p_user_id: userId, p_dream_id: dreamId, p_lang: lang, p_transcript_sha256: sha256,
    });
    if (holdError) throw holdError;
    const hold = (holdData ?? {}) as Hold;
    if (hold.state === 'gone') return refused('DREAM_NOT_FOUND', 404);
    if (hold.state === 'analyzed') return refused('ALREADY_ANALYZED', 409);
    if (hold.state === 'pending') return refused('ANALYSIS_PENDING', 409);
    if (hold.state !== 'held' || typeof hold.held_at !== 'string') {
      // Another request held it or took the week meanwhile: whichever preview it kept is the one to show.
      const other = await readPreview();
      if (matches(other)) return ready(other);
      return hold.state === 'weekly_limit' && typeof hold.retry_at === 'string'
        ? status('weekly_limit', new Date(hold.retry_at).toISOString())
        : status('writing');
    }
    const heldAt = hold.held_at;

    let saved = false;
    let savedRow: PreviewRow | null = null;
    let prompt = '';
    let savedAt = '';
    try {
      const admission = await (deps.admit ?? admitSynchronousAiRequest)({ ctx, capability: 'analysis_preview', guestFingerprint: null });
      if (admission instanceof Response) return admission;

      let reading: StructuredDreamAnalysis;
      try {
        // The same reading the analysis job would write, so the job can take it as it is.
        reading = await (deps.analyze ?? runDreamAnalysis)({
          anthropicApiKey,
          claudeTimeoutMs: CLAUDE_SYNC_ANALYSIS_TIMEOUT_MS,
          transcript: transcript.promptTranscript,
          truncatedForPrompt: transcript.truncatedForPrompt,
          lang,
          knownSymbols: await loadKnownDreamSymbols(admin, userId, dreamId, '/analysis-preview'),
          route: '/analysis-preview',
        });
      } catch (error) {
        // Dream content and provider payloads must not enter logs.
        const info = classifyClaudeError(error);
        return jsonResponse({ error: info.userMessage, code: 'PREVIEW_FAILED' }, info.status);
      }
      // A reading the analysis job could not save is no preview.
      if (!isPreparedReading(reading)) return refused('PREVIEW_FAILED', 502);
      if ((deps.now ?? Date.now)() - Date.parse(heldAt) > SAVE_DEADLINE_MS) return refused('PREVIEW_FAILED', 502);

      prompt = reading.imagePrompt.trim();
      // In one transaction, the database checks the dream again (its text, no analysis) and saves.
      const { data: saveData, error: saveError } = await admin.rpc('save_analysis_preview', {
        p_user_id: userId, p_dream_id: dreamId, p_held_at: heldAt, p_dream_transcript_sha256: dreamSha256,
        p_reading: reading, p_image_prompt: prompt,
      });
      if (saveError) throw saveError;
      const save = (saveData ?? {}) as Save;
      saved = save.state === 'saved' && typeof save.saved_at === 'string' && Boolean(save.row);
      if (saved) {
        savedAt = save.saved_at!;
        savedRow = save.row!;
      }
      else if (save.state === 'gone') return refused('DREAM_NOT_FOUND', 404);
      else if (save.state === 'analyzed') return refused('ALREADY_ANALYZED', 409);
      else if (save.state === 'pending') return refused('ANALYSIS_PENDING', 409);
      // Edited meanwhile: the reading was of the former text, and the week is given back.
      else if (save.state === 'changed') return status('available');
      else {
        // Analyzed, deleted or taken over meanwhile.
        const other = await readPreview();
        if (matches(other)) return ready(other);
        if (other?.status === 'used') return refused('ALREADY_ANALYZED', 409);
        return other?.status === 'removed' || !other ? refused('DREAM_NOT_FOUND', 404) : status('writing');
      }
    } finally {
      // A preview not written gives the week back; an older painting of the dream goes either way.
      if (!saved) {
        await previews().delete()
          .eq('user_id', userId).eq('dream_id', dreamId).eq('status', 'writing').eq('updated_at', heldAt)
          .then(() => undefined, () => undefined);
      }
      await removePreviewObjects(admin, ctx.storageBucket, [hold.previous_image_path, hold.previous_band_path]);
    }
    // The row as saved: its painting starts whatever happens to the dream from now on.
    const kept = savedRow;
    if (!matches(kept)) return status('writing');

    return startPainting(kept, prompt, savedAt);
  } catch (error) {
    console.error('[api] /analysis-preview failed', { code: (error as { code?: unknown })?.code ?? null });
    return refused('PREVIEW_UNAVAILABLE', 503);
  }
}
