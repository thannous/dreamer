import { randomUUID } from 'node:crypto';
import { hashDreamTranscript } from '../../../lib/dreamAnalysisFreshness';
import { test, expect, login, journal, client, admin } from '../backend-recovery-fixtures';

const analysisText = 'A lighthouse can be a point of orientation. What does this particular lighthouse bring to mind for you?';

// Auth, Postgres, API admission and the analysis worker are real. Paid analysis
// transport is deterministic; the real worker is held after durable admission.
test('Plus reanalysis survives reload and completes once while preserving its image', {
  tags: ['analysis-recovery'], timeout: 180_000,
}, async ({ page, browser, accounts, recovery }) => {
  const owner = client();
  expect((await owner.auth.signInWithPassword(accounts.plus)).error).toBeNull();
  await recovery.control({ reset: true, analysisHold: true });
  const title = `Analysis recovery ${randomUUID().slice(0, 8)}`;
  const transcript = 'I walked to a lighthouse beside the sea.';
  const revised = `${transcript} Its door was blue and I could hear the waves.`;
  // A loopback URL suffices: this journey preserves the old reference and never
  // asks an external image provider or host to render/download an illustration.
  const previousImageUrl = 'http://127.0.0.1:8085/qa-existing-illustration.png';
  const inserted = await owner.from('dreams').insert({
    user_id: accounts.plus.id, title, transcript, interpretation: 'The earlier reading.',
    shareable_quote: '', dream_type: 'Everyday Dream', theme: 'calm',
    client_request_id: randomUUID(), analysis_request_id: randomUUID(),
    analysis_status: 'done', is_analyzed: true, analyzed_at: new Date().toISOString(),
    analysis_details: { analysisTranscriptHash: hashDreamTranscript(transcript) },
    image_url: previousImageUrl,
  }).select('id').single();
  expect(inserted.error).toBeNull();
  const dreamId = inserted.data!.id as number;
  const jobs = async () => {
    const result = await admin.from('ai_jobs')
      .select('id,job_type,status,client_request_id,request_payload,attempt_count')
      .eq('dream_id', dreamId).order('job_type');
    expect(result.error).toBeNull();
    return result.data!;
  };
  const openDream = async () => {
    await journal(page);
    await page.getByTestId(/^dream\.item\./).filter({ hasText: revised }).click();
    await expect(page.getByTestId('screen.dreamDetail')).toBeVisible();
  };
  try {
    await login(page, accounts.plus);
    await journal(page);
    await page.getByTestId(/^dream\.item\./).filter({ hasText: transcript }).click();
    await page.getByTestId('btn.editDream').click();
    await page.getByTestId('input.dreamTranscript').fill(revised);
    await page.getByTestId('btn.saveDreamEdit').click();
    await page.getByTestId('btn.dream.staleCta').click();
    const replaceImage = page.getByRole('checkbox', { name: 'Also regenerate the dream image', exact: true });
    await expect(replaceImage).toBeVisible();
    await expect(replaceImage).not.toBeChecked();
    const consentPrompts: string[] = [];
    const offConsent = await browser.onDialog(async dialog => {
      consentPrompts.push(dialog.message);
      await dialog.accept();
    });
    try {
      await page.getByRole('button', { name: 'Update', exact: true }).click();
      await expect.poll(() => consentPrompts.length).toBe(1);
      expect(consentPrompts[0]).toContain('To explore and illustrate your dream, Noctalia relies on artificial intelligence.');
    } finally {
      offConsent();
    }
    await expect.poll(async () => (await recovery.state()).analysisDispatches).toBeGreaterThan(0);
    const pending = await jobs();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ job_type: 'analyze_dream', status: 'queued' });
    expect(pending[0].request_payload.replaceExistingImage).toBe(false);
    expect((await recovery.state()).analysisProviderCalls).toBe(0);

    // Destroy the live caller before the worker can complete. Only the normal
    // persisted journal state can restore the pending analysis request.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('screen.recording')).toBeVisible();
    await recovery.control({ analysisHold: false });
    await expect.poll(async () => (await jobs())[0]?.status,
      { timeout: 45_000 }).toBe('succeeded');
    const recovered = await jobs();
    expect(recovered).toHaveLength(1);
    expect(recovered[0]).toMatchObject({ id: pending[0].id, status: 'succeeded', attempt_count: 1 });
    const completedDream = await owner.from('dreams').select('transcript,image_url,is_analyzed,analysis_status')
      .eq('id', dreamId).single();
    expect(completedDream.error).toBeNull();
    expect(completedDream.data).toMatchObject({
      transcript: revised, image_url: previousImageUrl, is_analyzed: true, analysis_status: 'done',
    });
    await openDream();
    await expect(page.getByText(analysisText, { exact: true })).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('screen.recording')).toBeVisible();
    await openDream();
    await expect(page.getByText(analysisText, { exact: true })).toBeVisible();
    expect(await jobs()).toEqual(recovered);
    const receipts = await admin.from('quota_usage').select('id')
      .eq('user_id', accounts.plus.id).eq('quota_type', 'analysis')
      .eq('metadata->>analysis_request_id', pending[0].client_request_id);
    expect(receipts.error).toBeNull();
    expect(receipts.data).toHaveLength(1);
    const state = await recovery.state();
    expect(state.analysisProviderCalls).toBe(1);
    expect(new Set(state.analysisRequests).size).toBe(1);
    expect(state.blockedExternalRequests).toBe(0);
    expect(state.workerFailures).toBe(0);
  } finally {
    await recovery.control({ analysisHold: false });
    await expect.poll(async () => (await recovery.state()).pendingWorkers).toBe(0);
    await owner.auth.signOut();
  }
});
