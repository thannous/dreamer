import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import type { ImageJobRow } from '../api/services/imageJobs.ts';
import {
  IMAGE_RETRY_PAYLOAD_HASH_KEY,
  markTerminalFailure,
  persistDreamImageFailure,
  persistDreamImageResult,
  redactedRequestPayload,
} from './index.ts';

type DreamUpdate = {
  table: string;
  values: Record<string, unknown>;
  filters: Record<string, unknown>;
};

const createUpdateTracker = () => {
  const updates: DreamUpdate[] = [];
  const client = {
    from(table: string) {
      let values: Record<string, unknown> = {};
      const filters: Record<string, unknown> = {};
      let recorded = false;
      const query = {
        update(next: Record<string, unknown>) {
          values = next;
          return query;
        },
        eq(column: string, value: unknown) {
          filters[column] = value;
          if (!recorded) {
            updates.push({ table, values, filters });
            recorded = true;
          }
          return query;
        },
        then(resolve: (value: { error: null }) => void) {
          resolve({ error: null });
        },
      };
      return query;
    },
  };
  return { client, updates };
};

const imageJob: ImageJobRow = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: 'user-1',
  guest_fingerprint: null,
  dream_id: 42,
  job_type: 'generate_image',
  status: 'running',
  request_payload: { prompt: 'moonlit forest' },
  result_payload: null,
  error_code: null,
  error_message: null,
  attempt_count: 3,
  max_attempts: 3,
  client_request_id: '3f73ab45-9a14-4db9-94a3-d24724457d9e',
  quota_claimed: false,
  quota_claimed_at: null,
  created_at: '2026-08-29T00:00:00.000Z',
  started_at: '2026-08-29T00:00:01.000Z',
  finished_at: null,
};

Deno.test('terminal image failure flags only image_generation_failed on the dream', async () => {
  const { client, updates } = createUpdateTracker();

  await markTerminalFailure(
    client as any,
    imageJob,
    'IMAGE_JOB_FAILED',
    'Image generation failed'
  );

  const jobUpdate = updates.find((update) => update.table === 'ai_jobs');
  const dreamUpdate = updates.find((update) => update.table === 'dreams');

  assertEquals(jobUpdate?.filters.id, imageJob.id);
  assertEquals(jobUpdate?.values.status, 'failed');
  assertEquals(dreamUpdate, {
    table: 'dreams',
    values: { image_generation_failed: true },
    filters: { id: 42, user_id: 'user-1' },
  });
  assertEquals('interpretation' in (dreamUpdate?.values ?? {}), false);
  assertEquals('is_analyzed' in (dreamUpdate?.values ?? {}), false);
  assertEquals('analysis_status' in (dreamUpdate?.values ?? {}), false);
  assertEquals('title' in (dreamUpdate?.values ?? {}), false);
  assertEquals('image_url' in (dreamUpdate?.values ?? {}), false);
});

Deno.test('image success clears image_generation_failed without touching text analysis', async () => {
  const { client, updates } = createUpdateTracker();

  await persistDreamImageResult(
    client as any,
    imageJob,
    'https://example.test/dream.webp'
  );

  assertEquals(updates, [
    {
      table: 'dreams',
      values: {
        image_url: 'https://example.test/dream.webp',
        image_generation_failed: false,
      },
      filters: { id: 42, user_id: 'user-1' },
    },
  ]);
  assertEquals('interpretation' in updates[0].values, false);
  assertEquals('is_analyzed' in updates[0].values, false);
  assertEquals('analysis_status' in updates[0].values, false);
});

Deno.test('image failure persistence does not write analysis columns', async () => {
  const { client, updates } = createUpdateTracker();

  await persistDreamImageFailure(client as any, imageJob);

  assertEquals(Object.keys(updates[0].values), ['image_generation_failed']);
  assertEquals(updates[0].values.image_generation_failed, true);
});

