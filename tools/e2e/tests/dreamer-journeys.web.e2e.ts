// Historical UI journeys on the SDK surface: trace.md numbers each tap and expect.
import { expect } from 'e2e';
import { journeyTest } from '../traced-parity-test';
import { answerSeal, dreamCards, journal, openDream, openHome, openSettings, search, searchField, selectProfile, startGuest } from '../web-journeys';
const test = journeyTest();
const phoneTest = journeyTest({ viewport: { width: 390, height: 844 } });
const recapTest = journeyTest({ viewport: { width: 390, height: 867 }, reducedMotion: 'reduce' });

test('guest can start a first dream from onboarding', { tags: ['smoke', 'zone-capture'] }, async ({ screen, browser }) => {
  await startGuest(screen, browser);
  await expect(screen.getByTestId('btn.saveDream')).toBeDisabled();
});

test('guest keeps the same draft when switching capture modes', { tags: ['smoke', 'zone-capture'] }, async ({ screen, browser }) => {
  await startGuest(screen, browser);
  const transcript = screen.getByTestId('input.dreamTranscript');
  await transcript.fill('E2E draft: a lighthouse above the sea.');
  await screen.getByTestId('btn.recording.inputMode.voice').tap();
  await screen.getByTestId('btn.recording.inputMode.text').tap();
  await expect(transcript).toHaveValue('E2E draft: a lighthouse above the sea.');
});

test('guest saves the first dream and can read its simulated analysis', { tags: ['zone-sauvegarde'] }, async ({ screen, browser }) => {
  await startGuest(screen, browser);
  const story = 'E2E moonlit harbor with a golden lighthouse.';
  await screen.getByTestId('input.dreamTranscript').fill(story);
  await screen.getByTestId('btn.saveDream').tap();
  await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
  await expect(screen.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
  await expect(screen.getByTestId('analysis.reading.modal')).toHaveCount(0);
  await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
});

test('free user saves a dream and finds the exact story in the journal', { tags: ['smoke', 'zone-sauvegarde'] }, async ({ screen, browser }) => {
  await selectProfile(screen, browser, 'existing');
  const story = 'E2E sapphire lighthouse above the quiet ocean.';
  await screen.getByTestId('input.dreamTranscript').fill(story);
  await screen.getByTestId('btn.saveDream').tap();
  await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
  await expect(screen.getByTestId('btn.editDream')).toBeEnabled();
  await screen.getByTestId('btn.editDream').tap();
  await screen.getByTestId('input.dreamTitle').fill('E2E sapphire lighthouse');
  await screen.getByTestId('btn.saveDreamEdit').tap();
  await journal(screen);
  await openDream(screen, 'E2E sapphire lighthouse');
  await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
});

// Retired 2026-10-14 (seal workflow, PR #358): the capture seal now waits for the dream's
// pre-analysis before its page opens, so in the browser's mock profile (0.5-1 s) the
// categorization always lands before an edit can start. "Background categorization preserves
// the metadata/transcript draft" stays covered on Android and iOS by the mock-persistent
// profile with EXPO_PUBLIC_MOCK_CATEGORIZATION_DELAY_MS=30000 (tools/e2e/NATIVE-MATRIX.md).

phoneTest('free user searches, sees no match, and recovers the journal', { tags: ['zone-journal'] }, async ({ app, screen, browser }) => {
  await selectProfile(screen, browser, 'existing');
  await journal(screen);
  const cards = screen.getByTestId(/^dream\.item\./);
  await search(screen, 'The Infinite Library');
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText('The Infinite Library');
  await app.screenshot('journal-mobile-entry');
  await search(screen, 'E2E no such dream 93f82');
  await expect(cards).toHaveCount(0);
  const clear = screen.getByTestId('component.searchBar').getByRole('button', 'Clear');
  await clear.focus();
  await browser.keyboard.press('Enter');
  await expect(searchField(screen)).toHaveValue('');
  await expect(searchField(screen)).toBeFocused();
  await expect.poll(() => cards.count()).toBeGreaterThan(1);
  await expect(clear).toHaveCount(0);
  await search(screen, 'The Infinite Library');
  await expect(cards).toHaveCount(1);
});

phoneTest('a search typed in a scrolled journal keeps its field until the user scrolls', { tags: ['zone-journal'] }, async ({ screen, browser }) => {
  await selectProfile(screen, browser, 'existing');
  await journal(screen);
  // e2e has no locator.evaluate: read the shown list's scroll offset in the page.
  const scrolled = () => browser.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-testid="list.dreams"]')]
    .find(list => list.getClientRects().length > 0)?.scrollTop ?? null);
  // Past the list's dismissal window and the web scroller's end of scroll.
  const settle = () => browser.evaluate(() => new Promise<null>((resolve) => setTimeout(() => resolve(null), 400)));
  await browser.mouse.move(195, 640);
  await browser.mouse.wheel(0, 400);
  await expect.poll(scrolled).toBeGreaterThan(0);
  // A reader types once the scroll has come to rest; a field focused mid-scroll is put away.
  await settle();
  // Each letter brings the results back to the top; that return must not take the field away.
  const field = searchField(screen);
  await field.pressSequentially('The Infinite Library', { delay: 40 });
  await expect(field).toHaveValue('The Infinite Library');
  await expect(field).toBeFocused();
  await expect(screen.getByTestId(/^dream\.item\./)).toHaveCount(1);
  await expect(screen.getByTestId(/^dream\.item\./)).toContainText('The Infinite Library');
  // A gesture that does not move the list (a sideways wheel) leaves the field: wait past
  // the list's dismissal window and the web scroller's end of scroll, then check.
  const resting = await scrolled();
  await browser.mouse.move(195, 640);
  await browser.mouse.wheel(120, 0);
  await settle();
  expect(await scrolled()).toBe(resting);
  await expect(field).toBeFocused();
  // The user scrolling the whole journal puts the keyboard away, as a drag does natively.
  await field.fill('');
  await expect.poll(scrolled).toBe(0);
  await browser.mouse.move(195, 640);
  await browser.mouse.wheel(0, 400);
  await expect.poll(scrolled).toBeGreaterThan(0);
  await expect(field).not.toBeFocused();
});

