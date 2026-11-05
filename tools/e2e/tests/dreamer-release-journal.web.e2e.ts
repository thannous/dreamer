import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { isolateWeb } from '../web-fixtures';
import { journal, openDream, openSettings, selectProfile } from '../dreamer-release-fixtures';

test('free user saves, renames and finds the exact story in Journal', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await selectProfile(app, screen, browser, 'existing');
  const story = 'E2E sapphire lighthouse above the quiet ocean.';
  await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
  await screen.getByTestId('btn.saveDream', { visible: true }).tap();
  await expect(screen.getByTestId('component.transcriptCard', { visible: true })).toContainText(story);
  await screen.getByTestId('btn.editDream', { visible: true }).tap();
  await screen.getByTestId('input.dreamTitle', { visible: true }).fill('E2E sapphire lighthouse');
  await screen.getByTestId('btn.saveDreamEdit', { visible: true }).tap();
  await journal(screen);
  await openDream(screen, 'E2E sapphire lighthouse');
  await expect(screen.getByTestId('component.transcriptCard', { visible: true })).toContainText(story);
  await app.screenshot('saved-story-found-in-journal');
});

test('free user recovers empty search, edits, cancels deletion and deletes only one dream', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await selectProfile(app, screen, browser, 'existing');
  await journal(screen);
  const search = screen.getByRole('textbox', 'Search dreams…', { visible: true });
  await search.fill('E2E no such dream 93f82');
  await expect(screen.getByTestId(/^dream\.item\./, { visible: true })).toHaveCount(0);
  await openDream(screen, 'The Infinite Library');
  const story = 'E2E revised story: the library has a blue door.';
  await screen.getByTestId('btn.editDream', { visible: true }).tap();
  await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
  await screen.getByTestId('btn.saveDreamEdit', { visible: true }).tap();
  await expect(screen.getByTestId('component.transcriptCard', { visible: true })).toContainText(story);
  await screen.getByTestId('btn.dream.delete', { visible: true }).tap();
  await screen.getByRole('button', 'Cancel', { visible: true }).tap();
  await expect(screen.getByTestId('component.transcriptCard', { visible: true })).toContainText(story);
  await screen.getByTestId('btn.dream.delete', { visible: true }).tap();
  await screen.getByRole('button', 'Delete', { visible: true }).tap();
  await expect(screen.getByTestId('screen.journal', { visible: true })).toHaveCount(1);
  await search.fill('The Infinite Library');
  await expect(screen.getByTestId(/^dream\.item\./, { visible: true })).toHaveCount(0);
  await search.fill('Ocean of Stars');
  await expect(screen.getByTestId(/^dream\.item\./, { visible: true })).toHaveCount(1);
  await app.screenshot('deletion-preserves-other-dream');
});

test('free user adds and removes a favorite without deleting its story', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await selectProfile(app, screen, browser, 'existing');
  await journal(screen);
  await openDream(screen, 'Garden in the Clouds');
  const transcript = screen.getByTestId('component.transcriptCard', { visible: true });
  const originalStory = await transcript.textContent();
  expect(originalStory).toContain('I was walking through a beautiful garden');
  await screen.getByTestId('btn.dream.favorite', { visible: true }).tap();
  await journal(screen);
  await screen.getByRole('button', 'Show favorites only', { visible: true }).tap();
  await openDream(screen, 'Garden in the Clouds');
  await screen.getByTestId('btn.dream.favorite', { visible: true }).tap();
  await journal(screen);
  // Upstream 02a97ad08 retains the journal: a second Favorites tap would clear its filter.
  await expect(screen.getByRole('textbox', 'Search dreams…', { visible: true })).toHaveValue('Garden in the Clouds');
  await expect(screen.getByTestId(/^dream\.item\./, { visible: true })).toHaveCount(0);
  await screen.getByRole('button', 'Show all dreams', { visible: true }).tap();
  await openDream(screen, 'Garden in the Clouds');
  await expect(transcript).toHaveText(originalStory!);
  await app.screenshot('favorite-removal-keeps-story');
});

test('exhausted free account keeps its story when declining the analysis offer', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await selectProfile(app, screen, browser, 'existing');
  const story = 'E2E saved even when my analysis allowance is exhausted.';
  await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
  await screen.getByTestId('btn.saveDream', { visible: true }).tap();
  await expect(screen.getByTestId('component.transcriptCard', { visible: true })).toContainText(story);
  await screen.getByTestId('btn.dream.primaryCta', { visible: true }).tap();
  await expect(screen.getByTestId('screen.paywall', { visible: true })).toBeVisible();
  await screen.getByTestId('btn.paywall.close', { visible: true }).tap();
  await expect(screen.getByTestId('component.transcriptCard', { visible: true })).toContainText(story);
  await expect(screen.getByRole('button', 'Read the full analysis', { visible: true })).toHaveCount(0);
  await app.screenshot('quota-decline-preserves-story');
});

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
