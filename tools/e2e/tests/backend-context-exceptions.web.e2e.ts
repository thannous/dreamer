import { randomUUID } from 'node:crypto';
import { test, expect, login, journal, client, restrictNetwork } from '../backend-context-fixtures';

test('a saved dream survives a completely fresh browser and synchronizes edits and deletion', async ({ page, browserSurface, accounts }) => {
  const story = `E2E durable dream ${randomUUID()}: a lighthouse above the ocean.`;
  const owner = client();
  const auth = await owner.auth.signInWithPassword(accounts.free);
  expect(auth.error).toBeNull();
  await login(page, accounts.free);
  await page.getByTestId('settings.back').click();
  await page.getByRole('button', { name: 'Capture', exact: true }).click();
  await page.getByTestId('input.dreamTranscript').fill(story);
  await page.getByTestId('btn.saveDream').click();
  await page.getByTestId('btn.dreamCaptureSeal.readLater').click();
  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
  await expect.poll(async () => {
    const result = await owner.from('dreams').select('id').eq('transcript', story);
    expect(result.error).toBeNull();
    return result.data?.length;
  }).toBe(1);

  const fresh = await browserSurface.newContext({ locale: 'en-US', serviceWorkers: 'block' });
  await restrictNetwork(fresh);
  const second = await fresh.newPage();
  try {
    await login(second, accounts.free);
    await journal(second);
    await second.getByTestId(/^dream\.item\./).filter({ hasText: story }).click();
    await expect(second.getByTestId('component.transcriptCard')).toContainText(story);
    const revision = `${story} The lighthouse now has a blue door.`;
    await second.getByTestId('btn.editDream').click();
    await second.getByTestId('input.dreamTranscript').fill(revision);
    await second.getByTestId('btn.saveDreamEdit').click();
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
    // The seal asks to read the dream only when the allowance was known before the network
    // dropped (the capture screen fetches it as it opens); either way the dream is saved.
    const later = page.getByTestId('btn.dreamCaptureSeal.readLater');
    const savedStory = page.getByTestId('component.transcriptCard');
    await expect(later.or(savedStory).first()).toBeVisible();
    if (await later.isVisible()) await later.click();
    await expect(savedStory).toContainText(story);
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