test('free user edits a story, cancels deletion, then deletes only that dream', { tags: ['zone-journal'] }, async ({ screen, browser }) => {
  await selectProfile(screen, browser, 'existing');
  await journal(screen);
  await openDream(screen, 'The Infinite Library');
  await screen.getByTestId('btn.editDream').tap();
  await screen.getByTestId('input.dreamTranscript').fill('E2E revised story: the library has a blue door.');
  await screen.getByTestId('btn.saveDreamEdit').tap();
  await expect(screen.getByTestId('component.transcriptCard')).toContainText('E2E revised story');
  await screen.getByTestId('btn.dream.delete').tap();
  await screen.getByRole('button', 'Cancel').tap();
  await expect(screen.getByTestId('component.transcriptCard')).toContainText('E2E revised story');
  await screen.getByTestId('btn.dream.delete').tap();
  await screen.getByRole('button', 'Delete').tap();
  await expect(screen.getByTestId('screen.journal', { visible: true })).toHaveCount(1);
  await search(screen, 'The Infinite Library');
  await expect(screen.getByTestId(/^dream\.item\./)).toHaveCount(0);
  await search(screen, 'Ocean of Stars');
  await expect(screen.getByTestId(/^dream\.item\./)).toHaveCount(1);
});

test('free user can open the Plus offer and return without losing the journal', { tags: ['zone-paiement'] }, async ({ screen, browser }) => {
  await selectProfile(screen, browser, 'existing');
  await openSettings(screen);
  await screen.getByTestId('settings-section-subscription').tap();
  await expect(screen.getByTestId('screen.paywall')).toBeVisible();
  await screen.getByTestId('btn.paywall.selectMonthly').tap();
  await expect(screen.getByTestId('btn.paywall.selectMonthly')).toHaveAttribute('aria-checked', 'true');
  await screen.getByTestId('btn.paywall.close').tap();
  await expect(screen.getByTestId('screen.paywall')).toBeHidden();
  await screen.getByRole('button', 'Back').tap();
  await screen.getByTestId('tab.journal', { visible: true }).tap();
  await openDream(screen, 'The Infinite Library');
});

