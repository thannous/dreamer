import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { completeOnboarding, openLucid } from '../lucid-web-fixtures';
import { isolateWeb } from '../web-fixtures';

test('Lucid requires intention and experience before opening sleep settings', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await openLucid(app, browser);
  const next = screen.getByRole('button', 'Continuer', { exact: true });
  await expect(next).toBeDisabled();
  await screen.getByTestId('lucid-goal-improve_recall', { visible: true }).tap();
  await screen.getByTestId('lucid-experience-beginner', { visible: true }).tap();
  await expect(next).toBeEnabled();
  await next.tap();
  await expect(screen.getByTestId('lucid-sleep-bedtime', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('lucid-sleep-wake-time', { visible: true })).toBeVisible();
  await app.screenshot('sleep-settings');
});

// Night and Settings are tabs without a button. Expo Router 58 sent every visit
// to them back to Today, so the profile button, the Night shortcut and the
// Night link did nothing.
test('Lucid opens Night and Settings from Today and from a link', async fixtures => {
  await completeOnboarding(fixtures);
  const { app, screen, browser } = fixtures;
  await openLucid(app, browser, '/lucid?ambience=dark');
  // Night and Settings take no slot either: the four visible tabs share the bar.
  await expect(screen.getByRole('tab', /.*/, { visible: true })).toHaveCount(4);
  const share = await browser.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    // Each tab sits in its slot; the slots share one row.
    const row = tabs[0].parentElement!.parentElement!.getBoundingClientRect().width;
    return tabs.reduce((sum, tab) => sum + tab.getBoundingClientRect().width, 0) / row;
  });
  expect(share).toBeGreaterThan(0.95);
  await screen.getByTestId('lucid-tab-settings', { visible: true }).tap();
  await expect(screen.getByTestId('lucid-settings', { visible: true })).toBeVisible();
  await expect(screen.getByRole('tab', /.*/, { visible: true })).toHaveCount(4);
  await openLucid(app, browser, '/lucid?ambience=dark');
  await screen.getByTestId('lucid-tab-night', { visible: true }).tap();
  await expect(screen.getByTestId('lucid-night', { visible: true })).toBeVisible();
  await openLucid(app, browser, '/lucid/night?ambience=dark');
  await expect(screen.getByTestId('lucid-night', { visible: true })).toBeVisible();
  expect(await browser.evaluate(() => location.pathname)).toBe('/lucid/night');
  await app.screenshot('lucid-night-from-link');
});

test('Lucid completes a stabilization practice once and preserves its progress after restart', { tags: ['practice', 'persistence'] }, async fixtures => {
  await completeOnboarding(fixtures);
  const { app, screen, browser } = fixtures;
  const revealMetrics = async () => {
    await browser.evaluate(() => {
      const card = document.querySelector('[data-testid="lucid-progress-stabilization"]');
      if (!card) throw new Error('The stabilization progress card is missing');
      card.scrollIntoView({ block: 'center' });
      return null;
    });
    await expect.poll(() => browser.evaluate(() => {
      const card = document.querySelector('[data-testid="lucid-progress-stabilization"]');
      const box = card?.getBoundingClientRect();
      return !!box && box.top >= 0 && box.bottom <= innerHeight;
    })).toBe(true);
  };
  await openLucid(app, browser, '/lucid/stabilization-lab?ambience=dark');
  const primary = screen.getByTestId('lucid-stabilization-lab-primary', { visible: true });
  await primary.tap();
  await screen.getByTestId('lucid-stabilization-lab-repeat', { visible: true }).tap();
  await expect(screen.getByTestId('lucid-stabilization-lab-step')).toContainText('1 répétition');
  for (let step = 1; step <= 5; step++) {
    await expect(screen.getByRole('progressbar', `Étape ${step} sur 5`, { visible: true })).toBeVisible();
    await primary.tap();
  }
  await expect(primary).toContainText('Terminer le laboratoire');
  await primary.tap();
  await expect(screen.getByTestId('lucid-stabilization-lab-live')).toContainText('Pratique terminée');
  await app.restart();
  await openLucid(app, browser, '/lucid/progress?ambience=dark');
  await revealMetrics();
  await expect(screen.getByTestId('lucid-progress-stabilization-practices', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('lucid-progress-stabilization-practices')).toHaveAccessibleName('Pratiques: 1');
  await expect(screen.getByTestId('lucid-progress-stabilization-completions')).toHaveAccessibleName('Complétions: 1');
  await expect(screen.getByTestId('lucid-progress-stabilization-practices').getByText('1', { exact: true })).toHaveCount(1);
  await expect(screen.getByTestId('lucid-progress-stabilization-completions').getByText('1', { exact: true })).toHaveCount(1);
  // A second restart must not record another completion.
  await app.restart();
  await openLucid(app, browser, '/lucid/progress?ambience=dark');
  await revealMetrics();
  await expect(screen.getByTestId('lucid-progress-stabilization-practices', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('lucid-progress-stabilization-practices').getByText('1', { exact: true })).toHaveCount(1);
  await expect(screen.getByTestId('lucid-progress-stabilization-completions').getByText('1', { exact: true })).toHaveCount(1);
  await app.screenshot('completed-practice-survives-two-restarts');
});
