import { randomUUID } from 'node:crypto';
import { test, expect, login, journal, client, restrictNetwork } from '../backend-fixtures';

const reflection = (text: string) => {
  const now = Date.now();
  return { id: randomUUID(), text, createdAt: now, updatedAt: now };
};
const mutation = (operation: 'create' | 'update', payload: Record<string, unknown>, revision?: string) => [{
  mutation_id: randomUUID(), client_request_id: randomUUID(), operation,
  entity_key: `dream:${payload.remote_id ?? 'new'}`, base_revision: revision, payload,
}];

test('personal notes survive an offline save and a fresh browser without changing the dream', async ({ page, context, browserSurface, accounts }) => {
  const owner = client();
  expect((await owner.auth.signInWithPassword(accounts.free)).error).toBeNull();
  const story = `E2E original dream ${randomUUID()}: a lighthouse above the ocean.`;
  const created = await owner.from('dreams').insert({
    user_id: accounts.free.id, transcript: story, title: 'Lighthouse', interpretation: '',
    shareable_quote: '', dream_type: 'Symbolic Dream', client_request_id: randomUUID(),
  }).select('id').single();
  expect(created.error).toBeNull();
  const id = created.data!.id as number;
  const read = async () => {
    const result = await owner.from('dreams').select('transcript,personal_notes').eq('id', id).single();
    expect(result.error).toBeNull();
    return result.data!;
  };
  await login(page, accounts.free);
  await journal(page);
  await page.getByTestId(/^dream\.item\./).filter({ hasText: story }).click();
  const firstText = 'This lighthouse reminds me of a journey last summer.';
  await page.getByTestId('dream.note.add').click();
  await context.setOffline(true);
  try {
    await page.getByTestId('dream.note.input').fill(firstText);
    await page.getByTestId('dream.note.save').click();
    await expect(page.getByTestId('dream.personal-notes')).toContainText(firstText);
    expect((await read()).personal_notes).toEqual([]);
    await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
  } finally {
    await context.setOffline(false);
  }
  await expect.poll(async () => (await read()).personal_notes.map((note: { text: string }) => note.text)).toEqual([firstText]);
  const saved = (await read()).personal_notes[0];
  expect(saved.createdAt).toBeGreaterThan(0);

  const fresh = await browserSurface.newContext({ locale: 'en-US', serviceWorkers: 'block' });
  await restrictNetwork(fresh);
  const second = await fresh.newPage();
  try {
    await login(second, accounts.free);
    await journal(second);
    await second.getByTestId(/^dream\.item\./).filter({ hasText: story }).click();
    const note = second.getByTestId(`dream.note.${saved.id}`);
    await expect(note).toContainText(firstText);
    const editedText = 'Today I associate the lighthouse with finding my own direction.';
    await note.getByRole('button', { name: 'Edit note', exact: true }).click();
    await second.getByTestId('dream.note.input').fill(editedText);
    await second.getByTestId('dream.note.save').click();
    await expect.poll(async () => (await read()).personal_notes[0]?.text).toBe(editedText);
    expect((await read()).personal_notes[0].createdAt).toBe(saved.createdAt);
    expect((await read()).transcript).toBe(story);
    await expect(second.getByTestId('component.transcriptCard')).toContainText(story);

    await note.getByRole('button', { name: 'Delete note', exact: true }).click();
    await note.getByRole('button', { name: 'Confirm deletion', exact: true }).click();
    await expect(note).toHaveCount(0);
    await expect.poll(async () => (await read()).personal_notes).toEqual([]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('screen.recording')).toBeVisible();
    await journal(page);
    await page.getByTestId(/^dream\.item\./).filter({ hasText: story }).click();
    await expect(page.getByTestId(`dream.note.${saved.id}`)).toHaveCount(0);
    await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
  } finally {
    await fresh.close();
    await owner.auth.signOut();
  }
});

