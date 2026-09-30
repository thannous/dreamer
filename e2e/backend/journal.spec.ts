import { randomUUID } from 'node:crypto';
import { test, expect, login, journal, client, restrictNetwork } from './fixtures';

test('a saved dream survives a completely fresh browser and synchronizes edits and deletion', async ({ page, browser, accounts }) => {
  const story = `E2E durable dream ${randomUUID()}: a lighthouse above the ocean.`;
  const owner = client();
  const auth = await owner.auth.signInWithPassword(accounts.free);
  expect(auth.error).toBeNull();
  await login(page, accounts.free);
  await page.getByTestId('settings.back').click();
  await page.getByRole('button', { name: 'Capture', exact: true }).click();
  await page.getByTestId('input.dreamTranscript').fill(story);
  await page.getByTestId('btn.saveDream').click();
  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
  await expect.poll(async () => {
    const result = await owner.from('dreams').select('id').eq('transcript', story);
    expect(result.error).toBeNull();
    return result.data?.length;
  }).toBe(1);

  const fresh = await browser.newContext({ locale: 'en-US', serviceWorkers: 'block' });
  await restrictNetwork(fresh);
  const second = await fresh.newPage();
  try {
    await login(second, accounts.free);
    await journal(second);
    await second.getByTestId(/^dream\.item\./).filter({ hasText: story }).click();
    await expect(second.getByTestId('component.transcriptCard')).toContainText(story);
    const revision = `${story} The lighthouse now has a blue door.`;
    await second.getByTestId('btn.editTranscript').click();
    await second.getByTestId('input.dreamTranscript').fill(revision);
    await second.getByTestId('btn.editTranscript').click();
    await expect.poll(async () => (await owner.from('dreams').select('transcript')).data?.map(row => row.transcript)).toEqual([revision]);
    await journal(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('screen.recording')).toBeVisible();
    await journal(page);
    await page.getByTestId(/^dream\.item\./).filter({ hasText: revision }).click();
    await expect(page.getByTestId('component.transcriptCard')).toContainText(revision);
    await page.getByTestId('btn.dream.delete').click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect.poll(async () => (await owner.from('dreams').select('id')).data).toEqual([]);
    await journal(second);
    await second.reload({ waitUntil: 'domcontentloaded' });
    await expect(second.getByTestId('screen.recording')).toBeVisible();
    await journal(second);
    await expect(second.getByTestId(/^dream\.item\./).filter({ visible: true })).toHaveCount(0);
  } finally {
    await fresh.close();
    await owner.auth.signOut();
  }
});

test('another account and an anonymous client cannot read or mutate an owner dream', async ({ page, accounts }) => {
  const owner = client();
  const other = client();
  expect((await owner.auth.signInWithPassword(accounts.free)).error).toBeNull();
  expect((await other.auth.signInWithPassword(accounts.other)).error).toBeNull();
  const story = `E2E private dream ${randomUUID()}`;
  const inserted = await owner.from('dreams').insert({ user_id: accounts.free.id, transcript: story, title: 'Private lighthouse', interpretation: '', shareable_quote: '', dream_type: 'Symbolic Dream', client_request_id: randomUUID() }).select('id').single();
  expect(inserted.error).toBeNull();
  const id = inserted.data!.id;
  await login(page, accounts.other);
  await journal(page);
  await expect(page.getByTestId(/^dream\.item\./).filter({ visible: true })).toHaveCount(0);
  for (const caller of [other, client()]) {
    const read = await caller.from('dreams').select('id').eq('id', id);
    if (read.error) expect(read.error.code).toBe('42501');
    expect(read.data ?? []).toEqual([]);
    const update = await caller.from('dreams').update({ transcript: 'Intrusion' }).eq('id', id).select('id');
    if (update.error) expect(update.error.code).toBe('42501');
    expect(update.data ?? []).toEqual([]);
    const remove = await caller.from('dreams').delete().eq('id', id).select('id');
    if (remove.error) expect(remove.error.code).toBe('42501');
    expect(remove.data ?? []).toEqual([]);
  }
  const transfer = await owner.from('dreams').update({ user_id: accounts.other.id }).eq('id', id);
  expect(transfer.error?.code).toBe('42501');
  const foreignInsert = await other.from('dreams').insert({
    user_id: accounts.free.id, transcript: 'Intrusion', title: 'Intrusion',
    interpretation: '', shareable_quote: '', dream_type: 'Symbolic Dream', client_request_id: randomUUID(),
  });
  expect(foreignInsert.error?.code).toBe('42501');
  const unchanged = await owner.from('dreams').select('transcript').eq('id', id).single();
  expect(unchanged.error).toBeNull();
  expect(unchanged.data?.transcript).toBe(story);
  const forged = await other.auth.updateUser({ data: { tier: 'plus' } });
  expect(forged.error).toBeNull();
  const tier = await other.rpc('get_effective_subscription_tier');
  expect(tier.error).toBeNull();
  expect(tier.data).toBe('free');
  await owner.auth.signOut();
  await other.auth.signOut();
});

for (const tier of ['free', 'plus'] as const) {
  test(`${tier} allowance comes from the server without any purchase`, async ({ page, accounts }) => {
    await login(page, accounts[tier]);
    await expect(page.getByTestId('quota.analysisValue')).toContainText(tier === 'plus' ? 'Unlimited' : '/ 3');
    const userClient = client();
    expect((await userClient.auth.signInWithPassword(accounts[tier])).error).toBeNull();
    const snapshot = await userClient.rpc('get_authenticated_quota_snapshot');
    expect(snapshot.error).toBeNull();
    expect(snapshot.data.tier).toBe(tier);
    await page.getByTestId('btn.auth.signOut').click();
    await expect(page.getByTestId('screen.recording')).toBeVisible();
    await journal(page);
    await expect(page.getByTestId(/^dream\.item\./).filter({ visible: true })).toHaveCount(0);
    await userClient.auth.signOut();
  });
}

test('an offline save synchronizes once after reconnection and survives restart', async ({ page, context, accounts }) => {
  await login(page, accounts.free);
  await page.getByTestId('settings.back').click();
  await page.getByRole('button', { name: 'Capture', exact: true }).click();
  const story = `E2E offline dream ${randomUUID()}: a blue train crosses the moon.`;
  const owner = client();
  expect((await owner.auth.signInWithPassword(accounts.free)).error).toBeNull();
  await context.setOffline(true);
  try {
    await page.getByTestId('input.dreamTranscript').fill(story);
    await page.getByTestId('btn.saveDream').click();
    await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
    const before = await owner.from('dreams').select('id').eq('transcript', story);
    expect(before.error).toBeNull();
    expect(before.data).toEqual([]);
  } finally {
    await context.setOffline(false);
  }
  await expect.poll(async () => {
    const result = await owner.from('dreams').select('id').eq('transcript', story);
    expect(result.error).toBeNull();
    return result.data?.length;
  }).toBe(1);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('screen.recording')).toBeVisible();
  await journal(page);
  await page.getByTestId(/^dream\.item\./).filter({ hasText: story }).click();
  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
  expect((await owner.from('dreams').select('id').eq('transcript', story)).data).toHaveLength(1);
  await owner.auth.signOut();
});