for (const profile of ['existing', 'plus'] as const) {
  test(`${profile === 'plus' ? 'Plus' : 'free'} user sees the matching analysis allowance`, { tags: ['zone-consentement-quota'] }, async ({ screen, browser }) => {
    await selectProfile(screen, browser, profile);
    await openSettings(screen);
    if (profile === 'existing') {
      await expect(screen.getByTestId('quota.analysisValue')).toContainText('/ 3');
      // One way to Plus in the card: the row, not a second upgrade button.
      await expect(screen.getByRole('button', 'Upgrade to Noctalia Plus')).toHaveCount(0);
      await screen.getByTestId('settings-section-subscription').tap();
      await expect(screen.getByTestId('screen.paywall')).toBeVisible();
    } else {
      await expect(screen.getByTestId('quota.analysisValue')).toContainText('Unlimited');
    }
  });
}

test('Plus user signs out and returns to guest without exposing the account journal', { tags: ['zone-connexion'] }, async ({ screen, browser }) => {
  await selectProfile(screen, browser, 'plus');
  await openSettings(screen);
  await screen.getByTestId('btn.auth.signOut').tap();
  await expect(screen.getByTestId('screen.recording')).toBeVisible();
  await openSettings(screen);
  await expect(screen.getByTestId('settings-account-open-signin')).toBeVisible();
  await expect(screen.getByTestId('btn.auth.signOut')).toHaveCount(0);
  await screen.getByTestId('settings.back').tap();
  await screen.getByTestId('tab.journal', { visible: true }).tap();
  await expect(screen.getByTestId('journal-first-page')).toBeVisible();
  await expect(dreamCards(screen)).toHaveCount(0);
});

test('guest with a dream opens account creation from the journal, and the offer leaves once signed in', { tags: ['zone-connexion'] }, async ({ screen, browser }) => {
  await startGuest(screen, browser);
  await screen.getByTestId('input.dreamTranscript').fill('E2E guest dream kept only on this device.');
  await screen.getByTestId('btn.saveDream').tap();
  await expect(screen.getByTestId('component.transcriptCard')).toBeVisible();
  await journal(screen);
  await screen.getByTestId('btn.guest.account.journal').tap();
  await expect(screen.getByTestId('screen.account')).toBeVisible();
  await expect(screen.getByTestId('btn.auth.signUp', { visible: true })).toHaveCount(1);
  await screen.getByTestId('btn.mockProfile.existing').tap();
  await expect(screen.getByTestId('screen.recording')).toBeVisible();
  await journal(screen);
  await expect(dreamCards(screen).first()).toBeVisible();
  await expect(screen.getByTestId('btn.guest.account.journal')).toHaveCount(0);
});

test('free user adds and removes a favorite through the filtered journal', { tags: ['zone-journal'] }, async ({ screen, browser }) => {
  await selectProfile(screen, browser, 'existing');
  await journal(screen);
  await openDream(screen, 'Garden in the Clouds');
  const transcript = screen.getByTestId('component.transcriptCard');
  const originalStory = await transcript.textContent();
  expect(originalStory).toContain('I was walking through a beautiful garden');
  await screen.getByTestId('btn.dream.favorite').tap();
  await journal(screen);
  await screen.getByRole('button', 'Show favorites only').tap();
  await openDream(screen, 'Garden in the Clouds');
  await screen.getByTestId('btn.dream.favorite').tap();
  await journal(screen);
  // Upstream 02a97ad08 retains the journal: a second Favorites click would clear its filter.
  await expect(searchField(screen)).toHaveValue('Garden in the Clouds');
  await expect(dreamCards(screen)).toHaveCount(0);
  await screen.getByRole('button', 'Show all dreams').tap();
  await openDream(screen, 'Garden in the Clouds');
  await expect(transcript).toHaveText(originalStory!);
});

