import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  handleProductAnalytics,
  partitionProductAnalyticsEvents,
  validateProductAnalyticsEvent,
} from './analytics.ts';
import { createAnalyticsGuestToken } from '../lib/analyticsGuestToken.ts';

const now = Date.parse('2026-07-12T12:00:00.000Z');

function validEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_id: '00000000-0000-4000-8000-000000000001',
    event_name: 'onboarding_step_viewed',
    schema_version: 1,
    occurred_at: '2026-07-12T12:00:00.000Z',
    journey_id: '00000000-0000-4000-8000-000000000002',
    platform: 'android',
    app_version: '2.0.2',
    locale: 'fr',
    properties: { step: 'intro' },
    ...overrides,
  };
}

function context(req: Request, user: unknown | null = { id: 'authenticated-user' }) {
  return {
    req,
    user,
    supabase: {},
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceRoleKey: 'service-role-test-key',
    storageBucket: 'dream-images',
  };
}

Deno.test('analytics validator accepts an allowlisted Android envelope', () => {
  assertEquals(validateProductAnalyticsEvent(validEvent(), now), true);
});

Deno.test('activation insight allowlist excludes dream-derived semantic properties', () => {
  const safeProperties = {
    surface: 'draft',
    capture_context: 'fresh',
    transcript_length_bucket: '0_100',
    language: 'fr',
  };
  assertEquals(validateProductAnalyticsEvent(validEvent({
    event_name: 'recording_activation_insight_shown',
    properties: safeProperties,
  }), now), true);
  assertEquals(validateProductAnalyticsEvent(validEvent({
    event_name: 'recording_activation_insight_shown',
    properties: {
      ...safeProperties,
      tone: 'signals',
      primary_signal_id: 'emotion',
      signal_ids: 'emotion,place',
      signal_count: 2,
    },
  }), now), false);
});

Deno.test('analytics validator rejects content, unknown fields, stale events, and non-Android envelopes', () => {
  assertEquals(validateProductAnalyticsEvent(validEvent({
    properties: { step: 'intro', transcript: 'private dream' },
  }), now), false);
  assertEquals(validateProductAnalyticsEvent(validEvent({
    properties: { step: 'intro', message: 'private dream' },
  }), now), false);
  assertEquals(validateProductAnalyticsEvent(validEvent({
    properties: { step: 'private dream' },
  }), now), false);
  assertEquals(validateProductAnalyticsEvent({ ...validEvent(), user_id: 'forbidden' }, now), false);
  assertEquals(validateProductAnalyticsEvent(validEvent({
    occurred_at: '2026-07-01T12:00:00.000Z',
  }), now), false);
  assertEquals(validateProductAnalyticsEvent(validEvent({ platform: 'ios' }), now), false);
  assertEquals(validateProductAnalyticsEvent(validEvent({
    event_name: 'onboarding_choice_selected',
    properties: {
      surface: 'recording_onboarding',
      step: 'capture_mode',
      choice: 'library',
    },
  }), now), false);
});

Deno.test('analytics batch partition supports valid and rejected events without rejecting the whole batch', () => {
  const invalid = validEvent({
    event_id: '00000000-0000-4000-8000-000000000003',
    properties: { step: 'intro', title: 'private' },
  });
  const result = partitionProductAnalyticsEvents([validEvent(), invalid], now);

  assertEquals(result.accepted.length, 1);
  assertEquals(result.rejectedEventIds, ['00000000-0000-4000-8000-000000000003']);
  assertEquals(result.rejectedCount, 1);
});

Deno.test('analytics ingest kill switch fails closed while deletion remains a separate route', async () => {
  const previous = Deno.env.get('PRODUCT_ANALYTICS_INGEST_ENABLED');
  Deno.env.set('PRODUCT_ANALYTICS_INGEST_ENABLED', 'false');
  try {
    const req = new Request('https://example.supabase.co/functions/v1/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [validEvent()] }),
    });
    const response = await handleProductAnalytics(context(req));
    assertEquals(response.status, 503);
    assertEquals((await response.json()).error.code, 'ANALYTICS_INGEST_DISABLED');
  } finally {
    if (previous == null) Deno.env.delete('PRODUCT_ANALYTICS_INGEST_ENABLED');
    else Deno.env.set('PRODUCT_ANALYTICS_INGEST_ENABLED', previous);
  }
});

Deno.test('analytics ingest accepts the dedicated guest session without consulting quota fingerprint headers', async () => {
  const previous = Deno.env.get('GUEST_SESSION_SECRET');
  const previousIngest = Deno.env.get('PRODUCT_ANALYTICS_INGEST_ENABLED');
  Deno.env.set('GUEST_SESSION_SECRET', 'analytics-test-secret-with-sufficient-entropy');
  Deno.env.set('PRODUCT_ANALYTICS_INGEST_ENABLED', 'true');
  try {
    const session = await createAnalyticsGuestToken();
    const req = new Request('https://example.supabase.co/functions/v1/api/analytics/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-analytics-guest-token': session.token,
        'x-guest-fingerprint': 'must-be-ignored',
      },
      body: JSON.stringify({ invalid: true }),
    });

    const response = await handleProductAnalytics(context(req, null));
    assertEquals(response.status, 400);
  } finally {
    if (previous == null) Deno.env.delete('GUEST_SESSION_SECRET');
    else Deno.env.set('GUEST_SESSION_SECRET', previous);
    if (previousIngest == null) Deno.env.delete('PRODUCT_ANALYTICS_INGEST_ENABLED');
    else Deno.env.set('PRODUCT_ANALYTICS_INGEST_ENABLED', previousIngest);
  }
});

Deno.test('analytics route rejects payloads over 32 KiB before ingestion', async () => {
  const req = new Request('https://example.supabase.co/functions/v1/api/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: [], padding: 'x'.repeat(33 * 1024) }),
  });

  const response = await handleProductAnalytics(context(req));
  assertEquals(response.status, 413);
});

Deno.test('analytics deletion accepts only UUID journey identifiers', async () => {
  const req = new Request('https://example.supabase.co/functions/v1/api/analytics/events', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ journey_ids: ['not-a-uuid'] }),
  });

  const response = await handleProductAnalytics(context(req));
  assertEquals(response.status, 400);
});
