import { test, type Browser } from '@e2e-dev/web';
import { expect, type App, type Screen } from 'e2e';
import { isolateWeb } from '../web-fixtures';
import { webLocale } from '../web-engine';

// Normal regression campaigns register no persona tests and need no model/login.
// The separate opt-in campaign selects only this file, with one worker and no replay.
if (process.env.E2E_PERSONAS === '1') {
  async function startProfile(app: App, screen: Screen, browser: Browser, profile: 'new' | 'existing' | 'plus') {
    await isolateWeb(browser, app);
    await app.open();
    await screen.getByTestId('btn.onboarding.intro.next').tap();
    if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
      // Leaving the onboarding stories still uses the browser confirmation.
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

  /** A guest past onboarding, with AI already allowed: the journeys below are about limits, not consent. */
  async function startGuest(app: App, screen: Screen, browser: Browser, spentAnalyses = 0) {
    await isolateWeb(browser, app);
    await app.open();
    await browser.addInitScript((spent: number) => {
      // The blank page before the app has no storage to seed.
      if (location.origin === 'null') return;
      localStorage.setItem('noctalia.aiConsent.v2', 'granted');
      // Seeded once, before the reloaded app reads its offered analyses.
      if (!spent || sessionStorage.getItem('e2e.guestAnalysesSpent')) return;
      sessionStorage.setItem('e2e.guestAnalysesSpent', '1');
      localStorage.setItem('mock_quota_events_migrated_v1', 'true');
      localStorage.setItem('mock_quota_events_v1', JSON.stringify({
        analysisCount: spent, explorationCount: 0, imageCount: 0,
        analyzedDreamIds: [], exploredDreamIds: [], imagedDreamIds: [],
      }));
    }, spentAnalyses);
    await browser.reload();
    await screen.getByTestId('btn.onboarding.intro.next').tap();
    if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
      const stop = await browser.onDialog('accept');
      try { await screen.getByTestId('btn.onboarding.feature.close', { visible: true }).tap(); }
      finally { stop(); }
    }
    await screen.getByTestId('btn.onboarding.skip').tap();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  }

  /** The guest followed the invitation to the account form, and nothing else. */
  async function expectSignupForm(screen: Screen, browser: Browser) {
    await expect(browser).toHaveURL(/\/settings\?section=account&auth=signup$/);
    await expect(screen.getByTestId('screen.account', { visible: true })).toBeVisible();
    await expect(screen.getByTestId('btn.auth.signUp', { visible: true })).toHaveCount(1);
    await expect(screen.getByTestId('screen.paywall')).toBeHidden();
  }

  async function reopenAfterReload(screen: Screen, browser: Browser, query: string) {
    await browser.reload();
    // Startup can resume the first capture intent or open Capture. Persistence
    // means the entry is recoverable from Journal, not that its route is retained.
    const back = screen.getByTestId('btn.navigateJournal', { visible: true });
    const tab = screen.getByTestId('tab.journal', { visible: true });
    await expect(back.or(tab)).toBeVisible();
    if (await back.isVisible()) { await back.scrollIntoView(); await back.tap(); }
    else await tab.tap();
    await screen.getByTestId('input.searchDreams', { visible: true }).fill(query);
    const entry = screen.getByTestId(/^dream\.item\./, { visible: true });
    await expect(entry).toHaveCount(1);
    await entry.tap();
  }

  // The original detailed French assertions remain unchanged. The pilot below
  // uses stable UI outcomes in every configured browser language.
  if (webLocale === 'fr-FR') {
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
      const entry = screen.getByTestId(/^dream\.item\./, { visible: true });
      await expect(entry).toHaveCount(1);
      await entry.tap();
      await screen.getByTestId('btn.editDream').tap();
      await expect(screen.getByTestId('input.dreamTranscript')).toHaveValue(story);
    });

  test('a regular journaler retrieves an older dream and finds it again in favourites',
    { agent: 'archivist', tags: ['personas', 'persona-archivist', 'journal'] }, async ({ app, screen, browser, agent }) => {
      await startProfile(app, screen, browser, 'existing');
      await agent.act('Find and open your older dream about a garden floating among the clouds.');
      const title = screen.getByRole('heading', 'Garden in the Clouds', { exact: true, visible: true });
      await expect(title).toBeVisible();
      const transcript = screen.getByTestId('component.transcriptCard', { visible: true });
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
      const entry = screen.getByTestId(/^dream\.item\./, { visible: true });
      await expect(entry).toHaveCount(1);
      await entry.tap();
      await expect(title).toBeVisible();
      await expect(transcript).toHaveText(originalStory);
      await app.screenshot('archivist-favourite-reopened');
    });

  test('a reflective Plus user revisits the same dream conversation without duplicating it',
    { agent: 'explorer', tags: ['personas', 'persona-explorer', 'reflection'] }, async ({ app, screen, browser, agent }) => {
      await startProfile(app, screen, browser, 'plus');
      await agent.act('Open a free-form conversation about your older dream titled The Infinite Library.');
      const title = screen.getByText('The Infinite Library', { exact: true, visible: true });
      await title.scrollIntoView();
      await expect(title).toBeVisible();
      const input = screen.getByTestId('chat.input.message', { visible: true });
      await expect(input).toBeEnabled();
      await expect(input).not.toHaveAttribute('readonly');
      const question = 'Personas réflexion : pourquoi cette bibliothèque semblait-elle si familière ?';
      await input.fill(question);
      const savedQuestion = screen.getByText(question, { exact: true, visible: true });
      await screen.getByTestId('chat.button.send', { visible: true }).tap();
      const consent = screen.getByTestId('modal.aiConsent');
      await expect(consent).toBeVisible();
      await screen.getByTestId('btn.aiConsent.accept', { visible: true }).tap();
      await expect(consent).toBeHidden();
      await expect(savedQuestion).toBeVisible();
      const latest = screen.getByRole('button', 'Aller au dernier message', { exact: true, visible: true });
      if (await latest.isVisible()) await latest.tap();
      await expect(savedQuestion).toBeVisible();
      const answer = screen.getByText(/^(That's an interesting question|Based on your dream,|Dreams like yours often|The elements you mentioned|I sense that this dream)/, { visible: true });
      await expect(answer).toBeVisible();
      await expect(screen.getByTestId('chat.loading')).toBeHidden();
      await expect(input).toBeEnabled();
      await expect(input).not.toHaveAttribute('readonly');
      // Capture the completed reply, not an intermediate streaming chunk.
      const response = await answer.textContent();
      if (!response) throw new Error('The conversation has no readable assistant reply.');
      // Go back to the journal through exact navigation; the next goal discovers
      // how to reach that same discussion again, with no new message requested.
      await screen.getByRole('button', 'Retour', { exact: true, visible: true }).tap();
      await screen.getByRole('button', 'Retour', { exact: true, visible: true }).tap();
      const back = screen.getByTestId('btn.navigateJournal');
      await back.scrollIntoView();
      await back.tap();
      await agent.act('Reopen your existing conversation about The Infinite Library, with the earlier question and reply on screen. Do not send another message.');
      await title.scrollIntoView();
      await expect(title).toBeVisible();
      if (await latest.isVisible()) await latest.tap();
      await expect(savedQuestion).toHaveCount(1);
      await expect(screen.getByText(response, { exact: true, visible: true })).toBeVisible();
      await expect(input).toBeEnabled();
      await expect(input).not.toHaveAttribute('readonly');
      await app.screenshot('explorer-conversation-revisited');
    });

  test('a guest at the offered chat limit is told so and invited to create an account',
    { agent: 'guest', tags: ['personas', 'persona-guest', 'quota'] }, async ({ app, screen, browser, agent }) => {
      await startGuest(app, screen, browser);
      const story = 'Personas invitée : un verger de verre chante quand le vent passe.';
      await screen.getByTestId('input.dreamTranscript').fill(story);
      await screen.getByTestId('btn.saveDream').tap();
      // A guest's first dream is read unasked.
      await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
      await expect(screen.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
      const card = screen.getByTestId('component.dreamDetail.actionCard');
      await card.scrollIntoView();
      await card.tap();
      await screen.getByTestId('btn.dreamCategory.freeChat').tap();
      // Exact setup: the ten offered exchanges, without a model call.
      const input = screen.getByTestId('chat.input.message', { visible: true });
      const limit = screen.getByTestId('text.chat.limit');
      const counter = screen.getByTestId('text.chat.messageCounter');
      for (let sent = 0; sent < 10 && !(await limit.isVisible()); sent += 1) {
        const used = Number((await counter.textContent())?.match(/^(\d+)\/10\b/)?.[1]);
        expect(used).toBeLessThan(10);
        await input.fill(`Personas limite ${sent + 1}`);
        await screen.getByTestId('chat.button.send', { visible: true }).tap();
        await expect(counter.filter({ hasText: `${used + 1}/10` }).or(limit)).toBeVisible();
      }
      // The card says the offered exchanges are used and what continues them, once.
      await expect(limit).toContainText('Tes 10 échanges offerts sont utilisés');
      await expect(limit).toContainText('Avec un compte et Noctalia Plus, cette conversation continue.');
      await expect(limit).not.toContainText('sécurité');
      await expect(input).not.toHaveAttribute('placeholder', /échanges|limite/i);
      await expect(screen.getByTestId('btn.chat.limitUpgrade')).toHaveText('Créer un compte');
      await agent.assert('The chat says once that the offered exchanges for this dream are used and invites the guest to create an account; no other text on screen repeats that.');
      await app.screenshot('guest-chat-limit');
      await agent.act('Keep this conversation going by following what the app offers you. Stop at the first form; do not fill it in.');
      await expectSignupForm(screen, browser);
    });

  test('a guest out of offered analyses is told so and invited to create an account',
    { agent: 'guest', tags: ['personas', 'persona-guest', 'quota'] }, async ({ app, screen, browser, agent }) => {
      await startGuest(app, screen, browser, 2);
      const story = 'Personas invitée : une horloge de sable compte à rebours sous la mer.';
      await screen.getByTestId('input.dreamTranscript').fill(story);
      await screen.getByTestId('btn.saveDream').tap();
      await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
      // The page it lands on names the spent allowance and the account that opens new analyses.
      await expect(screen.getByText('Tes analyses offertes sont utilisées. Un compte gratuit t’ouvre de nouvelles analyses.', { visible: true })).toBeVisible();
      await expect(screen.getByTestId('btn.dream.primaryCta', { visible: true })).toContainText('Créer un compte');
      // Plus stays one quiet step away, and never promises the guest's analyses back:
      // they are two in all, and only an account brings more.
      await screen.getByTestId('btn.savedDream.discoverPlus', { visible: true }).tap();
      const offer = screen.getByTestId('screen.paywall', { visible: true });
      await expect(offer).toContainText('Sans compte, tes analyses offertes ne reviennent pas.');
      await expect(offer).not.toContainText('reviennent le');
      await screen.getByTestId('btn.paywall.close', { visible: true }).tap();
      await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
      await expect(screen.getByTestId('component.dreamDetail.readingZone')).toBeHidden();
      await agent.assert('The screen says once that the offered analyses are used and invites the guest to create a free account; no other text on screen repeats that.');
      await app.screenshot('guest-analyses-spent');
      await agent.act('Create a free account as the app invites you to. Stop at the first form; do not fill it in.');
      await expectSignupForm(screen, browser);
    });

  test('a guest starts a remembered dream from the empty journal with one invitation to write',
    { agent: 'guest', tags: ['personas', 'persona-guest', 'capture'] }, async ({ app, screen, browser, agent }) => {
      await startGuest(app, screen, browser);
      await screen.getByTestId('tab.journal', { visible: true }).tap();
      await agent.act('From your empty journal, open the empty writing form for an old dream you never forgot. Stop before entering any text.');
      const editor = screen.getByTestId('input.dreamTranscript', { visible: true });
      await expect(editor).toHaveValue('');
      await expect(editor).toHaveAttribute('placeholder', 'Raconte ce rêve que tu n’as jamais oublié...');
      // The placeholder is the only invitation: no instruction above it repeats it.
      await expect(screen.getByText('Raconte un rêve déjà vécu.')).toHaveCount(0);
      // The placeholder is only in the pixels, not in the accessibility tree.
      await agent.assert('The capture screen invites the user to tell an old, remembered dream in exactly one place.', { vision: true });
      await app.screenshot('guest-remembered-capture');
      const story = 'Personas souvenir : enfant, je traversais une forêt de lampes suspendues.';
      await editor.fill(story);
      await screen.getByTestId('btn.saveDream').tap();
      await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
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
      // Current master caps displayed consumption at the free allowance.
      await expect(screen.getByTestId('quota.analysisValue')).toHaveText('3 / 3');
      if (!await screen.getByTestId('text.subscription.qa.mode').isVisible()) {
        await screen.getByTestId('screen.subscription.qaLab.toggle').tap();
      }
      await expect(screen.getByTestId('text.subscription.qa.purchaseCalls')).toHaveText('0');
      await expect(screen.getByTestId('text.subscription.qa.restoreCalls')).toHaveText('0');
    });
  }

  test('a first-time guest discovers capture and keeps a dream across reload',
    { agent: 'guest', tags: ['personas', 'persona-guest', 'persona-discovery', 'persona-pilot'] }, async ({ app, screen, browser, agent }) => {
      await isolateWeb(browser, app);
      await app.open();
      await browser.addInitScript(() => localStorage.setItem('noctalia.aiConsent.v2', 'granted'));
      await browser.reload();
      const dismiss = await browser.onDialog('accept');
      try {
        await agent.act('From this first welcome, reach the place where you can write a dream without creating an account.');
      } finally { await dismiss(); }
      const editor = screen.getByTestId('input.dreamTranscript', { visible: true });
      await expect(editor).toBeVisible();
      const story = 'Persona discovery: a blue boat carries a brass key across a quiet lake.';
      await editor.fill(story);
      await agent.act('Save the dream you entered so you can find it later.');
      await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
      await expect(screen.getByTestId('screen.account')).toBeHidden();
      await reopenAfterReload(screen, browser, 'Persona discovery');
      await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
      await expect.poll(() => browser.evaluate(text => {
        const entries = JSON.parse(localStorage.getItem('noctalia_mock_dogfood_v1:gemini_dream_journal_dreams') ?? '[]') as { transcript: string }[];
        return entries.filter(entry => entry.transcript === text).length;
      }, story)).toBe(1);
      await app.screenshot('persona-first-launch-durable-dream');
    });

  test('a guest recovers a failed save without losing text or spending another allowance',
    { agent: 'morning', tags: ['personas', 'persona-morning', 'persona-recovery', 'persona-pilot'] }, async ({ app, screen, browser, agent }) => {
      await startGuest(app, screen, browser, 2);
      const story = 'Persona recovery: a paper lighthouse shelters a small silver bird.';
      const journalKey = 'noctalia_mock_dogfood_v1:gemini_dream_journal_dreams';
      const draftKey = 'noctalia_mock_dogfood_v1:gemini_dream_journal_recording_transcript:guest';
      const quotaKey = 'mock_quota_events_v1';
      const editor = screen.getByTestId('input.dreamTranscript', { visible: true });
      await editor.fill(story);
      await expect.poll(() => browser.evaluate(key => localStorage.getItem(key), draftKey)).toBe(story);
      const quota = await browser.evaluate(key => localStorage.getItem(key), quotaKey);
      await browser.evaluate(key => {
        const setItem = Storage.prototype.setItem;
        (window as Window & { restorePersonaStorage?: () => void }).restorePersonaStorage = () => { Storage.prototype.setItem = setItem; };
        Storage.prototype.setItem = function (name, value) {
          if (name === key) throw new DOMException('Synthetic persona storage failure', 'QuotaExceededError');
          setItem.call(this, name, value);
        };
        return null;
      }, journalKey);
      let failures = 0;
      const dismiss = await browser.onDialog(async dialog => { failures += 1; await dialog.accept(); });
      try {
        await screen.getByTestId('btn.saveDream', { visible: true }).tap();
        await expect.poll(() => failures).toBe(1);
        await expect(editor).toHaveValue(story);
        expect(await browser.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '[]').length, journalKey)).toBe(0);
      } finally {
        await dismiss();
        await browser.evaluate(() => {
          const target = window as Window & { restorePersonaStorage?: () => void };
          target.restorePersonaStorage?.(); delete target.restorePersonaStorage; return null;
        });
      }
      await agent.act('Recover from the failed save by keeping your existing dream. Do not create an account or request a reading.');
      await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
      await reopenAfterReload(screen, browser, 'Persona recovery');
      await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
      const entries = await browser.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '[]') as { transcript: string }[], journalKey);
      expect(entries).toHaveLength(1);
      expect(entries[0].transcript).toBe(story);
      expect(await browser.evaluate(key => localStorage.getItem(key), quotaKey)).toBe(quota);
      await app.screenshot('persona-save-recovered-once');
    });

  test('a curious guest finds a symbol interpretation and the account condition of a collection',
    { agent: 'guest', tags: ['personas', 'persona-guest', 'persona-exploration', 'persona-pilot'] }, async ({ app, screen, browser, agent }) => {
      await startGuest(app, screen, browser);
      await agent.act('Find the dictionary interpretation of water as a dream symbol.');
      await expect(browser).toHaveURL(/\/symbol-detail\/water/);
      await expect(screen.getByTestId('screen.symbolDetail', { visible: true })).toBeVisible();
      await agent.act('Open your collection of dream cards.');
      await expect(screen.getByTestId('collection.guest.body', { visible: true })).toBeVisible();
      await agent.assert('The collection explains that a free account is needed to earn cards, without claiming that this guest already owns them.', { vision: true });
      await expect(screen.getByTestId('collection.summary')).toBeHidden();
      await app.screenshot('persona-collection-account-condition');
    });

  test('a reader resumes the bookmarked guide after restarting the app',
    { agent: 'archivist', tags: ['personas', 'persona-archivist', 'persona-guides', 'persona-pilot'] }, async ({ app, screen, browser, agent }) => {
      await startGuest(app, screen, browser);
      await screen.getByTestId('tab.explore', { visible: true }).tap();
      await screen.getByTestId('btn.explorer.guides', { visible: true }).tap();
      await screen.getByTestId('dream-guide-dream-journal').tap();
      await screen.getByTestId('guide.section.3').scrollIntoView();
      const key = 'noctalia_guide_reading_v1:guest';
      await expect.poll(() => browser.evaluate(k => JSON.parse(localStorage.getItem(k) ?? '{}')['dream-journal']?.section ?? 0, key)).toBeGreaterThan(0);
      const bookmark = await browser.evaluate(k => JSON.parse(localStorage.getItem(k) ?? '{}')['dream-journal'].section as number, key);
      await browser.reload();
      await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
      await agent.act('Resume the guide about keeping a dream journal that you were reading earlier.');
      await expect(screen.getByTestId('screen.dreamGuideDetail', { visible: true })).toBeVisible();
      await expect.poll(() => browser.evaluate(section => {
        const element = document.querySelector(`[data-testid="guide.section.${section}"]`);
        if (!element) return false;
        const { top } = element.getBoundingClientRect();
        return top >= 0 && top < innerHeight / 2;
      }, bookmark)).toBe(true);
      await expect(screen.getByTestId('guide.reading.completed')).toBeHidden();
      await app.screenshot('persona-guide-resumed');
    });
}
