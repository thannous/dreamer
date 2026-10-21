import { readDOM, byId, expectEditable, answerSeal, startNavigationAudit, createExactWebTest, expect, withExactDialog } from '../exact-web-fixtures';
import type { ExactWebUI } from '../exact-web-fixtures';
// Exact journeys using public TesterArmy APIs.
const test = createExactWebTest();

async function startGuest(ui: ExactWebUI) {
  const { app, screen: uiScreen, browser } = ui;
  await app.open('/');
  await expect(uiScreen.getByTestId('screen.onboarding')).toBeVisible();
  await uiScreen.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withExactDialog(browser, 'accept', () => uiScreen.getByTestId('btn.onboarding.feature.close').click());
  }
  await uiScreen.getByTestId('btn.onboarding.skip').click();
  await expect(uiScreen.getByTestId('screen.recording')).toBeVisible();
}

async function openSettings(ui: ExactWebUI) {
  const { screen: uiScreen } = ui;
  const homeTab = uiScreen.getByTestId(/^(btn.recording.home|tab.home)$/, { visible: true });
  if (await homeTab.isVisible()) await homeTab.click();
  else await uiScreen.getByTestId(/^(btn.recording.home|tab.home)$/, { visible: true }).click();
  await uiScreen.getByTestId('btn.header.home.settings').click();
  await uiScreen.getByTestId('quick-settings.all').click();
}

async function selectProfile(ui: ExactWebUI, profile: 'new' | 'existing' | 'plus') {
  const { screen: uiScreen } = ui;
  await startGuest(ui);
  await openSettings(ui);
  await uiScreen.getByTestId('settings-account-open-signin').click();
  await uiScreen.getByTestId(`btn.mockProfile.${profile}`).click();
  await expect(uiScreen.getByTestId('screen.recording')).toBeVisible();
}

async function journal(ui: ExactWebUI) {
  const { screen: uiScreen } = ui;
  const back = uiScreen.getByTestId('btn.navigateJournal');
  if (await back.isVisible()) await back.click();
  else {
    if (!await uiScreen.getByTestId('tab.journal', { visible: true }).isVisible()) {
      await uiScreen.getByTestId(/^(btn.recording.home|tab.home)$/, { visible: true }).click();
    }
    await uiScreen.getByTestId('tab.journal', { visible: true }).click();
  }
  await expect(uiScreen.getByTestId('screen.journal', { visible: true })).toHaveCount(1);
}

async function search(ui: ExactWebUI, value: string) {
  const { screen: uiScreen } = ui;
  await uiScreen.getByRole('textbox', { name: 'Search dreams…' }).fill(value);
}

async function openDream(ui: ExactWebUI, title: string) {
  const { screen: uiScreen } = ui;
  await search(ui, title);
  const card = uiScreen.getByTestId(/^dream\.item\./, { visible: true }).filter({ hasText: title });
  await expect(card).toHaveCount(1);
  await card.click();
  await expect(uiScreen.getByTestId('component.transcriptCard')).toBeVisible();
  await uiScreen.getByTestId('component.transcriptCard').scrollIntoView();
}

test('guest can start a first dream from onboarding', async (ui) => {
  const { screen: uiScreen } = ui;
  await startGuest(ui);
  await expect(uiScreen.getByTestId('btn.saveDream')).toBeDisabled();
});

test('guest keeps the same draft when switching capture modes', async (ui) => {
  const { screen: uiScreen } = ui;
  await startGuest(ui);
  const transcript = uiScreen.getByTestId('input.dreamTranscript');
  await transcript.fill('E2E draft: a lighthouse above the sea.');
  await uiScreen.getByTestId('btn.recording.inputMode.voice').click();
  await uiScreen.getByTestId('btn.recording.inputMode.text').click();
  await expect(transcript).toHaveValue('E2E draft: a lighthouse above the sea.');
});

