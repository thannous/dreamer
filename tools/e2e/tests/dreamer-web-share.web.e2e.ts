// On the web a dream is shared as text: its name, quote, reading, type and theme. The browser's
// share sheet takes it when there is one; otherwise a window shows the text to copy, or to
// select by hand where the browser cannot copy. The image card is a phone's alone.
import type { Page } from 'playwright/test';
import { createParityTest, expect, withDialog } from '../web-parity-fixtures';
const test = createParityTest();

const TITLE = 'The Infinite Library';
const STORY = 'I found myself in an enormous library with endless shelves';
const QUOTE = '“Within us lies an infinite library of memories, waiting to be rediscovered.”';
const READING = 'Interpretation: The infinite library represents your vast inner knowledge and memories.';
const FOOTER = 'Shared from my Noctalia journal.';

type Browser = { shareSheet?: 'shares' | 'cancels' | 'fails'; clipboard?: 'copies' | 'fails' };

// Headless browsers differ on what they offer; each journey sets the browser it means.
async function useBrowser(page: Page, browser: Browser) {
  await page.addInitScript((wanted: Browser) => {
    const record = window as unknown as { shared: unknown[]; copied: string[] };
    record.shared = [];
    record.copied = [];
    const share = wanted.shareSheet && (async (data: unknown) => {
      if (wanted.shareSheet === 'cancels') throw new DOMException('Share canceled', 'AbortError');
      if (wanted.shareSheet === 'fails') throw new Error('Share sheet unavailable');
      record.shared.push(data);
    });
    const clipboard = wanted.clipboard && {
      writeText: async (text: string) => {
        if (wanted.clipboard === 'fails') throw new Error('Clipboard denied');
        record.copied.push(text);
      },
    };
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard });
  }, browser);
}

const shared = (page: Page) => page.evaluate(() => (window as unknown as { shared: { title?: string; text?: string }[] }).shared);
const copied = (page: Page) => page.evaluate(() => (window as unknown as { copied: string[] }).copied);

async function selectPlus(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withDialog(page, 'accept', () => page.getByTestId('btn.onboarding.feature.close').click());
  }
  await page.getByTestId('btn.onboarding.skip').click();
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.all').click();
  await page.getByTestId('settings-account-open-signin').click();
  await page.getByTestId('btn.mockProfile.plus').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
}

async function openJournal(page: Page) {
  // A dream page opens over the journal: its tab stays on that page, the way back leaves it.
  const back = page.getByTestId('btn.navigateJournal').filter({ visible: true });
  if (await back.isVisible()) await back.click();
  else await page.getByTestId('tab.journal').filter({ visible: true }).click();
  await expect(page.getByTestId('screen.journal').filter({ visible: true })).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Search dreams…' }).fill(TITLE);
  return page.getByTestId(/^dream\.item\.\d+$/).filter({ hasText: TITLE, visible: true });
}

async function openDream(page: Page) {
  await (await openJournal(page)).click();
  await expect(page.getByTestId('component.transcriptCard')).toContainText(STORY);
}

const copyWindow = (page: Page) => page.getByTestId('btn.share.close').filter({ visible: true });

function expectSharedText(text: string | undefined) {
  expect(text?.startsWith(`🌙 ${TITLE}\n\n${QUOTE}`)).toBe(true);
  expect(text).toContain(READING);
  expect(text).toMatch(/\n\nType: .+ • Theme: .+\n\n/);
  expect(text?.endsWith(FOOTER)).toBe(true);
}

test('the browser share sheet receives the dream as text, with nothing left open', async ({ page }) => {
  await useBrowser(page, { shareSheet: 'shares', clipboard: 'copies' });
  await selectPlus(page);
  await openDream(page);
  await page.getByTestId('btn.dream.share').filter({ visible: true }).click();
  await expect.poll(async () => (await shared(page)).length).toBe(1);
  const [sent] = await shared(page);
  expect(sent.title).toBe(TITLE);
  expectSharedText(sent.text);
  await expect(page.getByTestId('btn.dream.share').filter({ visible: true })).toBeEnabled();
  await expect(copyWindow(page)).toHaveCount(0);
  expect(await copied(page)).toEqual([]);
});

test('without a share sheet the dream opens to copy, copies its text, and closes', async ({ page }) => {
  await useBrowser(page, { clipboard: 'copies' });
  await selectPlus(page);
  await openDream(page);
  await page.getByTestId('btn.dream.share').filter({ visible: true }).click();
  await expect(copyWindow(page)).toBeVisible();
  await expect(page.getByText('Share your dream', { exact: true })).toBeVisible();
  await expect(page.getByText('Copy this quote and share it anywhere.', { exact: true })).toBeVisible();
  await expect(page.getByText(READING, { exact: false }).filter({ visible: true }).last()).toBeVisible();

  const copy = page.getByTestId('btn.share.copy');
  await expect(copy).toContainText('Copy quote');
  await copy.click();
  await expect(copy).toContainText('Copied!');
  const [text] = await copied(page);
  expectSharedText(text);

  await copyWindow(page).click();
  await expect(copyWindow(page)).toHaveCount(0);
  await expect(page.getByTestId('component.transcriptCard')).toContainText(STORY);
});

test('a cancelled share sheet opens nothing else; a failing one and a refused copy leave the text to select', async ({ page }) => {
  await useBrowser(page, { shareSheet: 'cancels' });
  await selectPlus(page);
  await openDream(page);
  const share = page.getByTestId('btn.dream.share').filter({ visible: true });
  await share.click();
  await expect(share).toBeEnabled();
  await expect(copyWindow(page)).toHaveCount(0);

  // The same browser now fails to share, and cannot copy either.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new Error('Share sheet unavailable'); } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Clipboard denied'); } } });
  });
  await share.click();
  await expect(copyWindow(page)).toBeVisible();
  await page.getByTestId('btn.share.copy').click();
  await expect(page.getByText('Copying didn’t work. Select the text above to copy it.', { exact: true })).toBeVisible();
  await copyWindow(page).click();
  await expect(copyWindow(page)).toHaveCount(0);
});

test('a browser that can neither share nor copy shows the text to select by hand', async ({ page }) => {
  await useBrowser(page, {});
  await selectPlus(page);
  await openDream(page);
  await page.getByTestId('btn.dream.share').filter({ visible: true }).click();
  await expect(copyWindow(page)).toBeVisible();
  await expect(page.getByText('Select the quote below to copy it manually.', { exact: true })).toBeVisible();
  await expect(page.getByTestId('btn.share.copy')).toHaveCount(0);
  await copyWindow(page).click();
  await expect(copyWindow(page)).toHaveCount(0);
});

test('sharing from a journal card opens its dream and shares it once', async ({ page }) => {
  await useBrowser(page, { shareSheet: 'shares' });
  await selectPlus(page);
  const card = await openJournal(page);
  const id = await card.getAttribute('data-testid');
  await page.getByTestId(`journal.share.${id}`).click();
  await expect(page.getByTestId('component.transcriptCard')).toContainText(STORY);
  await expect.poll(async () => (await shared(page)).length).toBe(1);
  expect((await shared(page))[0].title).toBe(TITLE);

  // Opened again from the journal, the dream does not share by itself.
  await openDream(page);
  await expect(page.getByTestId('btn.dream.share').filter({ visible: true })).toBeEnabled();
  expect(await shared(page)).toHaveLength(1);
});
