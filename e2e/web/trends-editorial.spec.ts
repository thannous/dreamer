import type { Page, TestInfo } from 'playwright/test';
import { test, expect } from './fixtures';

test.use({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Paris' });

async function startGuest(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-02T12:00:00Z'));
  await page.addInitScript(() => { Math.random = () => 0.5; });
  await page.goto('/');
  await page.getByTestId('btn.onboarding.intro.next').click();
  await page.getByTestId('btn.onboarding.skip').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
}

async function openTrends(page: Page) {
  await page.getByRole('tab').and(page.getByTestId('tab.stats')).click();
  await expect(page.getByTestId('trends.section.week')).toBeVisible();
}

async function finishProfileWelcome(page: Page) {
  const skip = page.getByTestId('btn.onboarding.skip');
  const recording = page.getByTestId('screen.recording');
  await expect.poll(async () => await skip.isVisible() || await recording.isVisible()).toBe(true);
  if (await skip.isVisible()) await skip.click();
  await expect(recording).toBeVisible();
}

async function selectTheme(page: Page, theme: 'light' | 'dark' | 'auto') {
  await page.getByTestId('btn.header.trends.settings').click();
  await page.getByTestId(`quick-settings.theme.${theme}`).click();
  await page.getByTestId('quick-settings.close').click();
}

async function artifact(page: Page, info: TestInfo, name: string) {
  for (const section of ['trends.section.week', 'trends.section.patterns']) {
    await expect.poll(() => page.getByTestId(section).evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  await info.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}

test('an empty journal keeps honest metrics in both themes and starts its first capture', async ({ page }, info) => {
  await startGuest(page);
  await openTrends(page);
  await expect(page.getByTestId('trends.week.count.value')).toHaveText('0');
  await expect(page.getByTestId('trends.week.activeDays.value')).toHaveText('0');
  await expect(page.getByTestId('trends.week.rhythm')).toHaveCount(0);
  await expect(page.getByText('Patterns will appear as you capture more dreams.')).toBeVisible();
  await expect(page.getByTestId('trends.week.details')).not.toContainText('Weekly average');
  await selectTheme(page, 'light');
  await page.setViewportSize({ width: 320, height: 844 });
  await artifact(page, info, 'empty-light-320');
  await selectTheme(page, 'dark');
  await artifact(page, info, 'empty-dark-320');
  await page.getByTestId('trends.cta.primary').click();
  await page.getByTestId('input.dreamTranscript').fill('A short synthetic dream about a quiet garden.');
  await page.getByTestId('btn.saveDream').click();
  await expect(page.getByTestId('component.transcriptCard')).toContainText('A short synthetic dream about a quiet garden.');
  await expect(page.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S{20}/);
  await info.attach('first-capture-inline-analysis', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByTestId('btn.navigateJournal').click();
  await expect(page.getByTestId(/^dream\.item\.\d+$/).filter({ visible: true })).toContainText('A short synthetic dream about a quiet garden.');
});

test('populated trends retain motifs and themes when Intl.PluralRules is unavailable', async ({ page }, info) => {
  // Hermes builds may provide number/date formatters without this constructor.
  await page.addInitScript(() => Object.defineProperty(Intl, 'PluralRules', { value: undefined, configurable: true }));
  await startGuest(page);
  await page.getByTestId('tab.home').click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByTestId('quick-settings.signin').click();
  await page.getByTestId('btn.mockProfile.plus').click();
  await finishProfileWelcome(page);
  await openTrends(page);
  await expect(page.getByTestId('trends.week.count.value')).toHaveText('4');
  await expect(page.getByTestId('trends.week.activeDays.value')).toHaveText('4');
  await expect(page.getByTestId('trends.week.details')).toContainText('Weekly average');
  await expect(page.getByTestId('trends.patterns.themes.list')).toBeVisible();
  await expect(page.getByTestId('trends.evolution.chart')).toBeAttached();
  await expect(page.getByTestId('trends.week.rhythm')).toHaveCount(0);
  const background = () => page.getByTestId('trends.section.week').evaluate((element) => {
    let current: Element | null = element;
    while (current) {
      const value = getComputedStyle(current).backgroundColor;
      if (value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') return value;
      current = current.parentElement;
    }
    return '';
  });
  await selectTheme(page, 'light');
  await expect.poll(background).toBe('rgb(240, 228, 212)');
  await artifact(page, info, 'populated-light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(background).toBe('rgb(240, 228, 212)');
  await selectTheme(page, 'dark');
  await expect.poll(background).toBe('rgb(3, 4, 13)');
  await artifact(page, info, 'populated-dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(background).toBe('rgb(3, 4, 13)');
  await selectTheme(page, 'auto');
  await expect.poll(background).toBe('rgb(240, 228, 212)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(background).toBe('rgb(3, 4, 13)');
  await artifact(page, info, 'populated-system-dark');
});

test.describe('long translated labels', () => {
  test.use({ locale: 'de-DE', viewport: { width: 320, height: 844 } });
  test('the German journal keeps labels and values within the screen', async ({ page }, info) => {
    await startGuest(page);
    await page.getByTestId('tab.home').filter({ visible: true }).click();
    await page.getByTestId('btn.header.home.settings').click();
    await page.getByTestId('quick-settings.signin').click();
    await page.getByTestId('btn.mockProfile.plus').click();
    await finishProfileWelcome(page);
    await openTrends(page);
    await expect(page.getByText('Wiederkehrende Themen', { exact: true })).toBeVisible();
    await artifact(page, info, 'populated-long-labels-de-320');
  });
});
