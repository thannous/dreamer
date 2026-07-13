import { createClient } from 'jsr:@supabase/supabase-js@2';

import { verifyAnalyticsGuestToken } from '../lib/analyticsGuestToken.ts';
import { corsHeaders } from '../lib/constants.ts';
import type { ApiContext } from '../types.ts';

const MAX_BODY_BYTES = 32 * 1024;
const MAX_BATCH_SIZE = 20;
const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

const EVENT_NAMES = [
  'app_session_started',
  'onboarding_started',
  'onboarding_step_viewed',
  'onboarding_completed',
  'onboarding_destination_viewed',
  'dream_capture_started',
  'recording_started',
  'recording_saved',
  'recording_activation_insight_shown',
  'analysis_started',
  'analysis_completed',
  'analysis_offer_viewed',
  'first_dream_next_action_selected',
  'analysis_failed',
  'analysis_result_viewed',
  'symbol_detail_viewed',
  'first_value_viewed',
  'paywall_viewed',
  'empty_journal_remembered_cta_clicked',
  'onboarding_choice_selected',
] as const;

type AnalyticsEventName = (typeof EVENT_NAMES)[number];
type Primitive = string | number | boolean | null;
type Properties = Record<string, Primitive>;

export type ValidatedAnalyticsEvent = {
  event_id: string;
  event_name: AnalyticsEventName;
  schema_version: 1;
  occurred_at: string;
  journey_id: string | null;
  platform: 'android';
  app_version: string;
  locale: 'fr' | 'en' | 'es' | 'de' | 'it';
  properties: Properties;
};

type PropertyValidator = (value: unknown) => boolean;
type PropertySchema = Record<string, PropertyValidator>;

const oneOf = <T extends string>(...values: T[]): PropertyValidator =>
  (value) => typeof value === 'string' && values.includes(value as T);
const bool: PropertyValidator = (value) => typeof value === 'boolean';
const nullableShortString: PropertyValidator = (value) =>
  value === null || (typeof value === 'string' && value.length <= 96 && /^[a-zA-Z0-9._:-]*$/.test(value));
const nullableCount: PropertyValidator = (value) =>
  value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1_000_000);
const supportedLanguage = oneOf('fr', 'en', 'es', 'de', 'it');
const tier = oneOf('guest', 'free', 'plus');

