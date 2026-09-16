import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { reserveHdImageCredit, finishHdImageCredit } from './hdImageQuota.ts';
import { serializeImageJobError } from './imageJobs.ts';

Deno.test('HD quota refuses anonymous, exhausted and unavailable reservations before generation', async () => {
  let calls = 0;
  const client = { rpc: async () => { calls++; return { data: { allowed: false, code: 'HD_IMAGE_QUOTA_EXCEEDED' }, error: null }; } };
  await assertRejects(() => reserveHdImageCredit(client, null, 'job'));
  assertEquals(calls, 0);
  try { await reserveHdImageCredit(client, 'owner', 'job'); } catch (error) {
    assertEquals(serializeImageJobError(error).errorCode, 'HD_IMAGE_QUOTA_EXCEEDED');
    assertEquals(serializeImageJobError(error).retryable, false);
  }
  try { await reserveHdImageCredit({ rpc: async () => ({ data: null, error: {} }) }, 'owner', 'job'); } catch (error) {
    assertEquals(serializeImageJobError(error).errorCode, 'HD_IMAGE_QUOTA_UNAVAILABLE');
    assertEquals(serializeImageJobError(error).retryable, true);
  }
});

Deno.test('HD reservation reuses the durable job identity on retry', async () => {
  const calls: unknown[] = [];
  const client = { rpc: async (name: string, args: Record<string, unknown>) => { calls.push([name, args]); return { data: { allowed: true, duplicate: true }, error: null }; } };
  await reserveHdImageCredit(client, 'owner', 'job');
  await finishHdImageCredit(client, 'job', false);
  assertEquals(calls, [
    ['reserve_hd_image_credit', { p_user_id: 'owner', p_job_id: 'job' }],
    ['finish_hd_image_credit', { p_job_id: 'job', p_success: false }],
  ]);
});