test('personal notes keep legacy compatibility, reject concurrent overwrites and remain private', async ({ accounts }) => {
  const owner = client();
  const other = client();
  expect((await owner.auth.signInWithPassword(accounts.free)).error).toBeNull();
  expect((await other.auth.signInWithPassword(accounts.other)).error).toBeNull();
  try {
    const note = reflection('A private thought about the lighthouse.');
    const requestId = randomUUID();
    const original = `Original transcript ${randomUUID()}`;
    const createPayload = { transcript: original, title: 'Lighthouse', client_request_id: requestId, personal_notes: [note] };
    const create = await owner.rpc('sync_dream_mutations', { mutations: mutation('create', createPayload) });
    expect(create.error).toBeNull();
    expect(create.data[0]).toMatchObject({ status: 'ack', dream: { personal_notes: [note] } });
    const id = create.data[0].remote_id as number;
    const update = (payload: Record<string, unknown>, revision?: string) => owner.rpc('sync_dream_mutations', {
      mutations: mutation('update', { remote_id: id, ...payload }, revision),
    });
    const legacy = await update({ title: 'An older app edits the title' });
    expect(legacy.error).toBeNull();
    expect(legacy.data[0]).toMatchObject({ status: 'ack', dream: { personal_notes: [note] } });
    const retry = await owner.rpc('sync_dream_mutations', { mutations: mutation('create', {
      transcript: original, title: 'A retried create from an older app', client_request_id: requestId,
    }) });
    expect(retry.error).toBeNull();
    expect(retry.data[0]).toMatchObject({ status: 'ack', remote_id: id, dream: { personal_notes: [note] } });

    // Two devices editing the same revision must not both acknowledge an overwrite.
    const baseRevision = retry.data[0].dream.revision_id;
    const additions = [reflection('A thought from the first device.'), reflection('A thought from the second device.')];
    const concurrent = await Promise.all(additions.map(addition => update({ personal_notes: [note, addition] }, baseRevision)));
    for (const result of concurrent) expect(result.error).toBeNull();
    expect(concurrent.map(result => result.data[0].status).sort()).toEqual(['ack', 'conflict']);
    const winner = concurrent.find(result => result.data[0].status === 'ack')!.data[0];
    const loser = concurrent.find(result => result.data[0].status === 'conflict')!.data[0];
    expect(loser.dream.personal_notes).toEqual(winner.dream.personal_notes);
    const merged = await update({ personal_notes: [note, ...additions] }, winner.dream.revision_id);
    expect(merged.error).toBeNull();
    expect(merged.data[0]).toMatchObject({ status: 'ack', dream: { personal_notes: [note, ...additions], transcript: original } });

    for (const caller of [other, client()]) {
      const read = await caller.from('dreams').select('personal_notes').eq('id', id);
      if (read.error) expect(read.error.code).toBe('42501');
      expect(read.data ?? []).toEqual([]);
      const write = await caller.from('dreams').update({ personal_notes: [] }).eq('id', id).select('id');
      if (write.error) expect(write.error.code).toBe('42501');
      expect(write.data ?? []).toEqual([]);
    }
    const foreign = await other.rpc('sync_dream_mutations', { mutations: mutation('update', { remote_id: id, personal_notes: [] }) });
    expect(foreign.error).toBeNull();
    expect(foreign.data[0].status).toBe('failed');
    expect(foreign.data[0].dream).toBeUndefined();

    const tooLong = await update({ personal_notes: [reflection('x'.repeat(4001))] });
    expect(tooLong.error !== null || tooLong.data?.[0]?.status === 'failed').toBe(true);
    const tooMany = await update({ personal_notes: Array.from({ length: 51 }, () => reflection('Too many')) });
    expect(tooMany.error !== null || tooMany.data?.[0]?.status === 'failed').toBe(true);
    const unchanged = await owner.from('dreams').select('transcript,personal_notes').eq('id', id).single();
    expect(unchanged.error).toBeNull();
    expect(unchanged.data).toEqual({ transcript: original, personal_notes: [note, ...additions] });
    expect((await owner.from('dreams').delete().eq('id', id)).error).toBeNull();
    const removed = await owner.from('dreams').select('personal_notes').eq('id', id);
    expect(removed.error).toBeNull();
    expect(removed.data).toEqual([]);
  } finally {
    await owner.auth.signOut();
    await other.auth.signOut();
  }
});


test('a personal-note draft stays open while an offline dream gains its server identity', async ({ page, context, accounts }) => {
  const owner = client();
  expect((await owner.auth.signInWithPassword(accounts.free)).error).toBeNull();
  await login(page, accounts.free);
  await page.getByTestId('settings.back').click();
  await page.getByRole('button', { name: 'Capture', exact: true }).click();
  const story = `E2E identity promotion ${randomUUID()}: a blue train crosses the moon.`;
  const draft = 'I am still writing this thought while my dream is backed up.';
  await context.setOffline(true);
  try {
    await page.getByTestId('input.dreamTranscript').fill(story);
    await page.getByTestId('btn.saveDream').click();
    const later = page.getByTestId('btn.dreamCaptureSeal.readLater');
    const savedStory = page.getByTestId('component.transcriptCard');
    await expect(later.or(savedStory).first()).toBeVisible();
    if (await later.isVisible()) await later.click();
    await expect(savedStory).toContainText(story);
    await page.getByTestId('dream.note.add').click();
    await page.getByTestId('dream.note.input').fill(draft);
    await expect(page.getByText('Sync pending', { exact: true }).or(page.getByText('Not synced yet', { exact: true })).first()).toBeVisible();
    const before = await owner.from('dreams').select('id').eq('transcript', story);
    expect(before.error).toBeNull();
    expect(before.data).toEqual([]);
  } finally {
    await context.setOffline(false);
  }
  try {
    const read = async () => {
      const result = await owner.from('dreams').select('id,transcript,personal_notes').eq('transcript', story);
      expect(result.error).toBeNull();
      return result.data ?? [];
    };
    await expect.poll(async () => (await read()).length).toBe(1);
    // The acknowledged result has reached the client, not just the database.
    await expect(page.getByText('Sync pending', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Not synced yet', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('dream.note.input')).toBeVisible();
    await expect(page.getByTestId('dream.note.input')).toHaveValue(draft);
    expect((await read())[0].personal_notes).toEqual([]);
    await page.getByTestId('dream.note.save').click();
    await expect.poll(async () => (await read())[0].personal_notes.map((note: { text: string }) => note.text)).toEqual([draft]);
    await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
  } finally {
    await owner.auth.signOut();
  }
});