test('guest saves the first dream and can read its simulated analysis', async (ui) => {
  const { screen: uiScreen } = ui;
  await startGuest(ui);
  const story = 'E2E moonlit harbor with a golden lighthouse.';
  await uiScreen.getByTestId('input.dreamTranscript').fill(story);
  await uiScreen.getByTestId('btn.saveDream').click();
  await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText(story);
  await expect(uiScreen.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
  await expect(uiScreen.getByTestId('analysis.reading.modal')).toHaveCount(0);
  await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText(story);
});

test('free user saves a dream and finds the exact story in the journal', async (ui) => {
  const { screen: uiScreen } = ui;
  await selectProfile(ui, 'existing');
  const story = 'E2E sapphire lighthouse above the quiet ocean.';
  await uiScreen.getByTestId('input.dreamTranscript').fill(story);
  await uiScreen.getByTestId('btn.saveDream').click();
  await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText(story);
  await expect(uiScreen.getByTestId('btn.editDream')).toBeEnabled();
  await uiScreen.getByTestId('btn.editDream').click();
  await uiScreen.getByTestId('input.dreamTitle').fill('E2E sapphire lighthouse');
  await uiScreen.getByTestId('btn.saveDreamEdit').click();
  await journal(ui);
  await openDream(ui, 'E2E sapphire lighthouse');
  await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText(story);
});

// Retired 2026-10-14 (seal workflow, PR #358): the capture seal now waits for the dream's
// pre-analysis before its page opens, so in the browser's mock profile (0.5-1 s) the
// categorization always lands before an edit can start. "Background categorization preserves
// the metadata/transcript draft" stays covered on Android and iOS by the mock-persistent
// profile with EXPO_PUBLIC_MOCK_CATEGORIZATION_DELAY_MS=30000 (tools/e2e/NATIVE-MATRIX.md).

test('free user searches, sees no match, and recovers the journal', async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
  await browser.setViewport({ width: 390, height: 844 });
  await selectProfile(ui, 'existing');
  await journal(ui);
  await search(ui, 'The Infinite Library');
  await expect(uiScreen.getByTestId(/^dream\.item\./)).toHaveCount(1);
  await expect(uiScreen.getByTestId(/^dream\.item\./)).toContainText('The Infinite Library');
  await app.screenshot('journal-mobile-entry.png');
  await search(ui, 'E2E no such dream 93f82');
  await expect(uiScreen.getByTestId(/^dream\.item\./)).toHaveCount(0);
  await search(ui, 'The Infinite Library');
  await expect(uiScreen.getByTestId(/^dream\.item\./)).toHaveCount(1);
});

test('a search typed in a scrolled journal keeps its field until the user scrolls', async (ui) => {
  const { screen: uiScreen, browser } = ui;
  await browser.setViewport({ width: 390, height: 844 });
  await selectProfile(ui, 'existing');
  await journal(ui);
  await browser.mouse.move(195, 640);
  await browser.mouse.wheel(0, 400);
  await expect.poll(() => readDOM(browser, byId('list.dreams'), (node) => node.scrollTop)).toBeGreaterThan(0);
  // Wheel dispatch returns before its final scroll events. Let that user
  // gesture settle before focusing; the letter-driven return below must still
  // preserve focus, and the later user wheel must still dismiss it.
  let previousOffset = -1;
  let settledReads = 0;
  await expect.poll(async () => {
    const offset = await readDOM(browser, byId('list.dreams'), node => node.scrollTop);
    settledReads = offset === previousOffset ? settledReads + 1 : 0;
    previousOffset = offset;
    return settledReads;
  }, { interval: 100, timeout: 5000 }).toBeGreaterThanOrEqual(3);
  // Each letter brings the results back to the top; that return must not take the field away.
  const field = uiScreen.getByRole('textbox', { name: 'Search dreams…' });
  await field.focus();
  await expect(field).toBeFocused();
  await field.pressSequentially('The Infinite Library', { delay: 40 });
  await expect(field).toHaveValue('The Infinite Library');
  await expect(field).toBeFocused();
  await expect(uiScreen.getByTestId(/^dream\.item\./)).toHaveCount(1);
  await expect(uiScreen.getByTestId(/^dream\.item\./)).toContainText('The Infinite Library');
  // A gesture that does not move the list (a sideways wheel) leaves the field: wait past
  // the list's dismissal window and the web scroller's end of scroll, then check.
  const resting = await readDOM(browser, byId('list.dreams'), (node) => node.scrollTop);
  await browser.mouse.move(195, 640);
  await browser.mouse.wheel(120, 0);
  await browser.evaluate(() => new Promise<null>(resolve => setTimeout(() => resolve(null), 400)));
  expect(await readDOM(browser, byId('list.dreams'), (node) => node.scrollTop)).toBe(resting);
  await expect(field).toBeFocused();
  // The user scrolling the whole journal puts the keyboard away, as a drag does natively.
  await field.fill('');
  await expect.poll(() => readDOM(browser, byId('list.dreams'), (node) => node.scrollTop)).toBe(0);
  await browser.mouse.move(195, 640);
  await browser.mouse.wheel(0, 400);
  await expect.poll(() => readDOM(browser, byId('list.dreams'), (node) => node.scrollTop)).toBeGreaterThan(0);
  await expect(field).not.toBeFocused();
});

