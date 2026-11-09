import type { Browser } from '@e2e-dev/web';
import { expect, type App, type Screen } from 'e2e';
import { isolateWeb } from './web-fixtures';

type Fixtures = { app: App; screen: Screen; browser: Browser };

/** The screen must be mounted and its visual startup cover gone before a journey acts. */
export async function waitForLucidReady(browser: Browser) {
  await expect(browser.locator('[data-testid^="lucid-"]:visible, [role="heading"]:visible').first()).toBeVisible();
  // This existing SVG definition belongs only to StartupSplashScreen.web.
  // The cover ignores pointer events, so DOM visibility alone cannot prove readiness.
  await expect(browser.locator('#splashCyanGlow')).toHaveCount(0);
}

export async function openLucid(app: App, browser: Browser, path?: string) {
  await app.open(path);
  await waitForLucidReady(browser);
}

async function frenchGuest({ app, browser }: Fixtures) {
  await isolateWeb(browser, app);
  await openLucid(app, browser, '/lucid/onboarding?ambience=light');
}

export async function completeOnboarding(fixtures: Fixtures, checkContrast = false) {
  const { app, screen, browser } = fixtures;
  await frenchGuest(fixtures);
  await screen.getByTestId('lucid-goal-improve_recall', { visible: true }).tap();
  await screen.getByTestId('lucid-experience-beginner', { visible: true }).tap();
  const next = screen.getByTestId('lucid-onboarding-continue', { visible: true });
  await next.tap();
  await openLucid(app, browser, '/lucid/onboarding?ambience=dark');
  await expect(screen.getByTestId('lucid-sleep-bedtime', { visible: true })).toBeVisible();
  for (const [id, value] of [['lucid-sleep-bedtime', '21:45'], ['lucid-sleep-wake-time', '06:15']]) {
    const control = screen.getByTestId(id, { visible: true });
    await control.tap();
    const input = browser.locator('input[type="time"]');
    await expect(input).toBeVisible();
    if (checkContrast) {
      const result = await browser.evaluate(() => {
        const input = document.querySelector<HTMLInputElement>('input[type="time"]')!;
        const style = getComputedStyle(input);
        let parent = input.parentElement;
        while (parent && getComputedStyle(parent).backgroundColor === 'rgba(0, 0, 0, 0)') parent = parent.parentElement;
        const luminance = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3)
          .map(v => Number(v) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
          .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
        const a = luminance(style.color), b = luminance(getComputedStyle(parent!).backgroundColor);
        return { scheme: style.colorScheme, contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
      });
      expect(result.scheme).toBe('dark');
      expect(result.contrast).toBeGreaterThanOrEqual(4.5);
      await app.screenshot(`${id}-readable-dark`);
    }
    await input.fill(value);
    await screen.getByRole('button', 'Terminé', { visible: true }).tap();
    await expect(control).toContainText(value);
  }
  await screen.getByTestId('lucid-wake-sensitivity-not_sensitive', { visible: true }).tap();
  await next.tap();
  await expect(screen.getByTestId('lucid-onboarding-plan', { visible: true })).toBeVisible();
  await next.tap();
  await expect(screen.getByTestId('lucid-onboarding-local-first', { visible: true })).toBeVisible();
  await next.tap();
  await expect(screen.getByRole('tab', 'Journal', { visible: true })).toBeVisible();
}