Deno.test('redacted image payload preserves the retry fingerprint and drops user text', () => {
  const hashedJob: ImageJobRow = {
    ...imageJob,
    request_payload: {
      prompt: 'moonlit forest',
      transcript: 'I walked through a moonlit forest',
      previousImageUrl: 'https://example.test/previous.webp',
      _retryPayloadHash: 'd41d8cd98f00b204e9800998ecf8427e',
    } as ImageJobRow['request_payload'],
  };

  const redacted = redactedRequestPayload(hashedJob);

  assertEquals(redacted, {
    redacted: true,
    hadPrompt: true,
    hadTranscript: true,
    hadPreviousImage: true,
    [IMAGE_RETRY_PAYLOAD_HASH_KEY]: 'd41d8cd98f00b204e9800998ecf8427e',
  });
  assertEquals('prompt' in redacted, false);
  assertEquals('transcript' in redacted, false);
  assertEquals('previousImageUrl' in redacted, false);
  assertEquals(JSON.stringify(redacted).includes('moonlit forest'), false);
  assertEquals(JSON.stringify(redacted).includes('I walked through'), false);
});

Deno.test('legacy redacted image payload keeps presence flags without inventing a fingerprint', () => {
  const redacted = redactedRequestPayload(imageJob);

  assertEquals(redacted, {
    redacted: true,
    hadPrompt: true,
    hadTranscript: false,
    hadPreviousImage: false,
  });
  assertEquals(IMAGE_RETRY_PAYLOAD_HASH_KEY in redacted, false);
});

Deno.test('terminal image failure persists the redacted fingerprint without user text', async () => {
  const { client, updates } = createUpdateTracker();
  const hashedJob: ImageJobRow = {
    ...imageJob,
    request_payload: {
      prompt: 'secret prompt text',
      _retryPayloadHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    } as ImageJobRow['request_payload'],
  };

  await markTerminalFailure(client as any, hashedJob, 'IMAGE_JOB_FAILED', 'Image generation failed');

  const jobUpdate = updates.find((update) => update.table === 'ai_jobs');
  const storedPayload = jobUpdate?.values.request_payload as Record<string, unknown>;
  assertEquals(storedPayload, {
    redacted: true,
    hadPrompt: true,
    hadTranscript: false,
    hadPreviousImage: false,
    [IMAGE_RETRY_PAYLOAD_HASH_KEY]: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  });
  assertEquals(JSON.stringify(storedPayload).includes('secret prompt text'), false);
});

Deno.test('authenticated image persistence filters dreams by owner', async () => {
  const { client, updates } = createUpdateTracker();

  await persistDreamImageResult(
    client as any,
    imageJob,
    'https://example.test/owned.webp'
  );
  await persistDreamImageFailure(client as any, {
    ...imageJob,
    id: '22222222-2222-4222-8222-222222222222',
  });

  assertEquals(updates.map((update) => update.filters), [
    { id: 42, user_id: 'user-1' },
    { id: 42, user_id: 'user-1' },
  ]);
  assertEquals(updates[0].table, 'dreams');
  assertEquals(updates[1].table, 'dreams');
});

Deno.test('guest image persistence keeps dream_id without inventing a user_id filter', async () => {
  const { client, updates } = createUpdateTracker();
  const guestJob: ImageJobRow = {
    ...imageJob,
    user_id: null,
    guest_fingerprint: 'guest-fingerprint',
  };

  await persistDreamImageResult(
    client as any,
    guestJob,
    'https://example.test/guest.webp'
  );
  await persistDreamImageFailure(client as any, guestJob);

  assertEquals(updates.map((update) => update.filters), [
    { id: 42 },
    { id: 42 },
  ]);
  assertEquals('user_id' in updates[0].filters, false);
  assertEquals('user_id' in updates[1].filters, false);
});

Deno.test('guest image persistence without dream_id does not write dreams', async () => {
  const { client, updates } = createUpdateTracker();
  const guestJob: ImageJobRow = {
    ...imageJob,
    user_id: null,
    guest_fingerprint: 'guest-fingerprint',
    dream_id: null,
  };

  await persistDreamImageResult(
    client as any,
    guestJob,
    'https://example.test/guest.webp'
  );
  await persistDreamImageFailure(client as any, guestJob);

  assertEquals(updates, []);
});