test('free user edits a story, cancels deletion, then deletes only that dream', async (ui) => {
  const { screen: uiScreen } = ui;
  await selectProfile(ui, 'existing');
  await journal(ui);
  await openDream(ui, 'The Infinite Library');
  await uiScreen.getByTestId('btn.editDream').click();
  await uiScreen.getByTestId('input.dreamTranscript').fill('E2E revised story: the library has a blue door.');
  await uiScreen.getByTestId('btn.saveDreamEdit').click();
  await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText('E2E revised story');
  await uiScreen.getByTestId('btn.dream.delete').click();
  await uiScreen.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText('E2E revised story');
  await uiScreen.getByTestId('btn.dream.delete').click();
  await uiScreen.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(uiScreen.getByTestId('screen.journal', { visible: true })).toHaveCount(1);
  await search(ui, 'The Infinite Library');
  await expect(uiScreen.getByTestId(/^dream\.item\./)).toHaveCount(0);
  await search(ui, 'Ocean of Stars');
  await expect(uiScreen.getByTestId(/^dream\.item\./)).toHaveCount(1);
});

test('free user can open the Plus offer and return without losing the journal', async (ui) => {
  const { screen: uiScreen } = ui;
  await selectProfile(ui, 'existing');
  await openSettings(ui);
  await uiScreen.getByTestId('settings-section-subscription').click();
  await expect(uiScreen.getByTestId('screen.paywall')).toBeVisible();
  await uiScreen.getByTestId('btn.paywall.selectMonthly').click();
  await expect(uiScreen.getByTestId('btn.paywall.selectMonthly')).toHaveAttribute('aria-checked', 'true');
  await uiScreen.getByTestId('btn.paywall.close').click();
  await expect(uiScreen.getByTestId('screen.paywall')).toBeHidden();
  await uiScreen.getByRole('button', { name: 'Back', exact: true }).click();
  await uiScreen.getByTestId('tab.journal', { visible: true }).click();
  await openDream(ui, 'The Infinite Library');
});

for (const profile of ['existing', 'plus'] as const) {
  test(`${profile === 'plus' ? 'Plus' : 'free'} user sees the matching analysis allowance`, async (ui) => {
  const { screen: uiScreen } = ui;
    await selectProfile(ui, profile);
    await openSettings(ui);
    if (profile === 'existing') {
      await expect(uiScreen.getByTestId('quota.analysisValue')).toContainText('/ 3');
      // One way to Plus in the card: its row, not a second upgrade button.
      await expect(uiScreen.getByRole('button', { name: 'Upgrade to Noctalia Plus', exact: true })).toHaveCount(0);
      await uiScreen.getByTestId('settings-section-subscription').click();
      await expect(uiScreen.getByTestId('screen.paywall')).toBeVisible();
    } else {
      await expect(uiScreen.getByTestId('quota.analysisValue')).toContainText('Unlimited');
    }
  });
}

test('Plus user signs out and returns to guest without exposing the account journal', async (ui) => {
  const { screen: uiScreen } = ui;
  await selectProfile(ui, 'plus');
  await openSettings(ui);
  await uiScreen.getByTestId('btn.auth.signOut').click();
  await expect(uiScreen.getByTestId('screen.recording')).toBeVisible();
  await openSettings(ui);
  await expect(uiScreen.getByTestId('settings-account-open-signin')).toBeVisible();
  await expect(uiScreen.getByTestId('btn.auth.signOut')).toHaveCount(0);
  await uiScreen.getByTestId('settings.back').click();
  await uiScreen.getByTestId('tab.journal', { visible: true }).click();
  await expect(uiScreen.getByTestId('journal-first-page')).toBeVisible();
  await expect(uiScreen.getByTestId(/^dream\.item\./, { visible: true })).toHaveCount(0);
});

test('free user adds and removes a favorite through the filtered journal', async (ui) => {
  const { screen: uiScreen } = ui;
  await selectProfile(ui, 'existing');
  await journal(ui);
  await openDream(ui, 'Garden in the Clouds');
  const transcript = uiScreen.getByTestId('component.transcriptCard');
  const originalStory = await transcript.textContent();
  expect(originalStory).toContain('I was walking through a beautiful garden');
  await uiScreen.getByTestId('btn.dream.favorite').click();
  await journal(ui);
  await uiScreen.getByRole('button', { name: 'Show favorites only', exact: true }).click();
  await openDream(ui, 'Garden in the Clouds');
  await uiScreen.getByTestId('btn.dream.favorite').click();
  await journal(ui);
  // Upstream 02a97ad08 retains the journal: a second Favorites click would clear its filter.
  await expect(uiScreen.getByRole('textbox', { name: 'Search dreams…' })).toHaveValue('Garden in the Clouds');
  await expect(uiScreen.getByTestId(/^dream\.item\./, { visible: true })).toHaveCount(0);
  await uiScreen.getByRole('button', { name: 'Show all dreams', exact: true }).click();
  await openDream(ui, 'Garden in the Clouds');
  await expect(transcript).toHaveText(originalStory!);
});

