import { randomUUID } from 'node:crypto';
import { test, expect, login, journal, client, admin, restrictNetwork } from '../backend-fixtures';

type WireMutation = { mutation_id: string; client_request_id: string; operation: string; payload: Record<string, unknown> };

test('a durable pre-notes receipt recovers after reload without duplicating the dream', async ({ page, browserSurface, accounts }) => {
  const owner = client();
  expect((await owner.auth.signInWithPassword(accounts.free)).error).toBeNull();
  const dreamKey = randomUUID();
  const story = `E2E old receipt ${randomUUID()}: a lighthouse above the ocean.`;
  const noteText = 'The old server must not lose this private thought.';
  const created = await owner.from('dreams').insert({
    user_id: accounts.free.id, client_request_id: dreamKey, transcript: story, title: 'Lighthouse',
    interpretation: '', shareable_quote: '', dream_type: 'Symbolic Dream',
  }).select('id').single();
  expect(created.error).toBeNull();
  const id = created.data!.id as number;
  const read = async () => {
    const result = await owner.from('dreams').select('id,transcript,personal_notes').eq('id', id).single();
    expect(result.error).toBeNull();
    return result.data!;
  };
  const state: { legacyRequest?: WireMutation; recoveryAllowed: boolean; seeded: boolean } = {
    recoveryAllowed: false, seeded: false,
  };
  const syncRoute = '**/rest/v1/rpc/sync_dream_mutations';
  await page.route(syncRoute, async route => {
    const request = route.request().postDataJSON() as { mutations: WireMutation[] };
    const noteMutation = request.mutations.find(mutation => mutation.payload.remote_id === id &&
      Array.isArray(mutation.payload.personal_notes) && mutation.payload.personal_notes.length > 0);
    if (!noteMutation || state.recoveryAllowed) return route.continue();
    if (state.seeded) return route.abort();
    state.seeded = true;
    // On the owned local fixture, reproduce the old RPC's actual write: omit
    // notes from its input, then persist its old-format receipt. Merely hiding
    // the response field after saving notes would not reproduce the defect.
    const legacyMutations = request.mutations.map(mutation => {
      const payload = { ...mutation.payload };
      delete payload.personal_notes;
      return { ...mutation, payload };
    });
    const legacy = await owner.rpc('sync_dream_mutations', { mutations: legacyMutations });
    expect(legacy.error).toBeNull();
    const responses = legacy.data.map((result: { dream?: Record<string, unknown> }) => {
      const dream = { ...result.dream };
      delete dream.personal_notes;
      return { ...result, dream };
    });
    for (const response of responses) {
      const saved = await admin.from('dream_sync_receipts').update({ response })
        .eq('user_id', accounts.free.id).eq('client_request_id', response.client_request_id).select('id').single();
      expect(saved.error).toBeNull();
    }
    state.legacyRequest = noteMutation;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(responses) });
  });
  try {
    await login(page, accounts.free);
    await journal(page);
    await page.getByTestId(/^dream\.item\./).filter({ hasText: story }).click();
    await page.getByTestId('dream.note.add').click();
    await page.getByTestId('dream.note.input').fill(noteText);
    await page.getByTestId('dream.note.save').click();
    await expect(page.getByText('Retry sync', { exact: true })).toBeVisible();
    await expect(page.getByTestId('dream.personal-notes')).toContainText(noteText);
    await expect.poll(() => Boolean(state.legacyRequest)).toBe(true);
    expect((await read()).personal_notes).toEqual([]);
    // The old receipt is really durable and still ignores a direct retry even
    // with today's migrated RPC; only the corrected client's new key can escape it.
    const replay = await owner.rpc('sync_dream_mutations', { mutations: [state.legacyRequest!] });
    expect(replay.error).toBeNull();
    expect(replay.data[0].status).toBe('ack');
    expect(replay.data[0].dream).not.toHaveProperty('personal_notes');
    expect((await read()).personal_notes).toEqual([]);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('screen.recording')).toBeVisible();
    await journal(page);
    await page.getByTestId(/^dream\.item\./).filter({ hasText: story }).click();
    await expect(page.getByTestId('dream.personal-notes')).toContainText(noteText);
    const retry = page.getByText('Retry sync', { exact: true });
    await expect(retry).toBeVisible();
    // After a reload the app also retries on its own. Keep those attempts
    // blocked until the action is clickable, so recovery comes from this retry.
    await retry.click({ trial: true });
    state.recoveryAllowed = true;
    await retry.click();
    await expect.poll(async () => (await read()).personal_notes.map((note: { text: string }) => note.text)).toEqual([noteText]);
    await expect(retry).toHaveCount(0);
    await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
    const rows = await owner.from('dreams').select('id').eq('client_request_id', dreamKey);
    expect(rows.error).toBeNull();
    expect(rows.data).toEqual([{ id }]);
    const receipts = await admin.from('dream_sync_receipts').select('client_request_id,operation,mutation_status')
      .eq('user_id', accounts.free.id).eq('dream_id', id);
    expect(receipts.error).toBeNull();
    expect(receipts.data).toHaveLength(2);
    expect(receipts.data!.filter(receipt => receipt.client_request_id !== state.legacyRequest!.client_request_id))
      .toEqual([expect.objectContaining({ operation: 'update', mutation_status: 'ack' })]);

    const fresh = await browserSurface.newContext({ locale: 'en-US', serviceWorkers: 'block' });
    await restrictNetwork(fresh);
    try {
      const second = await fresh.newPage();
      await login(second, accounts.free);
      await journal(second);
      await second.getByTestId(/^dream\.item\./).filter({ hasText: story }).click();
      await expect(second.getByTestId('dream.personal-notes')).toContainText(noteText);
      await expect(second.getByTestId('component.transcriptCard')).toContainText(story);
    } finally {
      await fresh.close();
    }
  } finally {
    await page.unroute(syncRoute);
    await owner.auth.signOut();
  }
});