const PROPERTY_SCHEMAS: Record<AnalyticsEventName, PropertySchema> = {
  app_session_started: { source: oneOf('cold_start', 'foreground') },
  onboarding_started: { experience_version: (value) => value === 2 },
  onboarding_step_viewed: { step: oneOf('intro', 'path') },
  onboarding_completed: {
    reason: oneOf('analyze', 'memory', 'dictionary', 'skip'),
    experience_version: (value) => value === 2,
  },
  onboarding_destination_viewed: {
    destination: oneOf('recording', 'symbol_dictionary'),
    path: oneOf('analyze', 'memory', 'dictionary', 'skip'),
  },
  dream_capture_started: {
    input_mode: oneOf('voice', 'text'),
    capture_context: oneOf('fresh', 'remembered'),
  },
  recording_started: {
    input_mode: oneOf('voice', 'text'),
    language: supportedLanguage,
    speech_available: bool,
    offline_model_state: oneOf('ready', 'online_fallback', 'unavailable', 'unknown'),
  },
  recording_saved: {
    input_mode: oneOf('voice', 'text'),
    capture_context: oneOf('fresh', 'remembered'),
    duration_bucket: oneOf('0_15s', '16_60s', '61_180s', '181s_plus', 'unknown'),
    transcript_length_bucket: oneOf('0_100', '101_500', '501_1500', '1501_plus'),
  },
  recording_activation_insight_shown: {
    surface: oneOf('draft', 'first_dream_sheet', 'analyze_prompt_sheet'),
    capture_context: oneOf('fresh', 'remembered'),
    transcript_length_bucket: oneOf('0_100', '101_500', '501_1500', '1501_plus'),
    language: supportedLanguage,
  },
  analysis_started: {
    source: oneOf('recording_flow', 'journal_detail', 'retry', 'unknown'),
    tier,
    guest_status: oneOf('guest', 'signed_in'),
  },
  analysis_completed: {
    duration_ms_bucket: oneOf('0_5s', '5_15s', '15_45s', '45s_plus'),
    generated_image: bool,
    tier,
  },
  analysis_offer_viewed: { quota_state: oneOf('known', 'unlimited', 'exhausted', 'unknown') },
  first_dream_next_action_selected: {
    action: oneOf('launch_analysis', 'view_dream', 'later', 'analyze_memory'),
  },
  analysis_failed: {
    stage: oneOf('offer', 'request', 'result'),
    reason: oneOf('network', 'quota', 'auth', 'server', 'unknown'),
  },
  analysis_result_viewed: {
    source: oneOf('recording_flow', 'journal_detail', 'retry', 'unknown'),
  },
  symbol_detail_viewed: { source: oneOf('onboarding', 'dictionary', 'search', 'unknown') },
  first_value_viewed: {
    value: oneOf('analysis_result', 'recording_insight', 'symbol_detail'),
    onboarding_path: oneOf('analyze', 'memory', 'dictionary', 'skip', 'unknown'),
    hours_since_onboarding_bucket: oneOf('0_1h', '1_24h', '24h_plus', 'unknown'),
  },
  paywall_viewed: {
    trigger: oneOf(
      'analysis_limit',
      'analysis_cta',
      'exploration_limit',
      'image_generation',
      'settings',
      'settings_quota',
      'restore',
      'returning_device',
      'direct'
    ),
    tier,
    usage_count: nullableCount,
    offering_id: nullableShortString,
  },
  empty_journal_remembered_cta_clicked: { source: oneOf('journal_empty_state') },
  onboarding_choice_selected: {
    surface: oneOf('app_onboarding'),
    step: oneOf('intro', 'path'),
    choice: oneOf('continue', 'skip', 'analyze', 'memory', 'dictionary'),
  },
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validateProperties(eventName: AnalyticsEventName, value: unknown): value is Properties {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const properties = value as Record<string, unknown>;
  const schema = PROPERTY_SCHEMAS[eventName];
  if (!hasExactKeys(properties, Object.keys(schema))) return false;
  return Object.entries(schema).every(([key, validator]) => validator(properties[key]));
}

export function validateProductAnalyticsEvent(
  value: unknown,
  now = Date.now()
): value is ValidatedAnalyticsEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  if (!hasExactKeys(event, [
    'event_id',
    'event_name',
    'schema_version',
    'occurred_at',
    'journey_id',
    'platform',
    'app_version',
    'locale',
    'properties',
  ])) return false;

  if (typeof event.event_id !== 'string' || !UUID_PATTERN.test(event.event_id)) return false;
  if (typeof event.event_name !== 'string' || !EVENT_NAMES.includes(event.event_name as AnalyticsEventName)) return false;
  if (event.schema_version !== 1 || event.platform !== 'android') return false;
  if (event.journey_id !== null && (typeof event.journey_id !== 'string' || !UUID_PATTERN.test(event.journey_id))) return false;
  if (typeof event.app_version !== 'string' || !/^[0-9A-Za-z.+_-]{1,32}$/.test(event.app_version)) return false;
  if (typeof event.locale !== 'string' || !['fr', 'en', 'es', 'de', 'it'].includes(event.locale)) return false;
  if (typeof event.occurred_at !== 'string') return false;
  const occurredAt = Date.parse(event.occurred_at);
  if (!Number.isFinite(occurredAt) || occurredAt < now - MAX_EVENT_AGE_MS || occurredAt > now + MAX_FUTURE_SKEW_MS) return false;

  return validateProperties(event.event_name as AnalyticsEventName, event.properties);
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function readLimitedJson(req: Request): Promise<unknown | Response> {
  const contentLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: 'Payload too large' }, 413);
  }
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: 'Payload too large' }, 413);
  }
  try {
    return JSON.parse(text);
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
}

