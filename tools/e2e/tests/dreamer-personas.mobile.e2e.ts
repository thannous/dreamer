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

  async function journal(screen: NativeFixtures['screen']) {
    const back = screen.getByTestId('btn.navigateJournal', { visible: true });
    await screen.scrollUntilVisible(back, { direction: 'up' });
    // The running head can be partly under the iOS status bar while AX calls it
    // visible. The revealed return tab remains inside the usable screen.
    const returnTab = screen.getByTestId('journal.detail.returnTab', { visible: true });
    if (await returnTab.isVisible()) await returnTab.tap();
    else await back.tap();
    await expect(screen.getByTestId('screen.journal', { visible: true })).toBeVisible();
  }

  async function settings(screen: NativeFixtures['screen']) {
    await home(screen);
    await screen.getByTestId('btn.header.home.settings', { visible: true }).tap();
    await tap(screen, 'quick-settings.all');
    await expect(screen.getByTestId('screen.settings', { visible: true })).toBeVisible();
  }

  async function startProfile({ app, screen, platform }: NativeFixtures, profile?: 'new' | 'existing' | 'plus') {
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
    if (!profile) {
      // On iOS the drawer's close button can be reported visible while its
      // scrolled header is off screen. Use the visible settings route and back.
      await tap(screen, 'quick-settings.all');
      await expect(screen.getByTestId('screen.settings', { visible: true })).toBeVisible();
      await tap(screen, 'settings.back', 'up');
      await expect(screen.getByTestId('screen.home', { visible: true })).toBeVisible();
      await tap(screen, 'tab.addDream');
      await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
      return;
    }
    await tap(screen, 'quick-settings.all');
    await expect(screen.getByTestId('screen.settings', { visible: true })).toBeVisible();
    await tap(screen, 'settings-account-open-signin', 'up');
    await tap(screen, `btn.mockProfile.${profile}`);
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  }

  async function enterStory({ screen, device, platform }: NativeFixtures, story: string) {
    await tap(screen, 'btn.recording.inputMode.text');
    const editor = screen.getByTestId('input.dreamTranscript', { visible: true });
    await editor.fill(story);
    // The iOS multiline keyboard has no dismiss key; the static title is a
    // safe tap target and avoids inserting a newline or hitting Save/Clear.
    if (platform === 'ios') await screen.getByText('Noctalia', { exact: true, visible: true }).tap();
    else await device.dismissKeyboard();
    await expect(editor).toHaveValue(story);
  }

  async function saveGuestDream(fixtures: NativeFixtures, story: string, reading: 'first' | 'next' | 'none') {
    const { screen, platform } = fixtures;
    await enterStory(fixtures, story);
    await tap(screen, 'btn.saveDream');
    if (reading === 'next') await tap(screen, 'btn.dreamCaptureSeal.readNow');
    if (reading === 'first' && platform === 'ios') {
      await expect(screen.getByTestId('modal.aiConsent', { visible: true })).toBeVisible();
      await expect(screen.getByTestId('component.aiConsent.card', { visible: true })).toBeVisible();
      const accept = screen.getByTestId('btn.aiConsent.accept', { visible: true });
      await expect(accept).toBeEnabled();
      // The native modal can expose its AX nodes before the opening transition
      // finishes. Wait for its actual button frame to settle before one tap.
      let previousFrame = '';
      let stableReads = 0;
      await expect.poll(async () => {
        const frame = await accept.boundingBox();
        if (!frame || frame.width <= 0 || frame.height <= 0) return false;
        const currentFrame = [frame.x, frame.y, frame.width, frame.height].map(Math.round).join(':');
        stableReads = currentFrame === previousFrame ? stableReads + 1 : 0;
        previousFrame = currentFrame;
        return stableReads >= 2;
      }).toBe(true);
      await accept.tap();
      await expect(screen.getByTestId('modal.aiConsent', { visible: true })).toHaveCount(0);
    }
    if (reading !== 'none') {
      // The pending reading can move the transcript when its result arrives.
      // Wait for the actual interpretation before navigating to the story.
      const interpretation = screen.getByTestId('component.dreamDetail.interpretation', { visible: true });
      await expect(interpretation).toBeVisible();
      let previousFrame = '';
      let stableReads = 0;
      await expect.poll(async () => {
        const frame = await interpretation.boundingBox();
        if (!frame || frame.width <= 0 || frame.height <= 0) return false;
        const currentFrame = [frame.x, frame.y, frame.width, frame.height].map(Math.round).join(':');
        stableReads = currentFrame === previousFrame ? stableReads + 1 : 0;
        previousFrame = currentFrame;
        return stableReads >= 2;
      }).toBe(true);
    }
    await readableStory(screen, story);
  }

  async function expectGuestSignup(screen: NativeFixtures['screen']) {
    await expect(screen.getByTestId('screen.account', { visible: true })).toBeVisible();
    await expect(screen.getByTestId('btn.auth.signUp', { visible: true })).toHaveCount(1);
    await expect(screen.getByTestId('screen.paywall')).toBeHidden();
  }

  async function readableStory(screen: NativeFixtures['screen'], story: string) {
    // iOS accessibility inserts an object-replacement marker after the styled
    // initial; compare the complete text after removing only that marker.
    const prose = screen.getByTestId('text.dreamDetail.transcript', { visible: true });
    await screen.scrollUntilVisible(prose);
    await expect(prose).toBeVisible();
    expect((await prose.textContent())?.replace(/\uFFFC/g, '')).toBe(story);
  }

  async function openSearchResult({ screen, device, platform }: NativeFixtures, query: string) {
    const search = screen.getByTestId('input.searchDreams', { visible: true });
    await screen.scrollUntilVisible(search, { direction: 'up' });
    // Sol may leave a shorter search in place. Confirm it is cleared before
    // entering the exact query. Filtering can move the mobile search chrome
    // offscreen, so reveal it again after the result list expands.
    if (await search.inputValue()) {
      await search.fill('');
      await screen.scrollUntilVisible(search, { direction: 'up' });
      await expect(search).toHaveValue('');
    }
    await search.fill(query);
    // Tap the actual iOS search key: synthetic Enter can time out on the
    // Simulator keyboard even though the filtered result is already present.
    if (platform === 'ios') await screen.getByTestId('Search', { visible: true }).tap();
    else await device.dismissKeyboard();
    await expect(search).toHaveValue(query);
    const entry = screen.getByTestId(/^dream\.item\./, { visible: true });
    await expect(entry).toHaveCount(1);
    await entry.tap();
    await expect(screen.getByTestId('screen.dreamDetail', { visible: true })).toBeVisible();
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
      await journal(screen);
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
      // iOS AX can echo the title on both a Text and its child. Select the
      // readable leaf within the active dream page, excluding Journal entries.
      const title = screen.getByTestId('screen.dreamDetail', { visible: true })
        .getByText('Garden in the Clouds', { exact: true, visible: true }).last();
      await screen.scrollUntilVisible(title, { direction: 'up' });
      await expect(title).toBeVisible();
      const originalStory = 'I was walking through a beautiful garden floating among the clouds. There were flowers I had never seen before, in colors that do not exist in real life. A gentle breeze carried the scent of jasmine. I sat on a bench and watched birds made of rainbow light fly by. Time seemed to stand still.';
      await readableStory(screen, originalStory);
      // This exact fixture starts outside favourites. Finding it in the filtered
      // Journal after the goal proves a change even if native AX hides icon state.
      await agent.act('Add this dream to your favourites so you can find it again later. Finish on this dream page.');
      await journal(screen);
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
      // iOS: the root host shows modal.aiConsent (Alert.alert is only the fallback when that host is
      // absent). Do not scroll: a swipe on the dimmed overlay declines. Android asks nothing (2026-10-29).
      if (platform === 'ios') {
        await expect(screen.getByTestId('modal.aiConsent', { visible: true })).toBeVisible();
        await expect(screen.getByTestId('component.aiConsent.card', { visible: true })).toBeVisible();
        await screen.getByTestId('btn.aiConsent.accept', { visible: true }).tap();
      }
      await expect(screen.getByTestId('modal.aiConsent', { visible: true })).toHaveCount(0);
      const savedQuestion = screen.getByText(question, { exact: true, visible: true });
      await expect(savedQuestion).toBeVisible();
      const latest = screen.getByRole('button', 'Aller au dernier message', { exact: true, visible: true });
      if (await latest.isVisible()) await latest.tap();
      const answer = screen.getByText(/^(That's an interesting question|Based on your dream,|Dreams like yours often|The elements you mentioned|I sense that this dream)/, { visible: true });
      await expect(answer).toBeVisible();
      await expect(screen.getByTestId('chat.loading')).toBeHidden();
      // The thinking indicator disappears as soon as streaming begins, and
      // iOS AX reports the microphone's child enabled before its parent.
      // The quick topic becomes a button only when the send lock is released.
      if (platform === 'ios') {
        const topic = screen.getByRole('button', 'Symboles', { exact: true, visible: true });
        await screen.scrollUntilVisible(topic, { direction: 'up' });
        await expect(topic).toBeVisible();
        await screen.scrollUntilVisible(answer);
      }
      await expect(input).toBeEnabled();
      const response = await answer.textContent();
      if (!response) throw new Error('The conversation has no readable assistant reply.');
      await screen.getByRole('button', 'Retour', { exact: true, visible: true }).tap();
      await screen.getByRole('button', 'Retour', { exact: true, visible: true }).tap();
      await journal(screen);
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
      await journal(screen);
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
  test('a native guest at the offered chat limit discovers account creation',
    { agent: 'guest', tags: ['personas', 'persona-guest', 'persona-guest-chat'], timeout: 360_000 }, async fixtures => {
      const { app, screen, agent, device, platform } = fixtures;
      await startProfile(fixtures);
      await saveGuestDream(fixtures, 'Personas invitée : un verger de verre chante quand le vent passe.', 'first');
      await tap(screen, 'component.dreamDetail.actionCard');
      await tap(screen, 'btn.dreamCategory.freeChat');
      const input = screen.getByTestId('chat.input.message', { visible: true });
      const limit = screen.getByTestId('text.chat.limit', { visible: true });
      const counter = screen.getByTestId('text.chat.messageCounter', { visible: true });
      for (let sent = 0; sent < 10; sent += 1) {
        await expect(counter).toHaveText(new RegExp(`^${sent}/10(?:\\s|$)`));
        // The counter advances on acceptance, before the streamed reply has
        // finished and the iOS composer becomes editable again. A quick topic
        // is exposed as a button only after the send lock is released.
        if (platform === 'ios' && sent > 0) {
          const topic = screen.getByRole('button', 'Symboles', { exact: true, visible: true });
          await screen.scrollUntilVisible(topic, { direction: 'up' });
          await expect(topic).toBeVisible();
        }
        await input.fill(`Personas limite native ${sent + 1}`);
        if (platform === 'android') await device.dismissKeyboard();
        await tap(screen, 'chat.button.send');
        await expect(counter.filter({ hasText: `${sent + 1}/10` }).or(limit)).toBeVisible();
      }
      await expect(limit).toBeVisible();
      // iOS exposes the banner text beside its testID container in AX.
      await expect(screen.getByText('Tes 10 échanges offerts sont utilisés', { exact: true, visible: true }).last()).toBeVisible();
      await expect(screen.getByTestId('btn.chat.limitUpgrade', { visible: true })).toBeVisible();
      await expect(screen.getByRole('button', 'Créer un compte', { exact: true, visible: true }).last()).toBeVisible();
      await agent.assert('The visible chat explains that the offered exchanges are used and offers account creation without a purchase screen.', { vision: true });
      await agent.act('Follow the invitation to continue this conversation. Stop at the account form without filling it in.');
      await expectGuestSignup(screen);
      await app.screenshot('native-guest-chat-signup');
    });

  test('a native guest out of offered analyses keeps the dream and discovers account creation',
    { agent: 'guest', tags: ['personas', 'persona-guest', 'persona-guest-analyses'], timeout: 360_000 }, async fixtures => {
      const { app, screen, agent, platform } = fixtures;
      await startProfile(fixtures);
      const returnToJournal = async () => {
        if (platform === 'ios') {
          const back = screen.getByTestId('btn.navigateJournal', { visible: true });
          await screen.scrollUntilVisible(back, { direction: 'up' });
          // On an illustrated dream, the running head can keep moving after AX
          // first exposes the back control. Let its frame settle before tapping.
          let previousFrame = '';
          let stableReads = 0;
          await expect.poll(async () => {
            const frame = await back.boundingBox();
            if (!frame || frame.width <= 0 || frame.height <= 0) return false;
            const currentFrame = [frame.x, frame.y, frame.width, frame.height].map(Math.round).join(':');
            stableReads = currentFrame === previousFrame ? stableReads + 1 : 0;
            previousFrame = currentFrame;
            return stableReads >= 2;
          }).toBe(true);
        }
        await journal(screen);
      };
      // Consume the real mock allowance through UI; do not add a native storage backdoor.
      await saveGuestDream(fixtures, 'Première nuit : un arbre bleu au milieu de la mer.', 'first');
      await returnToJournal();
      await tap(screen, 'tab.addDream');
      await saveGuestDream(fixtures, 'Deuxième nuit : une horloge de sable sous la lune.', 'next');
      await returnToJournal();
      await tap(screen, 'tab.addDream');
      const story = 'Personas limite native : un phare turquoise éclaire les nuages.';
      await saveGuestDream(fixtures, story, 'none');
      await tap(screen, 'btn.savedDream.discoverPlus');
      await expect(screen.getByTestId('screen.paywall', { visible: true })).toBeVisible();
      await tap(screen, 'btn.paywall.close');
      await readableStory(screen, story);
      const invitation = screen.getByTestId('btn.dream.primaryCta', { visible: true });
      await screen.scrollUntilVisible(invitation);
      await expect(invitation).toContainText('Créer un compte');
      await agent.act('Follow the invitation to get new offered analyses. Stop at the account form without filling it in.');
      await expectGuestSignup(screen);
      await app.screenshot('native-guest-analyses-signup');
    });

  test('a native guest discovers remembered capture from an empty journal',
    { agent: 'guest', tags: ['personas', 'persona-guest', 'persona-guest-memory'] }, async fixtures => {
      const { app, screen, agent } = fixtures;
      await startProfile(fixtures);
      await tap(screen, 'tab.journal');
      await expect(screen.getByTestId(/^dream\.item\./, { visible: true })).toHaveCount(0);
      await agent.act('From your empty journal, open the empty writing form for an old dream you never forgot. Stop before entering any text.');
      await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
      await expect(screen.getByTestId('input.dreamTranscript', { visible: true })).toHaveValue('');
      await agent.assert('The screen invites you to describe a remembered dream, and that invitation and the writing area are readable.', { vision: true });
      const story = 'Personas souvenir natif : enfant, je traversais une forêt de lampes.';
      await saveGuestDream(fixtures, story, 'first');
      await app.restart();
      await home(screen);
      await tap(screen, 'tab.journal');
      await openSearchResult(fixtures, 'Personas souvenir natif');
      await readableStory(screen, story);
      await app.screenshot('native-guest-remembered-dream-durable');
    });
}