test('Plus user continues a reflection and sees the conversation on revisit', { tags: ['zone-reflexion'] }, async ({ screen, browser }) => {
  await selectProfile(screen, browser, 'plus');
  await journal(screen);
  await openDream(screen, 'The Infinite Library');
  await screen.getByTestId('component.dreamDetail.actionCard').tap();
  await screen.getByTestId('btn.dreamCategory.freeChat').tap();
  const message = screen.getByTestId('chat.input.message');
  await message.fill('E2E: why did the library feel so familiar?');
  await screen.getByTestId('chat.button.send').tap();
  const latest = screen.getByRole('button', 'Jump to latest');
  if (await latest.isVisible()) await latest.tap();
  await expect(screen.getByText('E2E: why did the library feel so familiar?')).toBeVisible();
  // e2e has no toBeEditable: the composer is enabled and no longer read-only.
  await expect(message).toBeEnabled();
  await expect(message).not.toHaveAttribute('readonly');
  const answer = screen.getByText(/^(That's an interesting question|Based on your dream,|Dreams like yours often|The elements you mentioned|I sense that this dream)/);
  await expect(answer).toBeVisible();
  const response = (await answer.textContent())!;
  // Unsent text stays with its conversation when the reader leaves and comes back.
  const draft = 'E2E: an unsent thought about the shelves';
  await message.fill(draft);
  await screen.getByRole('button', 'Back').tap();
  await screen.getByTestId('btn.dreamCategory.freeChat').tap();
  await expect(message).toHaveValue(draft);
  // The conversation reopens on its latest reply, above the composer, with no jump needed.
  const reply = screen.getByText(response);
  await expect.poll(async () => {
    const shown = await reply.boundingBox();
    const input = await message.boundingBox();
    return shown && input && shown.y >= 0 ? input.y - (shown.y + shown.height) : -1;
  }).toBeGreaterThanOrEqual(0);
  await expect(screen.getByText('E2E: why did the library feel so familiar?')).toBeVisible();
  await screen.getByRole('button', 'Back').tap();
  await screen.getByRole('button', 'Back').tap();
  // Returning can restore the previous scroll position without a new scroll
  // event. Read further in the inline analysis to reveal the contextual dock.
  const reading = screen.getByTestId('component.dreamDetail.readingZone');
  await reading.scrollIntoView();
  await reading.hover();
  await browser.mouse.wheel(0, 200);
  await expect(screen.getByTestId('component.dreamDetail.actionCard')).toContainText('Continue my reflection');
});

test('exhausted free account can keep a dream and decline the analysis offer', { tags: ['zone-consentement-quota'] }, async ({ screen, browser }) => {
  await selectProfile(screen, browser, 'existing');
  const story = 'E2E saved even when my analysis allowance is exhausted.';
  await screen.getByTestId('input.dreamTranscript').fill(story);
  await screen.getByTestId('btn.saveDream').tap();
  await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
  await screen.getByTestId('btn.dream.primaryCta').tap();
  await expect(screen.getByTestId('screen.paywall')).toBeVisible();
  await screen.getByTestId('btn.paywall.close').tap();
  await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
  await expect(screen.getByRole('button', 'Read the full analysis')).toHaveCount(0);
});

for (const profile of ['new', 'plus'] as const) {
  test(`${profile === 'new' ? 'fresh free' : 'Plus'} account can analyze a newly saved dream`, { tags: ['zone-consentement-quota'] }, async ({ screen, browser }) => {
    await selectProfile(screen, browser, profile);
    const story = `E2E ${profile} traveler finds a lantern on a silver bridge.`;
    await screen.getByTestId('input.dreamTranscript').fill(story);
    await screen.getByTestId('btn.saveDream').tap();
    // The journal asks during the seal; yes opens the page already reading the dream.
    await answerSeal(screen, 'now');
    await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
    await expect(screen.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
    await expect(screen.getByTestId('analysis.reading.modal')).toHaveCount(0);
    await expect(screen.getByTestId('screen.paywall')).toHaveCount(0);
    await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
  });
}

recapTest('reflection offers an optional recap after one angle and updates it after another exchange', { tags: ['zone-reflexion'] }, async ({ app, screen, browser }) => {
  await selectProfile(screen, browser, 'plus');
  await openHome(screen);
  await screen.getByTestId('btn.home.week.recap').tap();
  await expect(screen.getByTestId('screen.weeklyRecap')).toBeVisible();
  await screen.getByTestId('btn.weeklyRecap.openDream').tap();
  await expect(screen.getByTestId('component.transcriptCard')).toBeVisible();
  await screen.getByTestId('component.transcriptCard').scrollIntoView();
  await screen.getByTestId('component.dreamDetail.actionCard').tap();

  const categories = screen.getByTestId('screen.dreamCategories');
  await expect(categories).toBeVisible();
  for (const angle of ['symbols', 'emotions', 'growth']) {
    await expect(screen.getByTestId(`btn.dreamCategory.${angle}`)).toHaveCount(1);
  }
  await expect(screen.getByTestId('btn.exploration360.synthesis')).toHaveCount(0);
  await screen.getByTestId('btn.dreamCategory.readAnalysis').tap();
  await expect(screen.getByTestId('analysis.reading.body')).toContainText('The infinite library represents your vast inner knowledge and memories.');
  await screen.getByTestId('analysis.reading.close').tap();
  await app.screenshot('reflection-before-exchange');
  await screen.getByTestId('btn.dreamCategory.symbols').tap();
  const recap = screen.getByTestId('btn.exploration360.synthesis', { visible: true });
  const recapTitle = screen.getByText('Take stock of my dream', { visible: true });
  await expect(recap).toBeEnabled();
  await expect(recap).toHaveText(/Take stock/);
  await recap.tap();
  await expect(recapTitle).toBeVisible();
  await expect(screen.getByTestId('text.reflection.recapCurrent', { visible: true })).toBeVisible();
  await expect(recap).toHaveCount(0);
  await screen.getByTestId('quick-category-emotions').tap();
  await expect(recap).toBeEnabled();
  await expect(recap).toHaveText(/Update recap/);
  await recap.tap();
  await expect(recapTitle).toHaveCount(2);
  await expect(screen.getByTestId('text.reflection.recapCurrent', { visible: true })).toBeVisible();
  await expect(recap).toHaveCount(0);
  await screen.getByRole('button', 'Back').tap();
  await expect(categories).toBeVisible();
  // Explored angles remain accessible; reopening one must not send it again.
  await screen.getByTestId('btn.dreamCategory.symbols').tap();
  await expect(recapTitle).toHaveCount(2);
  await expect(recap).toHaveCount(0);
  await screen.getByRole('button', 'Back').tap();
  await app.screenshot('reflection-after-exchanges');
});

// Preserved during the final runner migration: an exhausted account must not
// enter chat before the offer, and declining must return to the same reflection.
test('free reflection opens Plus directly and declining returns to reflection without entering chat', { tags: ['zone-reflexion'] }, async ({ app, screen, browser }) => {
  await selectProfile(screen, browser, 'existing');
  await journal(screen);
  await openDream(screen, 'The Infinite Library');
  await screen.getByTestId('component.dreamDetail.actionCard').tap();
  await screen.getByTestId('btn.dreamCategory.symbols').tap();
  await expect(screen.getByTestId('btn.exploration360.synthesis', { visible: true })).toBeEnabled();
  await screen.getByRole('button', 'Back').tap();
  const reflection = screen.getByTestId('screen.dreamCategories', { visible: true });
  await expect(reflection).toBeVisible();
  // e2e has no page events: the page's Navigation API keeps every destination from here on.
  await browser.evaluate(() => {
    const destinations: string[] = [];
    Object.assign(window, { journeyDestinations: destinations });
    (window as unknown as { navigation: EventTarget }).navigation.addEventListener('navigate', (event) => {
      destinations.push(new URL((event as Event & { destination: { url: string } }).destination.url).pathname);
    });
    return null;
  });
  await reflection.getByTestId('btn.exploration360.synthesis').tap();
  await expect(screen.getByTestId('screen.paywall')).toBeVisible();
  const destinations = await browser.evaluate(() => (window as Window & { journeyDestinations?: string[] }).journeyDestinations ?? null);
  expect(destinations).not.toBeNull();
  expect(destinations!.filter(path => path.startsWith('/dream-chat/'))).toEqual([]);
  await app.screenshot('reflection-direct-plus');
  await screen.getByTestId('btn.paywall.close').tap();
  await expect(reflection).toBeVisible();
  await expect(browser).toHaveURL(/\/dream-categories\//);
  await expect(reflection.getByTestId('btn.exploration360.synthesis')).toBeEnabled();
  await app.screenshot('reflection-after-declining-plus');
});
