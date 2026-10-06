// Historical exact UI assertions executed under the guarded TesterArmy engine.
import type { Page } from 'playwright/test';
import { createParityTest, expect, type ParityInfo } from '../web-parity-fixtures';

const test = createParityTest({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' });

async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
  await page.getByRole('button', { name: /Tous les paramètres/ }).click();
  await expect(page.getByTestId('screen.settings')).toBeVisible();
}

async function chooseTheme(page: Page, theme: 'light' | 'dark' | 'auto') {
  await page.getByTestId('settings-theme-choice').click();
  for (const value of ['dynamic', 'auto', 'light', 'dark']) {
    await expect(page.getByTestId(`settings-theme-choice.option.${value}`)).toBeVisible();
  }
  await page.getByTestId(`settings-theme-choice.option.${theme}`).click();
  await expect(page.getByTestId('settings-theme-choice.sheet')).toHaveCount(0);
}

for (const theme of ['light', 'dark'] as const) {
  test(`grouped settings preserve account, choices and reminder states in ${theme}`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('btn.onboarding.intro.next').click();
    await page.getByTestId('btn.onboarding.skip').click();
    await expect(page.getByTestId('screen.recording').filter({ visible: true })).toHaveCount(1);
    await openSettings(page);
    await page.getByTestId('settings-account-open-signin').click();
    await expect(page.getByTestId('btn.mockProfile.new')).toBeVisible();
    await page.getByTestId('btn.mockProfile.new').click();
    await expect(page.getByTestId('screen.recording').filter({ visible: true })).toHaveCount(1);
    await openSettings(page);
    await chooseTheme(page, theme);
    const background = theme === 'light' ? 'rgb(240, 228, 212)' : 'rgb(3, 4, 13)';
    await expect(page.getByTestId('screen.settings')).toHaveCSS('background-color', background);
    await page.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light' });
    await expect(page.getByTestId('screen.settings')).toHaveCSS('background-color', background);
    await page.getByTestId('settings-language-choice').click();
    await page.getByTestId('settings-language-choice.option.fr').click();
    await expect(page.getByTestId('settings-language-choice.sheet')).toHaveCount(0);
    await page.getByTestId('settings-section-account').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo({ left: 0 }));
    await page.screenshot({ path: testInfo.outputPath(`settings-${theme}-top.png`) });

    const reminders = page.getByTestId('settings-notifications-reminder-toggle');
    await expect(reminders).toHaveAttribute('aria-checked', 'false');
    await reminders.click();
    await expect(reminders).toHaveAttribute('aria-checked', 'true');
    await expect(reminders).toContainText('Activé');
    const activeThumb = theme === 'light' ? 'rgb(255, 249, 239)' : 'rgb(56, 45, 53)';
    await expect(reminders.getByRole('switch').last()).toBeChecked();
    await expect.poll(() => reminders.evaluate(element =>
      Array.from(element.querySelectorAll('div')).map(node => getComputedStyle(node).backgroundColor)),
    { message: 'The ON thumb uses the Noctalia palette after the native CSS transition' }).toContain(activeThumb);
    const weekend = page.getByTestId('settings-notifications-weekend-toggle');
    await expect(weekend).toHaveAttribute('aria-checked', 'false');
    await expect(weekend).toContainText('Désactivé');
    await expect(page.getByTestId('settings-notifications-weekend-time')).toHaveCount(0);
    await weekend.click();
    await expect(page.getByTestId('settings-notifications-weekend-time')).toBeVisible();
    await weekend.click();
    await expect(page.getByTestId('settings-notifications-weekend-time')).toHaveCount(0);
    const recap = page.getByTestId('settings-notifications-weekly-recap-toggle');
    await recap.click();
    await expect(recap).toHaveAttribute('aria-checked', 'true');
    await expect(recap).toContainText('Activé');
    await expect(recap.getByRole('switch').last()).toBeChecked();
    await expect.poll(() => recap.evaluate(element =>
      Array.from(element.querySelectorAll('div')).map(node => getComputedStyle(node).backgroundColor)),
    { message: 'Capture the recap only after its ON thumb has settled' }).toContain(activeThumb);
    await page.getByTestId('settings-section-notifications').screenshot({ path: testInfo.outputPath(`settings-${theme}-rituals.png`) });
    await page.getByTestId('settings-notifications-weekday-time').click();
    await expect(page.getByTestId('settings-notifications-weekday-sheet')).toBeVisible();
    await page.getByRole('button', { name: 'Terminé', exact: true }).click();
    await expect(page.getByTestId('settings-notifications-weekday-sheet')).toHaveCount(0);
    await expect(page.getByTestId('quota.analysisValue')).toContainText('/ 3');
    for (const id of ['settings-legal-privacy-policy', 'settings-legal-terms-of-use', 'settings-legal-account-deletion', 'settings-delete-account']) {
      await expect(page.getByTestId(id)).toHaveCount(1);
    }

    await page.getByTestId('settings.back').click();
    await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
    await page.getByRole('button', { name: /Tous les paramètres/ }).click();
    await expect(reminders).toHaveAttribute('aria-checked', 'true');
    await expect(recap).toHaveAttribute('aria-checked', 'true');
    await chooseTheme(page, 'auto');
    const systemBackground = theme === 'light' ? 'rgb(3, 4, 13)' : 'rgb(240, 228, 212)';
    await expect(page.getByTestId('screen.settings')).toHaveCSS('background-color', systemBackground);
    await page.emulateMedia({ colorScheme: theme });
    await expect(page.getByTestId('screen.settings')).toHaveCSS('background-color', background);
    const footer = page.getByTestId('settings-signout-footer');
    await footer.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo({ left: 0 }));
    await page.screenshot({ path: testInfo.outputPath(`settings-${theme}-footer.png`) });
    await page.setViewportSize({ width: 320, height: 844 });
    const group = page.getByTestId('settings-section-notifications');
    const widths = await group.evaluate(element => ({ client: element.clientWidth, content: element.scrollWidth }));
    expect(widths.content, 'Reminder content remains within its group at 320px').toBeLessThanOrEqual(widths.client + 1);
    await page.setViewportSize({ width: 390, height: 844 });
    await footer.getByTestId('btn.auth.signOut').click();
    await expect(page.getByTestId('screen.recording').filter({ visible: true })).toHaveCount(1);
    await openSettings(page);
    await expect(page.getByTestId('settings-account-open-signin')).toBeVisible();
    await expect(page.getByTestId('btn.auth.signOut')).toHaveCount(0);
    await expect(page.getByTestId('settings-delete-account')).toHaveCount(0);
  });
}
