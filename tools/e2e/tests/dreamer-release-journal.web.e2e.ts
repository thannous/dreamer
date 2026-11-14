import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { isolateWeb } from '../web-fixtures';
import { journal, openSettings, selectProfile } from '../dreamer-release-fixtures';

// The journal's own journeys (save and rename, edit and delete, favorites, the declined analysis
// offer) run on every pull request in dreamer-journeys.web.e2e.ts; the release campaign plays that
// file too, so they are not repeated here.
for (const profile of ['existing', 'plus'] as const) {
  test(`${profile} account allowance and sign-out preserve account isolation`, async ({ app, screen, browser }) => {
    await isolateWeb(browser, app);
    await selectProfile(app, screen, browser, profile);
    await openSettings(screen);
    // The fixture keeps five completed analyses; displayed free usage caps at its allowance.
    await expect(screen.getByTestId('quota.analysisValue', { visible: true })).toHaveText(profile === 'plus' ? 'Unlimited' : '3 / 3');
    if (profile === 'existing') {
      await screen.getByTestId('settings-section-subscription', { visible: true }).tap();
      // Signed in, the offer can be bought and restored here: no sign-in reason is shown.
      await expect(screen.getByTestId('btn.paywall.restore', { visible: true })).toBeVisible();
      await expect(screen.getByTestId('text.paywall.authReason')).toHaveCount(0);
      await screen.getByTestId('btn.paywall.selectMonthly', { visible: true }).tap();
      await expect(screen.getByTestId('btn.paywall.selectMonthly', { visible: true })).toHaveAttribute('aria-checked', 'true');
      await screen.getByTestId('btn.paywall.close', { visible: true }).tap();
    }
    await screen.getByTestId('btn.auth.signOut', { visible: true }).tap();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
    await openSettings(screen);
    await expect(screen.getByTestId('settings-account-open-signin', { visible: true })).toBeVisible();
    await expect(screen.getByTestId('btn.auth.signOut')).toHaveCount(0);
    await screen.getByTestId('settings.back', { visible: true }).tap();
    // journal() branches on a one-shot isVisible(); wait for Today before it reads.
    await expect(screen.getByTestId('screen.home', { visible: true })).toBeVisible();
    await journal(screen);
    await expect(screen.getByTestId('journal-first-page', { visible: true })).toBeVisible();
    await expect(screen.getByTestId(/^dream\.item\./, { visible: true })).toHaveCount(0);
    await app.screenshot(`${profile}-signout-isolates-journal`);
  });
}
