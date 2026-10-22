import { createHash, randomUUID } from 'node:crypto';
import { test, expect, login, journal, client, admin } from '../backend-fixtures';

// Apps installed before the luminous and nostalgic themes know only four themes and do not
// send precise_theme. These are the request shapes such an app makes (services as shipped
// before migration 20261015120000), next to the current app's.
const OLD_APP_LIST_COLUMNS = 'id,created_at,client_request_id,revision_id,updated_at,transcript,title,shareable_quote,exploration_started_at,image_url,dream_type,theme,is_favorite,memory,is_analyzed,analyzed_at,analysis_status,analysis_request_id,image_generation_failed';
const LEGACY_THEMES = ['surreal', 'mystical', 'calm', 'noir'];

const syncUpdate = (remoteId: number, payload: Record<string, unknown>) => [{
  mutation_id: randomUUID(), client_request_id: randomUUID(), operation: 'update',
  entity_key: `dream:${remoteId}`, payload: { remote_id: remoteId, ...payload },
}];

test('an older app reads four themes and its theme edit replaces the precise one', async ({ page, accounts }) => {
  const owner = client();
  expect((await owner.auth.signInWithPassword(accounts.free)).error).toBeNull();
  try {
    const story = `E2E luminous dream ${randomUUID()}: a field of lanterns at dawn.`;
    // The current app writes the full theme and its projection (services/journalDreamMapper.ts).
    const created = await owner.from('dreams').insert({
      user_id: accounts.free.id, transcript: story, title: 'Lanterns', interpretation: '', shareable_quote: '',
      dream_type: 'Symbolic Dream', client_request_id: randomUUID(), theme: 'mystical', precise_theme: 'luminous',
    }).select('id,theme,precise_theme').single();
    expect(created.error).toBeNull();
    expect(created.data).toMatchObject({ theme: 'mystical', precise_theme: 'luminous' });
    const id = created.data!.id as number;

    await login(page, accounts.free);
    await journal(page);
    await expect(page.getByTestId(/^dream\.item\./).filter({ hasText: story })).toContainText('Luminous');

    // An older app's list read and sync response carry only a theme it can show.
    const list = await owner.from('dreams').select(OLD_APP_LIST_COLUMNS).eq('id', id).single();
    expect(list.error).toBeNull();
    expect((list.data as any).theme).toBe('mystical');
    const keep = await owner.rpc('sync_dream_mutations', { mutations: syncUpdate(id, { title: 'Lanterns at dawn', theme: 'mystical' }) });
    expect(keep.error).toBeNull();
    expect(keep.data[0]).toMatchObject({ status: 'ack', dream: { theme: 'mystical', precise_theme: 'luminous', title: 'Lanterns at dawn' } });

    // Choosing another theme in an older app replaces the precise theme it cannot see.
    const edit = await owner.rpc('sync_dream_mutations', { mutations: syncUpdate(id, { theme: 'noir' }) });
    expect(edit.error).toBeNull();
    expect(edit.data[0]).toMatchObject({ status: 'ack', dream: { theme: 'noir', precise_theme: null } });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('screen.recording')).toBeVisible();
    await journal(page);
    await expect(page.getByTestId(/^dream\.item\./).filter({ hasText: story })).toContainText('Noir');

    // The same through an older app's direct PostgREST write, and the sync create path.
    const nostalgic = await owner.rpc('sync_dream_mutations', { mutations: [{
      mutation_id: randomUUID(), client_request_id: randomUUID(), operation: 'create', entity_key: 'dream:new',
      payload: { transcript: `${story} Again.`, title: 'Letters', theme: 'calm', precise_theme: 'nostalgic' },
    }] });
    expect(nostalgic.error).toBeNull();
    expect(nostalgic.data[0]).toMatchObject({ status: 'ack', dream: { theme: 'calm', precise_theme: 'nostalgic' } });
    const nostalgicId = nostalgic.data[0].remote_id as number;
    const direct = await owner.from('dreams').update({ theme: 'surreal', title: 'Letters' }).eq('id', nostalgicId).select('theme,precise_theme').single();
    expect(direct.error).toBeNull();
    expect(direct.data).toEqual({ theme: 'surreal', precise_theme: null });

    // An app released with the six themes but before precise_theme writes the raw value.
    const raw = await owner.from('dreams').update({ theme: 'nostalgic' }).eq('id', nostalgicId).select('theme,precise_theme').single();
    expect(raw.error).toBeNull();
    expect(raw.data).toEqual({ theme: 'calm', precise_theme: 'nostalgic' });

    const all = await owner.from('dreams').select('theme').eq('user_id', accounts.free.id);
    expect(all.error).toBeNull();
    for (const row of all.data!) expect(LEGACY_THEMES).toContain(row.theme);
  } finally {
    await owner.auth.signOut();
  }
});

