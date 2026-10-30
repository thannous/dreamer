import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { isolateWeb } from '../web-fixtures';

// Explore restores these sessions; preparation never consumes model calls.
for (const profile of ['guest', 'seeded', 'draft'] as const) {
  test.setup(`prepare synthetic bug bash ${profile}`, { sessions: [`bugbash-${profile}`] }, async ({ app, screen, browser, session }) => {
    await isolateWeb(browser, app);
    await app.open();
    await screen.getByTestId('btn.onboarding.intro.next').tap();
    await screen.getByTestId('btn.onboarding.skip').tap();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
    if (profile === 'seeded') {
      const home = screen.getByTestId('btn.recording.home', { visible: true });
      if (await home.isVisible()) await home.tap();
      else await screen.getByTestId('tab.home', { visible: true }).tap();
      await screen.getByTestId('btn.header.home.settings').tap();
      await screen.getByTestId('quick-settings.all').tap();
      await screen.getByTestId('settings-account-open-signin').tap();
      await screen.getByTestId('btn.mockProfile.existing').tap();
      await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
      // The preload itself is in memory too. A real journal edit commits the
      // fixture through mock persistence before the portable session is saved.
      await screen.getByTestId('tab.journal', { visible: true }).tap();
      await screen.getByTestId(/^dream\.item\./, { visible: true }).first().tap();
      await screen.getByTestId('btn.dream.favorite', { visible: true }).tap();
      await expect.poll(() => browser.evaluate(() => JSON.parse(localStorage.getItem(
        'noctalia_mock_dogfood_v1:gemini_dream_journal_dreams',
      ) ?? '[]').length)).toBeGreaterThan(1);
      // mockAuth deliberately keeps the account in memory. A portable browser
      // session retains its synthetic journal, not its signed-in identity.
      // Verify the state that Explore will actually restore, before saving it.
      await browser.reload();
      await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
      await screen.getByTestId('tab.journal', { visible: true }).tap();
      await expect.poll(() => screen.getByTestId(/^dream\.item\./, { visible: true }).count()).toBeGreaterThan(1);
      await screen.getByTestId('tab.home', { visible: true }).tap();
      await screen.getByTestId('btn.header.home.settings').tap();
      await screen.getByTestId('quick-settings.all').tap();
      await expect(screen.getByTestId('settings-account-open-signin', { visible: true })).toBeVisible();
    }
    if (profile === 'draft') {
      const story = 'Bugbash recovery: a glass bird waits beside a blue lighthouse.';
      await screen.getByTestId('input.dreamTranscript').fill(story);
      await expect.poll(() => browser.evaluate(() => localStorage.getItem(
        'noctalia_mock_dogfood_v1:gemini_dream_journal_recording_transcript:guest',
      ))).toBe(story);
    }
    await session.save(`bugbash-${profile}`);
  });
}