test('Plus user continues a reflection and sees the conversation on revisit', async (ui) => {
  const { screen: uiScreen, browser } = ui;
  await selectProfile(ui, 'plus');
  await journal(ui);
  await openDream(ui, 'The Infinite Library');
  await uiScreen.getByTestId('component.dreamDetail.actionCard').click();
  await uiScreen.getByTestId('btn.dreamCategory.freeChat').click();
  await uiScreen.getByTestId('chat.input.message').fill('E2E: why did the library feel so familiar?');
  await uiScreen.getByTestId('chat.button.send').click();
  const latest = uiScreen.getByRole('button', { name: 'Jump to latest', exact: true });
  if (await latest.isVisible()) await latest.click();
  await expect(uiScreen.getByText('E2E: why did the library feel so familiar?', { exact: true })).toBeVisible();
  await expectEditable(browser, byId('chat.input.message'));
  const answer = uiScreen.getByText(/^(That's an interesting question|Based on your dream,|Dreams like yours often|The elements you mentioned|I sense that this dream)/);
  await expect(answer).toBeVisible();
  const response = await answer.textContent();
  await uiScreen.getByRole('button', { name: 'Back', exact: true }).click();
  await uiScreen.getByTestId('btn.dreamCategory.freeChat').click();
  if (await latest.isVisible()) await latest.click();
  await expect(uiScreen.getByText('E2E: why did the library feel so familiar?', { exact: true })).toBeVisible();
  await expect(uiScreen.getByText(response!, { exact: true })).toBeVisible();
  await uiScreen.getByRole('button', { name: 'Back', exact: true }).click();
  await uiScreen.getByRole('button', { name: 'Back', exact: true }).click();
  // Returning can restore the previous scroll position without a new scroll
  // event. Read further in the inline analysis to reveal the contextual dock.
  const reading = uiScreen.getByTestId('component.dreamDetail.readingZone');
  await reading.scrollIntoView();
  await reading.hover();
  await browser.mouse.wheel(0, 200);
  await expect(uiScreen.getByTestId('component.dreamDetail.actionCard')).toContainText('Continue my reflection');
});

test('exhausted free account can keep a dream and decline the analysis offer', async (ui) => {
  const { screen: uiScreen } = ui;
  await selectProfile(ui, 'existing');
  const story = 'E2E saved even when my analysis allowance is exhausted.';
  await uiScreen.getByTestId('input.dreamTranscript').fill(story);
  await uiScreen.getByTestId('btn.saveDream').click();
  await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText(story);
  await uiScreen.getByTestId('btn.dream.primaryCta').click();
  await expect(uiScreen.getByTestId('screen.paywall')).toBeVisible();
  await uiScreen.getByTestId('btn.paywall.close').click();
  await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText(story);
  await expect(uiScreen.getByRole('button', { name: 'Read the full analysis', exact: true })).toHaveCount(0);
});

for (const profile of ['new', 'plus'] as const) {
  test(`${profile === 'new' ? 'fresh free' : 'Plus'} account can analyze a newly saved dream`, async (ui) => {
  const { screen: uiScreen } = ui;
    await selectProfile(ui, profile);
    const story = `E2E ${profile} traveler finds a lantern on a silver bridge.`;
    await uiScreen.getByTestId('input.dreamTranscript').fill(story);
    await uiScreen.getByTestId('btn.saveDream').click();
    // The journal asks during the seal; yes opens the page already reading the dream.
    await answerSeal(uiScreen, 'now');
    await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText(story);
    await expect(uiScreen.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
    await expect(uiScreen.getByTestId('analysis.reading.modal')).toHaveCount(0);
    await expect(uiScreen.getByTestId('screen.paywall')).toHaveCount(0);
    await expect(uiScreen.getByTestId('component.transcriptCard')).toContainText(story);
  });
}

test('reflection offers an optional recap after one angle and updates it after another exchange', async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
  await browser.emulateMedia({ reducedMotion: 'reduce' });
  await browser.setViewport({ width: 390, height: 867 });
  await selectProfile(ui, 'plus');
  await uiScreen.getByTestId(/^(btn.recording.home|tab.home)$/, { visible: true }).click();
  await uiScreen.getByTestId('btn.home.week.recap').click();
  await expect(uiScreen.getByTestId('screen.weeklyRecap')).toBeVisible();
  await uiScreen.getByTestId('btn.weeklyRecap.openDream').click();
  await expect(uiScreen.getByTestId('component.transcriptCard')).toBeVisible();
  await uiScreen.getByTestId('component.transcriptCard').scrollIntoView();
  await uiScreen.getByTestId('component.dreamDetail.actionCard').click();

  const categories = uiScreen.getByTestId('screen.dreamCategories');
  await expect(categories).toBeVisible();
  for (const angle of ['symbols', 'emotions', 'growth']) {
    await expect(uiScreen.getByTestId(`btn.dreamCategory.${angle}`)).toHaveCount(1);
  }
  await expect(uiScreen.getByTestId('btn.exploration360.synthesis')).toHaveCount(0);
  await uiScreen.getByTestId('btn.dreamCategory.readAnalysis').click();
  await expect(uiScreen.getByTestId('analysis.reading.body')).toContainText('The infinite library represents your vast inner knowledge and memories.');
  await uiScreen.getByTestId('analysis.reading.close').click();
  await app.screenshot('reflection-before-exchange.png');
  await uiScreen.getByTestId('btn.dreamCategory.symbols').click();
  const recap = uiScreen.getByTestId('btn.exploration360.synthesis', { visible: true });
  await expect(recap).toBeEnabled();
  await expect(recap).toHaveText(/Take stock/);
  await recap.click();
  await expect(uiScreen.getByText('Take stock of my dream', { exact: true, visible: true })).toBeVisible();
  await expect(uiScreen.getByTestId('text.reflection.recapCurrent', { visible: true })).toBeVisible();
  await expect(recap).toHaveCount(0);
  await uiScreen.getByTestId('quick-category-emotions').click();
  await expect(recap).toBeEnabled();
  await expect(recap).toHaveText(/Update recap/);
  await recap.click();
  await expect(uiScreen.getByText('Take stock of my dream', { exact: true, visible: true })).toHaveCount(2);
  await expect(uiScreen.getByTestId('text.reflection.recapCurrent', { visible: true })).toBeVisible();
  await expect(recap).toHaveCount(0);
  await uiScreen.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(categories).toBeVisible();
  // Explored angles remain accessible; reopening one must not send it again.
  await uiScreen.getByTestId('btn.dreamCategory.symbols').click();
  await expect(uiScreen.getByText('Take stock of my dream', { exact: true, visible: true })).toHaveCount(2);
  await expect(recap).toHaveCount(0);
  await uiScreen.getByRole('button', { name: 'Back', exact: true }).click();
  await app.screenshot('reflection-after-exchanges.png');
});

// Current owner-supported entry from #529: complete an angle, then the recap
// offers Plus directly and returns to the same reflection when declined.
test('free reflection opens Plus directly and declining returns to reflection without entering chat', async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
  await selectProfile(ui, 'existing');
  await journal(ui);
  await openDream(ui, 'The Infinite Library');
  await uiScreen.getByTestId('component.dreamDetail.actionCard').click();
  await uiScreen.getByTestId('btn.dreamCategory.symbols').click();
  await expect(uiScreen.getByTestId('btn.exploration360.synthesis', { visible: true })).toBeEnabled();
  await uiScreen.getByRole('button', { name: 'Back', exact: true }).click();
  const reflection = uiScreen.getByTestId('screen.dreamCategories', { visible: true });
  await expect(reflection).toBeVisible();
  await startNavigationAudit(browser);
  await reflection.getByTestId('btn.exploration360.synthesis').click();
  await expect(uiScreen.getByTestId('screen.paywall')).toBeVisible();
  const destinations = await browser.evaluate(() => JSON.parse(sessionStorage.getItem('dreamer.qa.navigation')!) as string[]);
  expect(destinations.some(path => /^\/dream-chat\//.test(path))).toBe(false);
  await app.screenshot('reflection-direct-plus.png');
  await uiScreen.getByTestId('btn.paywall.close').click();
  await expect(reflection).toBeVisible();
  await expect(browser).toHaveURL(/\/dream-categories\//);
  await expect(reflection.getByTestId('btn.exploration360.synthesis')).toBeEnabled();
  await app.screenshot('reflection-after-declining-plus.png');
});