test('a completed reading keeps a newer theme for current apps and a legacy one for older apps', async ({ accounts }) => {
  const requestId = randomUUID();
  const transcript = `E2E reading ${randomUUID()}: an old house by the sea.`;
  const dream = await admin.from('dreams').insert({
    user_id: accounts.free.id, transcript, title: 'House',
    interpretation: '', shareable_quote: '', dream_type: 'Symbolic Dream', client_request_id: randomUUID(),
    analysis_status: 'pending', analysis_request_id: requestId,
  }).select('id').single();
  expect(dream.error).toBeNull();
  const job = await admin.from('ai_jobs').insert({
    user_id: accounts.free.id, dream_id: dream.data!.id, job_type: 'analyze_dream', status: 'running',
    request_payload: { transcript_sha256: createHash('sha256').update(transcript).digest('hex') },
    client_request_id: requestId,
  }).select('id').single();
  expect(job.error).toBeNull();
  const completion = await admin.rpc('complete_authenticated_analysis_job', {
    p_job_id: job.data!.id,
    p_analysis_result: { title: 'House', interpretation: 'A return.', shareableQuote: '', theme: 'nostalgic', dreamType: 'Symbolic Dream', imagePrompt: 'An old house by the sea' },
    p_image_job_id: randomUUID(), p_image_max_attempts: 3, p_image_max_active_per_actor: 1,
    p_image_window_seconds: 600, p_image_max_created_in_window: 4, p_max_global_active: 200,
  });
  expect(completion.error).toBeNull();
  expect(completion.data.completed).toBe(true);
  const stored = await admin.from('dreams').select('theme,precise_theme,analysis_status').eq('id', dream.data!.id).single();
  expect(stored.error).toBeNull();
  expect(stored.data).toEqual({ theme: 'calm', precise_theme: 'nostalgic', analysis_status: 'done' });
});

test('an edit during model analysis cannot commit a result for the old transcript', async ({ accounts }) => {
  const owner = client();
  expect((await owner.auth.signInWithPassword(accounts.free)).error).toBeNull();
  try {
    const requestId = randomUUID();
    const original = `E2E stale reading ${randomUUID()}: a red door.`;
    const edited = `${original} A blue door replaces it.`;
    const dream = await admin.from('dreams').insert({
      user_id: accounts.free.id, transcript: original, title: 'Door',
      interpretation: '', shareable_quote: '', dream_type: 'Symbolic Dream',
      client_request_id: randomUUID(), analysis_status: 'pending', analysis_request_id: requestId,
    }).select('id').single();
    expect(dream.error).toBeNull();
    const dreamId = dream.data!.id as number;
    const job = await admin.from('ai_jobs').insert({
      user_id: accounts.free.id, dream_id: dreamId, job_type: 'analyze_dream', status: 'running',
      request_payload: { transcript_sha256: createHash('sha256').update(original).digest('hex') },
      client_request_id: requestId,
    }).select('id').single();
    expect(job.error).toBeNull();

    const edit = await owner.rpc('sync_dream_mutations', {
      mutations: syncUpdate(dreamId, { transcript: edited }),
    });
    expect(edit.error).toBeNull();
    expect(edit.data[0]).toMatchObject({ status: 'ack', dream: {
      transcript: edited, analysis_request_id: requestId,
    } });

    const completion = await admin.rpc('complete_authenticated_analysis_job', {
      p_job_id: job.data!.id,
      p_analysis_result: {
        title: 'Red door', interpretation: 'The door is red.', shareableQuote: '',
        theme: 'noir', dreamType: 'Symbolic Dream', imagePrompt: 'A red door',
      },
      p_image_job_id: randomUUID(), p_image_max_attempts: 3, p_image_max_active_per_actor: 1,
      p_image_window_seconds: 600, p_image_max_created_in_window: 4, p_max_global_active: 200,
    });
    expect(completion.error).toBeNull();
    expect(completion.data).toMatchObject({ completed: false, code: 'ANALYSIS_TRANSCRIPT_CHANGED' });
    const stored = await admin.from('dreams').select('transcript,interpretation,is_analyzed,analysis_status').eq('id', dreamId).single();
    expect(stored.error).toBeNull();
    expect(stored.data).toMatchObject({ transcript: edited, interpretation: '', is_analyzed: false, analysis_status: 'pending' });
    const unchangedJob = await admin.from('ai_jobs').select('status').eq('id', job.data!.id).single();
    expect(unchangedJob.error).toBeNull();
    expect(unchangedJob.data).toEqual({ status: 'running' });
  } finally {
    await owner.auth.signOut();
  }
});
