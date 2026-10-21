import { readDOM, byId, expectCSS, createExactWebTest, expect, withExactDialog } from '../exact-web-fixtures';
import type { ExactWebUI } from '../exact-web-fixtures';
// Exact journeys using public TesterArmy APIs.

const test = createExactWebTest({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' });

async function openSettings(ui: ExactWebUI) {
  const { screen } = ui;
  await screen.getByRole('button', { name: 'Paramètres', exact: true }).click();
  await screen.getByRole('button', { name: /Tous les paramètres/ }).click();
  await expect(screen.getByTestId('screen.settings')).toBeVisible();
}

async function chooseTheme(ui: ExactWebUI, theme: 'light' | 'dark' | 'auto') {
  const { screen } = ui;
  await screen.getByTestId('settings-theme-choice').click();
  for (const value of ['dynamic', 'auto', 'light', 'dark']) {
    await expect(screen.getByTestId(`settings-theme-choice.option.${value}`)).toBeVisible();
  }
  await screen.getByTestId(`settings-theme-choice.option.${theme}`).click();
  // The sheet stays mounted once closed; what the reader sees is that it is gone.
  await expect(screen.getByTestId('settings-theme-choice.sheet')).toBeHidden();
}

for (const theme of ['light', 'dark'] as const) {
  test(`grouped settings preserve account, choices and reminder states in ${theme}`, async (ui) => {
  const { app, screen, browser } = ui;
    await browser.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light' });
    await app.open('/');
    await screen.getByTestId('btn.onboarding.intro.next').click();
    // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
    if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withExactDialog(browser, 'accept', () => screen.getByTestId('btn.onboarding.feature.close').click());
  }
    await screen.getByTestId('btn.onboarding.skip').click();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toHaveCount(1);
    await openSettings(ui);
    await screen.getByTestId('settings-account-open-signin').click();
    await expect(screen.getByTestId('btn.mockProfile.new')).toBeVisible();
    await screen.getByTestId('btn.mockProfile.new').click();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toHaveCount(1);
    await openSettings(ui);
    await chooseTheme(ui, theme);
    const background = theme === 'light' ? 'rgb(240, 228, 212)' : 'rgb(3, 4, 13)';
    await expectCSS(browser, byId('screen.settings'), 'background-color', background);
    await browser.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light' });
    await expectCSS(browser, byId('screen.settings'), 'background-color', background);
    await screen.getByTestId('settings-language-choice').click();
    await screen.getByTestId('settings-language-choice.option.fr').click();
    await expect(screen.getByTestId('settings-language-choice.sheet')).toBeHidden();
    await screen.getByTestId('settings-section-account').scrollIntoView();
    await browser.evaluate(() => { window.scrollTo({ left: 0 }); return null; });
    await app.screenshot(`settings-${theme}-top.png`);

    const reminders = screen.getByTestId('settings-notifications-reminder-toggle');
    await expect(reminders).toHaveAttribute('aria-checked', 'false');
    await reminders.click();
    await expect(reminders).toHaveAttribute('aria-checked', 'true');
    await expect(reminders).toContainText('Activé');
    const activeThumb = theme === 'light' ? 'rgb(255, 249, 239)' : 'rgb(56, 45, 53)';
    await expect(reminders.getByRole('switch').last()).toBeChecked();
    await expect.poll(() => readDOM(browser, byId('settings-notifications-reminder-toggle'), element =>
      Array.from(element.querySelectorAll('div')).map(node => getComputedStyle(node).backgroundColor)),
    { message: 'The ON thumb uses the Noctalia palette after the native CSS transition' }).toContain(activeThumb);
    const weekend = screen.getByTestId('settings-notifications-weekend-toggle');
    await expect(weekend).toHaveAttribute('aria-checked', 'false');
    await expect(weekend).toContainText('Désactivé');
    await expect(screen.getByTestId('settings-notifications-weekend-time')).toHaveCount(0);
    await weekend.click();
    await expect(screen.getByTestId('settings-notifications-weekend-time')).toBeVisible();
    await weekend.click();
    await expect(screen.getByTestId('settings-notifications-weekend-time')).toHaveCount(0);
    const recap = screen.getByTestId('settings-notifications-weekly-recap-toggle');
    await recap.click();
    await expect(recap).toHaveAttribute('aria-checked', 'true');
    await expect(recap).toContainText('Activé');
    await expect(recap.getByRole('switch').last()).toBeChecked();
    await expect.poll(() => readDOM(browser, byId('settings-notifications-weekly-recap-toggle'), element =>
      Array.from(element.querySelectorAll('div')).map(node => getComputedStyle(node).backgroundColor)),
    { message: 'Capture the recap only after its ON thumb has settled' }).toContain(activeThumb);
    await screen.getByTestId('settings-section-notifications').scrollIntoView();
    await app.screenshot(`settings-${theme}-rituals.png`);
    await screen.getByTestId('settings-notifications-weekday-time').click();
    await expect(screen.getByTestId('settings-notifications-weekday-sheet')).toBeVisible();
    await screen.getByRole('button', { name: 'Terminé', exact: true }).click();
    await expect(screen.getByTestId('settings-notifications-weekday-sheet')).toBeHidden();
    await expect(screen.getByTestId('quota.analysisValue')).toContainText('/ 3');
    for (const id of ['settings-legal-privacy-policy', 'settings-legal-terms-of-use', 'settings-legal-account-deletion', 'settings-legal-contact', 'settings-delete-account']) {
      await expect(screen.getByTestId(id)).toHaveCount(1);
    }
    await expect(screen.getByTestId('settings-legal-contact')).toContainText('Nous écrire');
    await expect(screen.getByTestId('settings-legal-contact')).toContainText('contact@noctalia.app');

    await screen.getByTestId('settings.back').click();
    await screen.getByRole('button', { name: 'Paramètres', exact: true }).click();
    await screen.getByRole('button', { name: /Tous les paramètres/ }).click();
    await expect(reminders).toHaveAttribute('aria-checked', 'true');
    await expect(recap).toHaveAttribute('aria-checked', 'true');
    await chooseTheme(ui, 'auto');
    const systemBackground = theme === 'light' ? 'rgb(3, 4, 13)' : 'rgb(240, 228, 212)';
    await expectCSS(browser, byId('screen.settings'), 'background-color', systemBackground);
    await browser.emulateMedia({ colorScheme: theme });
    await expectCSS(browser, byId('screen.settings'), 'background-color', background);
    const footer = screen.getByTestId('settings-signout-footer');
    await footer.scrollIntoView();
    await browser.evaluate(() => { window.scrollTo({ left: 0 }); return null; });
    await app.screenshot(`settings-${theme}-footer.png`);
    await browser.setViewport({ width: 320, height: 844 });
    const widths = await readDOM(browser, byId('settings-section-notifications'), element => ({ client: element.clientWidth, content: element.scrollWidth }));
    expect(widths.content, 'Reminder content remains within its group at 320px').toBeLessThanOrEqual(widths.client + 1);
    await browser.setViewport({ width: 390, height: 844 });
    await footer.getByTestId('btn.auth.signOut').click();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toHaveCount(1);
    await openSettings(ui);
    await expect(screen.getByTestId('settings-account-open-signin')).toBeVisible();
    await expect(screen.getByTestId('btn.auth.signOut')).toHaveCount(0);
    await expect(screen.getByTestId('settings-delete-account')).toHaveCount(0);
  });
}

test('Settings replays the introduction without reopening a finished onboarding', async (ui) => {
  const { app, screen, browser } = ui;
  await app.open('/');
  await screen.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withExactDialog(browser, 'accept', () => screen.getByTestId('btn.onboarding.feature.close').click());
  }
  await screen.getByTestId('btn.onboarding.skip').click();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toHaveCount(1);
  await openSettings(ui);
  await screen.getByTestId('settings-onboarding-replay').click();
  await expect(screen.getByTestId('component.onboarding.intro')).toBeVisible();
  await screen.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withExactDialog(browser, 'accept', () => screen.getByTestId('btn.onboarding.feature.close').click());
  }
  await expect(screen.getByTestId('component.onboarding.path')).toBeVisible();
  await screen.getByTestId('btn.onboarding.path.memory').click();
  await screen.getByTestId('btn.onboarding.primary').click();
  // The replay returns to Settings instead of starting a capture.
  await expect(screen.getByTestId('screen.settings')).toBeVisible();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toHaveCount(0);
  // The saved onboarding is still finished: a fresh start skips it.
  await app.open('/');
  await expect(screen.getByTestId('screen.recording', { visible: true })).toHaveCount(1);
  await expect(screen.getByTestId('screen.onboarding')).toHaveCount(0);
});
