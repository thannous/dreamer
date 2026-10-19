import { test, type Browser } from '@e2e-dev/web';
import { expect, type App, type Screen } from 'e2e';
import { isolateWeb } from '../web-fixtures';

// Normal regression campaigns register no persona tests and need no model/login.
// The separate opt-in campaign selects only this file, with one worker and no replay.
if (process.env.E2E_PERSONAS === '1') {
  async function startProfile(app: App, screen: Screen, browser: Browser, profile: 'new' | 'existing' | 'plus') {
    await isolateWeb(browser, app);
    await app.open();
    await screen.getByTestId('btn.onboarding.intro.next').tap();
    if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
      const stop = await browser.onDialog('accept');
      try { await screen.getByTestId('btn.onboarding.feature.close', { visible: true }).tap(); }
      finally { stop(); }
    }
    await screen.getByTestId('btn.onboarding.skip').tap();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
    const home = screen.getByTestId('btn.recording.home', { visible: true });
    if (await home.isVisible()) await home.tap();
    else await screen.getByTestId('tab.home', { visible: true }).tap();
    await screen.getByTestId('btn.header.home.settings', { visible: true }).tap();
    await screen.getByTestId('quick-settings.all', { visible: true }).tap();
    await screen.getByTestId('settings-account-open-signin', { visible: true }).tap();
    await screen.getByTestId(`btn.mockProfile.${profile}`, { visible: true }).tap();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  }

  test('a sleepy journaler keeps the exact dream for later without requesting a reading',
    { agent: 'morning', tags: ['personas', 'persona-morning', 'capture'] }, async ({ app, screen, browser, agent }) => {
      await startProfile(app, screen, browser, 'new');
      const story = 'Personas réveil : je marche sur un pont bleu et une luciole se pose sur ma main.';
      await screen.getByTestId('input.dreamTranscript').fill(story);
      await agent.act('Keep the entered dream for later without requesting an AI reading. Finish on its readable dream page.');
      await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
      await expect(screen.getByTestId('component.dreamDetail.readingZone')).toBeHidden();
      await expect(screen.getByTestId('screen.paywall')).toBeHidden();
      await app.screenshot('morning-saved-for-later');
      const back = screen.getByTestId('btn.navigateJournal');
      await back.scrollIntoView();
      await back.tap();
      await screen.getByTestId('input.searchDreams').fill('Personas réveil');
      const entry = screen.getByTestId(/^dream\.item\./);
      await expect(entry).toHaveCount(1);
      await entry.tap();
      await screen.getByTestId('btn.editDream').tap();
      await expect(screen.getByTestId('input.dreamTranscript')).toHaveValue(story);
    });

  test('a regular journaler retrieves an older dream and finds it again in favourites',
    { agent: 'archivist', tags: ['personas', 'persona-archivist', 'journal'] }, async ({ app, screen, browser, agent }) => {
      await startProfile(app, screen, browser, 'existing');
      await agent.act('Find and open your older dream about a garden floating among the clouds.');
      await expect(screen.getByText('Garden in the Clouds', { exact: true })).toBeVisible();
      const transcript = screen.getByTestId('component.transcriptCard');
      await expect(transcript).toContainText(/\S[\s\S]{30}/);
      const originalStory = await transcript.textContent();
      if (!originalStory) throw new Error('The retrieved dream has no readable story.');
      // This fixture starts without a favourite; an unchanged state cannot pass.
      await expect(screen.getByTestId('btn.dream.favorite')).toContainText('Favori');
      await agent.act('Add this dream to your favourites so you can find it again later.');
      await expect(screen.getByTestId('btn.dream.favorite')).toContainText('Ajouté aux favoris');
      const back = screen.getByTestId('btn.navigateJournal');
      await back.scrollIntoView();
      await back.tap();
      await screen.getByRole('button', 'Afficher uniquement les favoris', { exact: true }).tap();
      await screen.getByTestId('input.searchDreams').fill('Garden in the Clouds');
      const entry = screen.getByTestId(/^dream\.item\./);
      await expect(entry).toHaveCount(1);
      await entry.tap();
      await expect(screen.getByText('Garden in the Clouds', { exact: true })).toBeVisible();
      await expect(transcript).toHaveText(originalStory);
      await app.screenshot('archivist-favourite-reopened');
    });

  test('a reflective Plus user revisits the same dream conversation without duplicating it',
    { agent: 'explorer', tags: ['personas', 'persona-explorer', 'reflection'] }, async ({ app, screen, browser, agent }) => {
      await startProfile(app, screen, browser, 'plus');
      await agent.act('Open a free-form conversation about your older dream titled The Infinite Library.');
      const title = screen.getByText('The Infinite Library', { exact: true });
      await title.scrollIntoView();
      await expect(title).toBeVisible();
      const input = screen.getByTestId('chat.input.message');
      await expect(input).toBeEnabled();
      await expect(input).not.toHaveAttribute('readonly');
      const question = 'Personas réflexion : pourquoi cette bibliothèque semblait-elle si familière ?';
      await input.fill(question);
      await screen.getByTestId('chat.button.send').tap();
      const latest = screen.getByRole('button', 'Jump to latest', { exact: true });
      if (await latest.isVisible()) await latest.tap();
      await expect(screen.getByText(question, { exact: true })).toBeVisible();
      const answer = screen.getByText(/^(That's an interesting question|Based on your dream,|Dreams like yours often|The elements you mentioned|I sense that this dream)/);
      await expect(answer).toBeVisible();
      const response = await answer.textContent();
      if (!response) throw new Error('The conversation has no readable assistant reply.');
      await expect(screen.getByTestId('chat.loading')).toBeHidden();
      await expect(input).toBeEnabled();
      await expect(input).not.toHaveAttribute('readonly');
      // Go back to the journal through exact navigation; the next goal discovers
      // how to reach that same discussion again, with no new message requested.
      await screen.getByRole('button', 'Retour', { exact: true }).tap();
      await screen.getByRole('button', 'Retour', { exact: true }).tap();
      const back = screen.getByTestId('btn.navigateJournal');
      await back.scrollIntoView();
      await back.tap();
      await agent.act('Return to the same free-form conversation about The Infinite Library. Do not send another message.');
      await title.scrollIntoView();
      await expect(title).toBeVisible();
      if (await latest.isVisible()) await latest.tap();
      await expect(screen.getByText(question, { exact: true })).toHaveCount(1);
      await expect(screen.getByText(response, { exact: true })).toBeVisible();
      await expect(input).toBeEnabled();
      await expect(input).not.toHaveAttribute('readonly');
      await app.screenshot('explorer-conversation-revisited');
    });

  test('a free user can decline the Plus offer without losing the saved dream',
    { agent: 'free', tags: ['personas', 'persona-free', 'quota'] }, async ({ app, screen, browser, agent }) => {
      await startProfile(app, screen, browser, 'existing');
      const story = 'Personas gratuit : un phare turquoise éclaire la mer et je compte les bateaux.';
      await screen.getByTestId('input.dreamTranscript').fill(story);
      await screen.getByTestId('btn.saveDream').tap();
      await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
      await agent.act('Find the offer that explains how you could obtain an AI reading for this saved dream. Do not subscribe.');
      await expect(screen.getByTestId('screen.paywall')).toBeVisible();
      await agent.act('Return to your saved dream without subscribing or making a purchase.');
      await expect(screen.getByTestId('screen.paywall')).toBeHidden();
      await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
      await expect(screen.getByTestId('component.dreamDetail.readingZone')).toBeHidden();
      await app.screenshot('free-dream-preserved-after-offer');
      // Closing the offer after an accidental mock purchase must not pass.
      const back = screen.getByTestId('btn.navigateJournal');
      await back.scrollIntoView();
      await back.tap();
      await screen.getByTestId('tab.home', { visible: true }).tap();
      await screen.getByTestId('btn.header.home.settings', { visible: true }).tap();
      await screen.getByTestId('quick-settings.all', { visible: true }).tap();
      await expect(screen.getByTestId('quota.analysisValue')).toHaveText('5 / 3');
      if (!await screen.getByTestId('text.subscription.qa.mode').isVisible()) {
        await screen.getByTestId('screen.subscription.qaLab.toggle').tap();
      }
      await expect(screen.getByTestId('text.subscription.qa.purchaseCalls')).toHaveText('0');
      await expect(screen.getByTestId('text.subscription.qa.restoreCalls')).toHaveText('0');
    });
}
