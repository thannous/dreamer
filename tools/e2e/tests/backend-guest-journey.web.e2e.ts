import type { Page } from 'playwright/test';
import { test, expect, journal, type GuestApi } from '../backend-guest-fixtures';

// A guest on the real server path: session, server quota and analyses come from the
// local API (tools/dev-local/api-server.ts) on this run's disposable stack, not the mock.
// Each test is a new browser profile, so a new guest device.
const stories = [
  'I walked through a garden at night, and a lamp stayed lit at the end of the path.',
  'A night train crossed a forest of lanterns while I looked for my ticket.',
  'An hourglass counted down under the sea and nobody else could see it.',
];

async function startAsNewGuest(page: Page) {
  await page.getByTestId('btn.onboarding.intro.next').click();
  await page.getByTestId('btn.onboarding.skip').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
}

/** The AI consent is asked once, at the first AI use, wherever that comes. */
async function answerConsent(page: Page) {
  const accept = page.getByTestId('btn.aiConsent.accept').filter({ visible: true });
  if (await accept.count()) await accept.first().click({ timeout: 2_000 }).catch(() => undefined);
}

/**
 * Saves a dream through the capture seal. Returns whether the seal asked to read it;
 * `read` answers that question. A dream read at once opens without the question.
 */
async function saveDream(page: Page, story: string, { read = false } = {}) {
  await page.getByTestId('input.dreamTranscript').fill(story);
  await page.getByTestId('btn.saveDream').click();
  const card = page.getByTestId('component.transcriptCard').filter({ visible: true });
  const readNow = page.getByTestId('btn.dreamCaptureSeal.readNow').filter({ visible: true });
  let asked = false;
  // The seal opens the dream by itself; it is never opened by hand here, so a stalled
  // hand-off fails the journey. It only pauses to ask about the reading.
  await expect.poll(async () => {
    await answerConsent(page);
    if (await readNow.count()) {
      asked = true;
      await page.getByTestId(read ? 'btn.dreamCaptureSeal.readNow' : 'btn.dreamCaptureSeal.readLater')
        .filter({ visible: true }).click({ timeout: 2_000 }).catch(() => undefined);
    }
    return card.count();
  }, { timeout: 60_000, intervals: [250] }).toBeGreaterThan(0);
  return { asked };
}

async function expectReading(page: Page) {
  const reading = page.getByTestId('component.dreamDetail.readingZone').filter({ visible: true });
  await expect.poll(async () => {
    await answerConsent(page);
    return ((await reading.first().textContent().catch(() => '')) ?? '').length;
  }, { timeout: 60_000, intervals: [250] }).toBeGreaterThan(100);
}

async function newDream(page: Page) {
  await journal(page);
  await page.getByTestId('tab.addDream').filter({ visible: true }).click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
}

async function openSettings(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('tab.home').filter({ visible: true }).click();
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.all').click();
}

/** The guest's session and its server quota are known before its first dream, as on a phone. */
async function guestReady(page: Page, guestApi: GuestApi) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await startAsNewGuest(page);
  await expect.poll(() => guestApi.count('guest/session') && guestApi.count('quota/status'), { timeout: 30_000 }).toBeGreaterThan(0);
}

test('a guest gets its first dream read at once, its second on request, then an account for more', {
  tags: ['guest'], timeout: 300_000,
}, async ({ page, guestApi }) => {
  await guestReady(page, guestApi);

  expect((await saveDream(page, stories[0])).asked).toBe(false);
  await expectReading(page);
  expect(guestApi.count('analyzeDream')).toBe(1);

  await newDream(page);
  expect((await saveDream(page, stories[1], { read: true })).asked).toBe(true);
  await expectReading(page);
  expect(guestApi.count('analyzeDream')).toBe(2);

  // The server's quota now says both free analyses are used, and the app asks for no third:
  // the dream is kept and an account is offered.
  await expect.poll(async () => {
    const quota = guestApi.calls.filter(call => call.route === 'quota/status' && call.status === 200).at(-1);
    const usage = (await quota?.body as { usage?: { analysis?: { used?: number; limit?: number } } } | null)?.usage?.analysis;
    return usage && `${usage.used}/${usage.limit}`;
  }, { timeout: 30_000 }).toBe('2/2');
  await newDream(page);
  await saveDream(page, stories[2]);
  await expect(page.getByText('Your included analyses are used up. A free account unlocks new analyses.', { exact: true })
    .filter({ visible: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('btn.dream.primaryCta').filter({ visible: true })).toContainText('Create account');
  expect(guestApi.calls.filter(call => call.route === 'analyzeDream')).toHaveLength(2);
});

test('« Nouvel invité » waits for an empty guest journal, then the device reads its first dream at once again', {
  tags: ['guest'], timeout: 300_000,
}, async ({ page, guestApi }) => {
  await guestReady(page, guestApi);
  expect((await saveDream(page, stories[0])).asked).toBe(false);
  await expectReading(page);

  // No guest dream is ever erased: the reset is refused while one remains.
  await openSettings(page);
  await page.getByTestId('guest-local-new-guest-button').click();
  await expect(page.getByTestId('guest-recording-qa-reset-result'))
    .toContainText('Supprime d’abord le rêve invité du journal');
  expect(guestApi.count('dev-local/guest-reset')).toBe(0);

  await journal(page);
  await page.getByTestId(/^dream\.item\./).filter({ visible: true }).first().click();
  await page.getByTestId('btn.dream.delete').filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
  await expect(page.getByTestId('screen.journal').filter({ visible: true })).toHaveCount(1);
  await expect(page.getByTestId(/^dream\.item\./).filter({ visible: true })).toHaveCount(0);

  await openSettings(page);
  await page.getByTestId('guest-local-new-guest-button').click();
  await expect(page.getByTestId('btn.onboarding.intro.next')).toBeVisible({ timeout: 60_000 });
  expect(guestApi.count('dev-local/guest-reset')).toBe(1);

  // The server forgot this device's analysis: its quota is read again before the first
  // dream, which is then read at once instead of being offered a reading.
  const reset = guestApi.calls.findIndex(call => call.route === 'dev-local/guest-reset');
  await startAsNewGuest(page);
  await expect.poll(() => guestApi.calls.slice(reset + 1)
    .some(call => call.route === 'quota/status' && call.status === 200), { timeout: 30_000 }).toBe(true);
  expect((await saveDream(page, stories[1])).asked).toBe(false);
  await expectReading(page);
  expect(guestApi.count('analyzeDream')).toBe(2);

  // The welcome skipped after the reset is saved, as on a first launch.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await journal(page);
  await expect(page.getByTestId('btn.onboarding.intro.next')).toHaveCount(0);
});
