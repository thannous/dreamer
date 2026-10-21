import { randomUUID } from 'node:crypto';
import { test, expect, login, journal, client } from '../backend-fixtures';

test('another account and an anonymous client cannot read or mutate an owner dream', async ({ app, screen, browser, accounts }) => {
  const owner = client();
  const other = client();
  expect((await owner.auth.signInWithPassword(accounts.free)).error).toBeNull();
  expect((await other.auth.signInWithPassword(accounts.other)).error).toBeNull();
  const story = `E2E private dream ${randomUUID()}`;
  const inserted = await owner.from('dreams').insert({ user_id: accounts.free.id, transcript: story, title: 'Private lighthouse', interpretation: '', shareable_quote: '', dream_type: 'Symbolic Dream', client_request_id: randomUUID() }).select('id').single();
  expect(inserted.error).toBeNull();
  const id = inserted.data!.id;
  await login({ app, screen, browser }, accounts.other);
  await journal({ app, screen, browser });
  await expect(screen.getByTestId(/^dream\.item\./)).toHaveCount(0);
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
  test(`${tier} allowance comes from the server without any purchase`, async ({ app, screen, browser, accounts }) => {
    const userClient = client();
    expect((await userClient.auth.signInWithPassword(accounts[tier])).error).toBeNull();
    const story = `E2E ${tier} account-only dream ${randomUUID()}`;
    const inserted = await userClient.from('dreams').insert({
      user_id: accounts[tier].id, transcript: story, title: 'Account-only dream',
      interpretation: '', shareable_quote: '', dream_type: 'Symbolic Dream', client_request_id: randomUUID(),
    });
    expect(inserted.error).toBeNull();
    await login({ app, screen, browser }, accounts[tier]);
    await expect(screen.getByTestId('quota.analysisValue')).toContainText(tier === 'plus' ? 'Unlimited' : '/ 3');
    const snapshot = await userClient.rpc('get_authenticated_quota_snapshot');
    expect(snapshot.error).toBeNull();
    expect(snapshot.data.tier).toBe(tier);
    await journal({ app, screen, browser });
    await expect(screen.getByTestId(/^dream\.item\./).filter({ hasText: story })).toHaveCount(1);
    await screen.getByTestId('tab.settings').tap();
    await screen.getByTestId('btn.auth.signOut').tap();
    await expect(screen.getByTestId('screen.recording')).toBeVisible();
    await journal({ app, screen, browser });
    await expect(screen.getByTestId(/^dream\.item\./)).toHaveCount(0);
    await userClient.auth.signOut();
  });
}