function getRejectedEventId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const eventId = (value as { event_id?: unknown }).event_id;
  return typeof eventId === 'string' && eventId.length <= 64 ? eventId : null;
}

export function partitionProductAnalyticsEvents(
  events: unknown[],
  now = Date.now()
): {
  accepted: ValidatedAnalyticsEvent[];
  rejectedEventIds: string[];
  rejectedCount: number;
} {
  const accepted: ValidatedAnalyticsEvent[] = [];
  const rejectedEventIds: string[] = [];
  for (const event of events) {
    if (validateProductAnalyticsEvent(event, now)) accepted.push(event);
    else {
      const eventId = getRejectedEventId(event);
      if (eventId) rejectedEventIds.push(eventId);
    }
  }
  return {
    accepted,
    rejectedEventIds,
    rejectedCount: events.length - accepted.length,
  };
}

export async function handleProductAnalytics(ctx: ApiContext): Promise<Response> {
  const { req, user, supabaseUrl, supabaseServiceRoleKey } = ctx;
  if (!user) {
    const guestToken = req.headers.get('x-analytics-guest-token')?.trim() ?? null;
    if (!(await verifyAnalyticsGuestToken(guestToken))) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
  }
  if (!supabaseServiceRoleKey) return jsonResponse({ error: 'Service unavailable' }, 503);

  const parsed = await readLimitedJson(req);
  if (parsed instanceof Response) return parsed;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return jsonResponse({ error: 'Invalid payload' }, 400);
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (req.method === 'DELETE') {
    const body = parsed as Record<string, unknown>;
    if (!hasExactKeys(body, ['journey_ids']) || !Array.isArray(body.journey_ids)) {
      return jsonResponse({ error: 'Invalid payload' }, 400);
    }
    const journeyIds = [...new Set(body.journey_ids)];
    if (
      journeyIds.length < 1 ||
      journeyIds.length > 20 ||
      journeyIds.some((id) => typeof id !== 'string' || !UUID_PATTERN.test(id))
    ) {
      return jsonResponse({ error: 'Invalid journey ids' }, 400);
    }

    const { error } = await adminClient
      .from('product_analytics_events')
      .delete()
      .in('journey_id', journeyIds as string[]);
    if (error) {
      console.warn('[api] analytics deletion failed', { code: error.code ?? 'unknown' });
      return jsonResponse({ error: 'Deletion failed' }, 500);
    }
    return jsonResponse({ deleted: true }, 200);
  }

  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  if ((Deno.env.get('PRODUCT_ANALYTICS_INGEST_ENABLED') ?? '').toLowerCase() !== 'true') {
    return jsonResponse({
      error: {
        code: 'ANALYTICS_INGEST_DISABLED',
        message: 'Analytics ingestion disabled',
      },
    }, 503);
  }

  const body = parsed as Record<string, unknown>;
  if (!hasExactKeys(body, ['events']) || !Array.isArray(body.events) || body.events.length < 1 || body.events.length > MAX_BATCH_SIZE) {
    return jsonResponse({ error: 'Invalid batch' }, 400);
  }

  const { accepted, rejectedEventIds, rejectedCount } = partitionProductAnalyticsEvents(body.events);

  if (accepted.length > 0) {
    const rows = accepted.map((event) => ({
      event_id: event.event_id,
      event_name: event.event_name,
      schema_version: event.schema_version,
      occurred_at: event.occurred_at,
      journey_id: event.journey_id,
      platform: event.platform,
      app_version: event.app_version,
      locale: event.locale,
      properties: event.properties,
    }));
    const { error } = await adminClient
      .from('product_analytics_events')
      .upsert(rows, { onConflict: 'event_id', ignoreDuplicates: true });
    if (error) {
      console.warn('[api] analytics ingestion failed', { code: error.code ?? 'unknown' });
      return jsonResponse({ error: 'Ingestion failed' }, 500);
    }
  }

  return jsonResponse({
    accepted_event_ids: accepted.map((event) => event.event_id),
    rejected_event_ids: rejectedEventIds,
    rejected_count: rejectedCount,
  }, 202);
}
