import { test, type Device } from '@e2e-dev/mobile';
import { expect, type TestFixtures } from 'e2e';

type NativeFixtures = TestFixtures & { device: Device };

// These are usage goals on real native UI. Account data, AI replies and billing
// are synthetic; run.mjs requires an owned emulator/Simulator and Release receipt.
// Ordinary native regressions register none of these model-driven journeys.
if (process.env.E2E_PERSONAS === '1') {
  async function tap(screen: NativeFixtures['screen'], id: string, direction: 'up' | 'down' = 'down') {
    const target = screen.getByTestId(id, { visible: true });
    await screen.scrollUntilVisible(target, { direction });
    await target.tap();
  }

  async function home(screen: NativeFixtures['screen']) {
    const recordingHome = screen.getByTestId('btn.recording.home', { visible: true });
    if (await recordingHome.isVisible()) await recordingHome.tap();
    else await screen.getByTestId('tab.home', { visible: true }).tap();
    await expect(screen.getByTestId('screen.home', { visible: true })).toBeVisible();
  }

  async function settings(screen: NativeFixtures['screen']) {
    await home(screen);
    await screen.getByTestId('btn.header.home.settings', { visible: true }).tap();
    await tap(screen, 'quick-settings.all');
    await expect(screen.getByTestId('screen.settings', { visible: true })).toBeVisible();
  }

  async function startProfile({ app, screen, platform }: NativeFixtures, profile: 'new' | 'existing' | 'plus') {
    await app.open(); // First recorded action on each owned native target.
    if (process.env.E2E_NATIVE_MOCK_MODE !== 'true' || process.env.E2E_NATIVE_MOCK_PERSISTENCE !== 'true')
      throw new Error('Personas may reset only the identified persistent mock QA app.');
    await app.clearState();
    await tap(screen, 'btn.onboarding.intro.next');
    if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
      await tap(screen, 'btn.onboarding.feature.close');
      await screen.getByRole('button', /^(Quitter|Leave|Sair|Salir|Esci|Verlassen)$/, { visible: true }).tap();
    }
    await tap(screen, 'btn.onboarding.skip');
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
    await home(screen);
    await screen.getByTestId('btn.header.home.settings', { visible: true }).tap();
    await tap(screen, 'quick-settings.language');
    await tap(screen, 'quick-settings.language.fr');
    if (platform === 'android') {
      // UI language applies before the optional speech-pack check finishes.
      // Poll that UI condition briefly; installed packs produce no sheet.
      const pack = screen.getByText('Pack de langue pour la reconnaissance vocale', { visible: true });
      const deadline = Date.now() + 3_000;
      let offered = await pack.isVisible();
      while (!offered && Date.now() < deadline) offered = await pack.isVisible();
      if (offered) {
        await screen.getByRole('button', 'Annuler', { exact: true, visible: true }).tap();
        await expect(pack).toBeHidden();
      }
    }
    await expect(screen.getByRole('radio', 'Français', { visible: true })).toBeChecked();
    await tap(screen, 'quick-settings.all');
    await expect(screen.getByTestId('screen.settings', { visible: true })).toBeVisible();
    await tap(screen, 'settings-account-open-signin', 'up');
    await tap(screen, `btn.mockProfile.${profile}`);
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  }

  async function enterStory({ screen, device }: NativeFixtures, story: string) {
    await tap(screen, 'btn.recording.inputMode.text');
    await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
    await device.dismissKeyboard();
  }

  async function readableStory(screen: NativeFixtures['screen'], story: string) {
    // Native accessibility exposes the story's Text, not a DOM subtree on its View.
    const prose = screen.getByText(story, { exact: true, visible: true });
    await screen.scrollUntilVisible(prose);
    await expect(prose).toBeVisible();
  }

  async function openSearchResult({ screen, device, platform }: NativeFixtures, query: string) {
    const search = screen.getByTestId('input.searchDreams', { visible: true });
    await search.fill(query);
    if (platform === 'ios') await search.press('Enter');
    else await device.dismissKeyboard();
    await expect(search).toHaveValue(query);
    const entry = screen.getByTestId(/^dream\.item\./, { visible: true });
    await expect(entry).toHaveCount(1);
    await entry.tap();
  }

  test('a sleepy journaler keeps the exact dream for later without requesting a reading',
    { agent: 'morning', tags: ['personas', 'persona-morning', 'capture'] }, async (fixtures) => {
      const { app, screen, agent } = fixtures;
      await startProfile(fixtures, 'new');
      const story = 'Personas réveil : je marche sur un pont bleu et une luciole se pose sur ma main.';
      await enterStory(fixtures, story);
      await agent.act('Keep the entered dream for later without requesting an AI reading. Finish on its readable dream page.');
      await readableStory(screen, story);
      await expect(screen.getByTestId('component.dreamDetail.readingZone')).toBeHidden();
      await expect(screen.getByTestId('screen.paywall')).toBeHidden();
      await app.screenshot('morning-saved-for-later');
      await tap(screen, 'btn.navigateJournal', 'up');
      await openSearchResult(fixtures, 'Personas réveil');
      // AX can list a partially covered footer as hittable. The default gesture
      // starts on the fixed panel on iOS; drag inside the measured reading area.
      const page = screen.getByTestId('screen.dreamDetail', { visible: true });
      await expect(page).toBeVisible();
      const bounds = await page.boundingBox();
      const dock = await screen.getByTestId('component.dreamDetail.actionDock', { visible: true }).boundingBox();
      if (!bounds || !dock) throw new Error('The dream reading area is unavailable.');
      const x = bounds.x + bounds.width / 2;
      await screen.swipe({ from: { x, y: dock.y - 32 },
        to: { x, y: bounds.y + bounds.height / 4 }, duration: 350 });
      await tap(screen, 'btn.editDream');
      const editor = screen.getByTestId('input.dreamTranscript', { visible: true });
      await screen.scrollUntilVisible(editor, { direction: 'up' });
      await expect(editor).toHaveValue(story);
    });

  test('a regular journaler retrieves an older dream and finds it again in favourites',
    { agent: 'archivist', tags: ['personas', 'persona-archivist', 'journal'] }, async (fixtures) => {
      const { app, screen, agent } = fixtures;
      await startProfile(fixtures, 'existing');
      await agent.act('Find and open your older dream about a garden floating among the clouds.');
      const title = screen.getByText('Garden in the Clouds', { exact: true, visible: true });
      await screen.scrollUntilVisible(title, { direction: 'up' });
      await expect(title).toBeVisible();
      const transcript = screen.getByText(/^I was walking through a beautiful garden floating among the clouds\./, { visible: true });
      await screen.scrollUntilVisible(transcript);
      const originalStory = await transcript.textContent();
      if (!originalStory || originalStory.length < 30) throw new Error('The retrieved dream has no readable story.');
      // This exact fixture starts outside favourites. Finding it in the filtered
      // Journal after the goal proves a change even if native AX hides icon state.
      await agent.act('Add this dream to your favourites so you can find it again later. Finish on this dream page.');
      await tap(screen, 'btn.navigateJournal', 'up');
      await screen.getByRole('button', 'Afficher uniquement les favoris', { exact: true, visible: true }).tap();
      await openSearchResult(fixtures, 'Garden in the Clouds');
      await screen.scrollUntilVisible(title, { direction: 'up' });
      await expect(title).toBeVisible();
      await readableStory(screen, originalStory);
      await app.screenshot('archivist-favourite-reopened');
    });

  test('a reflective Plus user revisits the same dream conversation without duplicating it',
    { agent: 'explorer', tags: ['personas', 'persona-explorer', 'reflection'] }, async (fixtures) => {
      const { app, screen, agent, device, platform } = fixtures;
      await startProfile(fixtures, 'plus');
      await agent.act('Open a free-form conversation about your older dream titled The Infinite Library.');
      const title = screen.getByText('The Infinite Library', { exact: true, visible: true });
      await screen.scrollUntilVisible(title, { direction: 'up' });
      await expect(title).toBeVisible();
      const input = screen.getByTestId('chat.input.message', { visible: true });
      await expect(input).toBeEnabled();
      const question = 'Personas réflexion : pourquoi cette bibliothèque semblait-elle si familière ?';
      await input.fill(question);
      // The iPhone composer keeps its keyboard open; Send remains reachable.
      if (platform === 'android') await device.dismissKeyboard();
      await tap(screen, 'chat.button.send');
      // Native Alert is visible UI, unlike the browser's dialog callback.
      await expect(screen.getByText(/Anthropic \(Claude\).*Google \(Gemini\)/, { visible: true })).toBeVisible();
      const consent = screen.getByRole('button', /^Accepter et continuer$/i, { visible: true });
      await consent.tap();
      await expect(consent).toHaveCount(0);
      const savedQuestion = screen.getByText(question, { exact: true, visible: true });
      await expect(savedQuestion).toBeVisible();
      const latest = screen.getByRole('button', 'Jump to latest', { exact: true, visible: true });
      if (await latest.isVisible()) await latest.tap();
      const answer = screen.getByText(/^(That's an interesting question|Based on your dream,|Dreams like yours often|The elements you mentioned|I sense that this dream)/, { visible: true });
      await expect(answer).toBeVisible();
      await expect(screen.getByTestId('chat.loading')).toBeHidden();
      await expect(input).toBeEnabled();
      const response = await answer.textContent();
      if (!response) throw new Error('The conversation has no readable assistant reply.');
      await screen.getByRole('button', 'Retour', { exact: true, visible: true }).tap();
      await screen.getByRole('button', 'Retour', { exact: true, visible: true }).tap();
      await tap(screen, 'btn.navigateJournal', 'up');
      await agent.act('Reopen your existing conversation about The Infinite Library, with the earlier question and reply on screen. Do not send another message.');
      await screen.scrollUntilVisible(title, { direction: 'up' });
      await expect(title).toBeVisible();
      if (await latest.isVisible()) await latest.tap();
      await expect(savedQuestion).toHaveCount(1);
      await expect(screen.getByText(response, { exact: true, visible: true })).toBeVisible();
      // A native input being enabled alone does not prove that it is editable.
      const draft = 'Brouillon non envoyé après reprise';
      await input.fill(draft);
      await expect(input).toHaveValue(draft);
      await input.fill('');
      await expect(input).toHaveValue('');
      if (platform === 'android') await device.dismissKeyboard();
      await app.screenshot('explorer-conversation-revisited');
    });

  test('a free user can decline the Plus offer without losing the saved dream',
    { agent: 'free', tags: ['personas', 'persona-free', 'quota'] }, async (fixtures) => {
      const { app, screen, agent, platform } = fixtures;
      await startProfile(fixtures, 'existing');
      const story = 'Personas gratuit : un phare turquoise éclaire la mer et je compte les bateaux.';
      await enterStory(fixtures, story);
      await tap(screen, 'btn.saveDream');
      await readableStory(screen, story);
      await agent.act('Find the offer that explains how you could obtain an AI reading for this saved dream. Do not subscribe.');
      await expect(screen.getByTestId('screen.paywall', { visible: true })).toBeVisible();
      await agent.act('Return to your saved dream without subscribing or making a purchase.');
      await expect(screen.getByTestId('screen.paywall')).toBeHidden();
      await readableStory(screen, story);
      await expect(screen.getByTestId('component.dreamDetail.readingZone')).toBeHidden();
      await app.screenshot('free-dream-preserved-after-offer');
      await tap(screen, 'btn.navigateJournal', 'up');
      await settings(screen);
      const quota = screen.getByTestId('quota.analysisValue', { visible: true });
      await screen.scrollUntilVisible(quota);
      await expect(quota).toHaveText(/^(?:Analyses offertes: )?3 \/ 3$/);
      const toggle = screen.getByTestId('screen.subscription.qaLab.toggle', { visible: true });
      await screen.scrollUntilVisible(toggle);
      // Android does not expose RN's expanded value; Settings just opened with
      // the QA panel collapsed. iOS exposes that state as an accessibility value.
      if (platform === 'android' || await toggle.inputValue() !== 'expanded') await toggle.tap();
      for (const id of ['purchaseCalls', 'restoreCalls']) {
        const count = screen.getByTestId(`text.subscription.qa.${id}`, { visible: true });
        await screen.scrollUntilVisible(count);
        await expect(count).toHaveText('0');
      }
    });
}
