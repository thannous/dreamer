// The release notes shown once after an update: what the version brings, a way into the
// journal and a way to read them later. The mock keeps nothing between launches, so the QA
// lab opens them as a returning reader would find them (replayReleaseNotesForQa).
import type { Page } from 'playwright/test';
import { createParityTest, expect, leaveOnboarding, signInFromToday } from '../web-parity-fixtures';
const test = createParityTest({ tags: ['zone-accueil'] });

const card = (page: Page) => page.getByTestId('component.whatsNew.card').filter({ visible: true });

async function openReleaseNotes(page: Page) {
  await page.goto('/');
  await leaveOnboarding(page);
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await signInFromToday(page, 'existing');
  await page.getByTestId('tab.settings').filter({ visible: true }).click();
  await page.getByTestId('screen.subscription.qaLab.toggle').click();
  await page.getByTestId('btn.subscription.qa.releaseNotes').click();
  await expect(card(page)).toHaveCount(1);
}

test('the release notes name the version and what it brings, and "Later" closes them where the reader was', async ({ page }) => {
  await openReleaseNotes(page);
  await expect(card(page).getByRole('heading')).toHaveText(/^Noctalia \d+\.\d+ is here$/);
  await expect(card(page)).toContainText(/WHAT'S NEW · \d+\.\d+\.\d+/i);
  await expect(card(page)).toContainText('Your dreams in pictures');
  await expect(card(page)).toContainText('Cards to earn');
  // The widgets exist only on iPhone: a browser is not told about them.
  await expect(card(page)).not.toContainText(/widget/i);
  await page.getByTestId('btn.whatsNew.later').click();
  await expect(card(page)).toHaveCount(0);
  await expect(page.getByTestId('screen.settings').filter({ visible: true })).toHaveCount(1);
});

test('the release notes open the journal from their main button', async ({ page }) => {
  await openReleaseNotes(page);
  await expect(page.getByTestId('btn.whatsNew.primary')).toContainText('See my journal');
  await page.getByTestId('btn.whatsNew.primary').click();
  await expect(card(page)).toHaveCount(0);
  await expect(page.getByTestId('screen.journal').filter({ visible: true })).toHaveCount(1);
});

test('the cross closes the release notes', async ({ page }) => {
  await openReleaseNotes(page);
  await page.getByTestId('btn.whatsNew.close').click();
  await expect(card(page)).toHaveCount(0);
});
