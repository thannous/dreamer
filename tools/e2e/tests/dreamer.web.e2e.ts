import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { fileURLToPath } from 'node:url';
import { isolateWeb } from '../web-fixtures';
import type { App, Screen } from 'e2e';

async function startGuest(app: App, screen: Screen) {
  await app.open();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  await screen.getByTestId('btn.onboarding.skip').tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
}

async function openSettings(screen: Screen) {
  const home = screen.getByTestId('tab.home', { visible: true });
  if (await home.isVisible()) await home.tap();
  else await screen.getByTestId('btn.recording.home', { visible: true }).tap();
  await screen.getByTestId('btn.header.home.settings', { visible: true }).tap();
  await screen.getByTestId('quick-settings.all', { visible: true }).tap();
}

async function selectProfile(app: App, screen: Screen, profile: 'existing' | 'plus') {
  await startGuest(app, screen);
  await openSettings(screen);
  await screen.getByTestId('settings-account-open-signin', { visible: true }).tap();
  await screen.getByTestId(`btn.mockProfile.${profile}`, { visible: true }).tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
}

async function journal(screen: Screen) {
  const back = screen.getByTestId('btn.navigateJournal', { visible: true });
  if (await back.isVisible()) await back.tap();
  else {
    if (!await screen.getByTestId('tab.journal', { visible: true }).isVisible())
      await screen.getByTestId('btn.recording.home', { visible: true }).tap();
    await screen.getByTestId('tab.journal', { visible: true }).tap();
  }
  await expect(screen.getByTestId('screen.journal', { visible: true })).toHaveCount(1);
}

async function openDream(screen: Screen, title: string) {
  await screen.getByRole('textbox', 'Search dreams…', { visible: true }).fill(title);
  const card = screen.getByTestId(/^dream\.item\./, { visible: true }).filter({ hasText: title });
  await expect(card).toHaveCount(1);
  await card.tap();
  await expect(screen.getByTestId('component.transcriptCard', { visible: true })).toBeVisible();
}

test('guest saves the exact story and reads its simulated analysis inline', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await startGuest(app, screen);
  const story = 'E2E moonlit harbor with a golden lighthouse.';
  // The first analysis asks once for permission to send the dream to the AI provider.
  const consentPrompts: string[] = [];
  const offConsent = await browser.onDialog(async (dialog) => {
    consentPrompts.push(dialog.message);
    await dialog.accept();
  });
  await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
  await screen.getByTestId('btn.saveDream', { visible: true }).tap();
  await expect(screen.getByTestId('component.transcriptCard', { visible: true })).toContainText(story);
  const reading = screen.getByTestId('component.dreamDetail.readingZone', { visible: true });
  await expect(reading).toContainText('Analysis');
  await expect(reading).toContainText('Symbols');
  expect((await reading.textContent() ?? '').length).toBeGreaterThan(100);
  await expect(screen.getByTestId('analysis.reading.modal')).toHaveCount(0);
  expect(consentPrompts).toHaveLength(1);
  expect(consentPrompts[0]).toMatch(/third-party AI service/);
  await offConsent();
  await app.screenshot('guest-saved-analysis');
});

test('free user saves, renames and finds the exact story in Journal', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await selectProfile(app, screen, 'existing');
  const story = 'E2E sapphire lighthouse above the quiet ocean.';
  await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
  await screen.getByTestId('btn.saveDream', { visible: true }).tap();
  await expect(screen.getByTestId('component.transcriptCard', { visible: true })).toContainText(story);
  await screen.getByTestId('btn.editMetadata', { visible: true }).tap();
  await screen.getByTestId('input.dreamTitle', { visible: true }).fill('E2E sapphire lighthouse');
  await screen.getByTestId('btn.editMetadata', { visible: true }).tap();
  await journal(screen);
  await openDream(screen, 'E2E sapphire lighthouse');
  await expect(screen.getByTestId('component.transcriptCard', { visible: true })).toContainText(story);
  await app.screenshot('saved-story-found-in-journal');
});

// Act I of the dream story: the arrival from capture opens on the saved moment once,
// and its single primary next step follows the analysis permission.
for (const profile of ['plus', 'existing'] as const) {
  test(`${profile} account lands once on the saved moment with its next step`, async ({ app, screen, browser }) => {
    await isolateWeb(browser, app);
    await selectProfile(app, screen, profile);
    // One run per theme: the moment's sky, orbit and dock fade must hold on both grounds.
    if (profile === 'existing') {
      await screen.getByRole('button', /^(Settings|Paramètres)$/, { visible: true }).tap();
      const light = screen.getByTestId('quick-settings.theme.light', { visible: true });
      await light.tap();
      await expect(light).toHaveAttribute('aria-checked', 'true');
      await screen.getByTestId('quick-settings.close', { visible: true }).tap();
    }
    const story = `E2E ${profile} silver owl above a sleeping mountain.`;
    await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
    await screen.getByTestId('btn.saveDream', { visible: true }).tap();
    // Prologue: the saved draft condenses into a star before its page opens.
    await expect(screen.getByTestId('component.recording.dreamSeal')).toHaveCount(1);
    const moment = screen.getByTestId('component.dreamDetail.savedMoment', { visible: true });
    await expect(moment).toContainText(/dream saved/i);
    // The moment is the confirmation: no second toast announces the save.
    await expect(screen.getByTestId('text.recording.saveConfirmation')).toHaveCount(1);
    await expect(screen.getByTestId('component.transcriptCard', { visible: true })).toContainText(story);
    await expect(screen.getByTestId('component.dreamRecall.offer', { visible: true })).toContainText('Remember a little more?');
    const analysis = screen.getByTestId('btn.dream.primaryCta', { visible: true });
    const back = screen.getByTestId('btn.savedDream.returnToJournal', { visible: true });
    await expect(analysis).toBeVisible();
    await expect(back).toContainText('Back to journal');
    const [analysisBox, backBox] = [await analysis.boundingBox(), await back.boundingBox()];
    // Included analysis continues the story; otherwise the journal stays first.
    if (profile === 'plus') {
      await expect(analysis).toContainText('Analyze this dream');
      expect(analysisBox!.y).toBeLessThan(backBox!.y);
    } else expect(backBox!.y).toBeLessThan(analysisBox!.y);
    // The arrival is authored motion: record the settled moment, not one of its frames.
    await expect.poll(() => browser.evaluate(() => document.getAnimations().filter(animation =>
      animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity).length)).toBe(0);
    await app.screenshot(`${profile}-saved-moment`);
    // The end of the page lifts the story and the recall question above the action dock.
    await screen.getByTestId('btn.dream.delete').scrollIntoView();
    await app.screenshot(`${profile}-saved-story-and-recall`);
    await back.tap();
    await expect(screen.getByTestId('screen.journal', { visible: true })).toHaveCount(1);
    await screen.getByRole('textbox', 'Search dreams…', { visible: true }).fill(`${profile} silver owl`);
    const card = screen.getByTestId(/^dream\.item\./, { visible: true });
    await expect(card).toHaveCount(1);
    await card.tap();
    await expect(screen.getByTestId('component.transcriptCard', { visible: true })).toContainText(story);
    await expect(screen.getByTestId('component.dreamDetail.savedMoment')).toHaveCount(0);
    await app.screenshot(`${profile}-revisit-without-moment`);
  });
}

/** Authored entrances only: the waiting loop never settles and is not waited for. */
async function settledMotion(browser: Parameters<typeof isolateWeb>[0]) {
  await expect.poll(() => browser.evaluate(() => document.getAnimations().filter(animation =>
    animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity).length)).toBe(0);
}

// Act II of the dream story: the analysis is visibly waited for, then the dream's real
// symbols land as a constellation and the reading is brought into view, once.
test('plus account watches its saved dream being read, then lit as a constellation', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await selectProfile(app, screen, 'plus');
  // The first analysis asks once for permission to send the dream to the AI provider.
  const offConsent = await browser.onDialog(async (dialog) => { await dialog.accept(); });
  const story = 'E2E lantern drifting over dark water toward a doorway of light.';
  await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
  await screen.getByTestId('btn.saveDream', { visible: true }).tap();
  await expect(screen.getByTestId('component.dreamDetail.savedMoment', { visible: true })).toBeVisible();
  await screen.getByTestId('btn.dream.primaryCta', { visible: true }).tap();
  const wait = screen.getByTestId('component.dreamDetail.readingWait');
  await expect(wait).toContainText('Noctalia is reading your dream…');
  await expect(wait).toContainText('Its symbols and emotions will appear here.');
  await settledMotion(browser);
  await app.screenshot('plus-dream-being-read');
  // The mock reading names three symbols; the constellation draws exactly those.
  const constellation = screen.getByTestId('component.dreamDetail.constellation', { visible: true });
  for (const symbol of ['Water', 'Light', 'Doorway']) await expect(constellation).toContainText(symbol);
  await expect(screen.getByTestId('component.dreamDetail.readingWait')).toHaveCount(0);
  await expect(screen.getByTestId('component.dreamDetail.readingZone', { visible: true })).toContainText('Symbols');
  await offConsent();
  await settledMotion(browser);
  const landed = await constellation.boundingBox();
  // The reading landed below the story: it was brought into view rather than left off-screen.
  expect(landed!.y).toBeGreaterThan(0);
  expect(landed!.y + landed!.height).toBeLessThan(844);
  await app.screenshot('plus-reading-constellation');
  // The reading ends on its questions and the dream's own line.
  expect(await browser.evaluate(() => {
    const questions = document.querySelector('[data-testid="component.dreamDetail.reflectionZone"]');
    questions?.scrollIntoView({ block: 'center' });
    return Boolean(questions);
  })).toBe(true);
  const quote = screen.getByTestId('text.dreamDetail.quote', { visible: true });
  await expect(quote).toContainText('«');
  // The last chapter enters after the others; wait until the reader can actually see it.
  await expect.poll(() => browser.evaluate(() => {
    let node: Element | null = document.querySelector('[data-testid="text.dreamDetail.quote"]');
    let opacity = 1;
    for (; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
    return opacity;
  })).toBe(1);
  await app.screenshot('plus-reading-chapters');
  // A return visit shows the constellation lit at once, with no story replayed.
  await journal(screen);
  await screen.getByRole('textbox', 'Search dreams…', { visible: true }).fill('lantern drifting');
  const card = screen.getByTestId(/^dream\.item\./, { visible: true });
  await expect(card).toHaveCount(1);
  await card.tap();
  await expect(screen.getByTestId('component.dreamDetail.constellation')).toContainText('Doorway');
  await expect(screen.getByTestId('component.dreamDetail.savedMoment')).toHaveCount(0);
  expect(await browser.evaluate(() => [...document.querySelectorAll('[data-testid="component.dreamDetail.constellation"]')]
    .reduce((count, node) => count + node.getAnimations({ subtree: true }).length, 0))).toBe(0);
  await app.screenshot('plus-revisit-constellation-at-rest');
});

test('free user recovers empty search, edits, cancels deletion and deletes only one dream', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await selectProfile(app, screen, 'existing');
  await journal(screen);
  const search = screen.getByRole('textbox', 'Search dreams…', { visible: true });
  await search.fill('E2E no such dream 93f82');
  await expect(screen.getByTestId(/^dream\.item\./, { visible: true })).toHaveCount(0);
  await openDream(screen, 'The Infinite Library');
  const story = 'E2E revised story: the library has a blue door.';
  await screen.getByTestId('btn.editTranscript', { visible: true }).tap();
  await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
  await screen.getByTestId('btn.editTranscript', { visible: true }).tap();
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
  await selectProfile(app, screen, 'existing');
  await journal(screen);
  await openDream(screen, 'Garden in the Clouds');
  await screen.getByTestId('btn.dream.favorite', { visible: true }).tap();
  await journal(screen);
  await screen.getByRole('button', 'Show favorites only', { visible: true }).tap();
  await openDream(screen, 'Garden in the Clouds');
  await screen.getByTestId('btn.dream.favorite', { visible: true }).tap();
  await journal(screen);
  await screen.getByRole('button', 'Show favorites only', { visible: true }).tap();
  await screen.getByRole('textbox', 'Search dreams…', { visible: true }).fill('Garden in the Clouds');
  await expect(screen.getByTestId(/^dream\.item\./, { visible: true })).toHaveCount(0);
  await screen.getByRole('button', 'Show all dreams', { visible: true }).tap();
  await openDream(screen, 'Garden in the Clouds');
  await app.screenshot('favorite-removal-keeps-story');
});

test('exhausted free account keeps its story when declining the analysis offer', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await selectProfile(app, screen, 'existing');
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
    await selectProfile(app, screen, profile);
    await openSettings(screen);
    // The populated historical fixture contains exactly five completed analyses.
    await expect(screen.getByTestId('quota.analysisValue', { visible: true })).toHaveText(profile === 'plus' ? 'Unlimited' : '5 / 3');
    const upgrade = screen.getByRole('button', 'Upgrade to Noctalia Plus', { visible: true });
    if (profile === 'existing') {
      await upgrade.tap();
      await screen.getByTestId('btn.paywall.selectMonthly', { visible: true }).tap();
      await expect(screen.getByTestId('btn.paywall.selectMonthly', { visible: true })).toHaveAttribute('aria-checked', 'true');
      await screen.getByTestId('btn.paywall.close', { visible: true }).tap();
    } else await expect(upgrade).toHaveCount(0);
    await screen.getByTestId('btn.auth.signOut', { visible: true }).tap();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
    await openSettings(screen);
    await expect(screen.getByTestId('settings-account-open-signin', { visible: true })).toBeVisible();
    await expect(screen.getByTestId('btn.auth.signOut')).toHaveCount(0);
    await screen.getByTestId('settings.back', { visible: true }).tap();
    await journal(screen);
    await expect(screen.getByTestId('journal-first-page', { visible: true })).toBeVisible();
    await expect(screen.getByTestId(/^dream\.item\./, { visible: true })).toHaveCount(0);
    await app.screenshot(`${profile}-signout-isolates-journal`);
  });
}

test('onboarding prevents an empty save and capture preserves the draft', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await app.open();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  await screen.getByTestId('btn.onboarding.skip').tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('btn.saveDream')).toBeDisabled();
  const story = 'E2E lighthouse above a quiet sea.';
  await screen.getByTestId('input.dreamTranscript').fill(story);
  await screen.getByTestId('btn.recording.inputMode.voice').tap();
  await screen.getByTestId('btn.recording.inputMode.text').tap();
  await expect(screen.getByTestId('input.dreamTranscript')).toHaveValue(story);
  await expect(screen.getByTestId('btn.saveDream')).toBeEnabled();
  await app.screenshot('draft-preserved');
});

test('Quick Settings changes language and theme without losing the Capture draft', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await app.open();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  await screen.getByTestId('btn.onboarding.skip').tap();
  await screen.getByTestId('btn.recording.inputMode.text', { visible: true }).tap();
  const editor = screen.getByTestId('input.dreamTranscript', { visible: true });
  const draft = 'Fixture : un phare bleu au-dessus d’une mer calme.';
  await editor.fill(draft);
  const settings = screen.getByRole('button', /^(Settings|Paramètres)$/, { visible: true });
  // A closed drawer must not expose interactive preferences to assistive technology.
  await expect(screen.getByRole('radio')).toHaveCount(0);
  await settings.tap();
  await expect(screen.getByTestId('quick-settings.close', { visible: true })).toBeEnabled();
  await screen.getByTestId('quick-settings.language', { visible: true }).tap();
  const french = screen.getByTestId('quick-settings.language.fr', { visible: true });
  await french.tap();
  await expect(french).toHaveAttribute('aria-checked', 'true');
  await screen.getByTestId('quick-settings.close', { visible: true }).tap();
  await expect(screen.getByRole('radio')).toHaveCount(0);
  await expect(screen.getByTestId('btn.recording.inputMode.text', { visible: true })).toContainText('Écrire');
  for (const [theme, background] of [['dark', 'rgb(20, 19, 26)'], ['light', 'rgb(245, 234, 219)']]) {
    await browser.setViewport({ width: theme === 'dark' ? 390 : 1280, height: 844 });
    // Desktop Capture returns to Today for the Settings control.
    if (theme === 'light') {
      await screen.getByTestId('tab.home', { visible: true }).tap();
      await screen.getByTestId('btn.header.home.settings', { visible: true }).tap();
    } else await settings.tap();
    await expect(screen.getByTestId('quick-settings.close', { visible: true })).toBeEnabled();
    const choice = screen.getByTestId(`quick-settings.theme.${theme}`, { visible: true });
    await expect(choice).toBeEnabled();
    await choice.tap();
    await expect(choice).toHaveAttribute('aria-checked', 'true');
    await screen.getByTestId('quick-settings.close', { visible: true }).tap();
    await expect(screen.getByRole('radio')).toHaveCount(0);
    if (theme === 'light') await screen.getByTestId('btn.home.today.cta', { visible: true }).tap();
    await expect.poll(() => browser.evaluate(() => {
      const input = document.querySelector('[data-testid="input.dreamTranscript"]');
      return input ? getComputedStyle(input).backgroundColor : null;
    })).toBe(background);
    await expect(editor).toHaveValue(draft);
    await app.screenshot(`quick-settings-${theme}`);
  }
  await browser.reload();
  await expect(screen.getByTestId('btn.recording.inputMode.text', { visible: true })).toContainText('Écrire');
  await expect(editor).toHaveValue(draft);
  await app.screenshot('quick-settings-persisted-after-reload');
});

test('the onboarding story bridges capture to understanding and exploration', {
  skip: process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED !== 'true'
    ? 'Feature presentations require an explicit opt-in bundle.' : false,
}, async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await app.open();
  await screen.getByTestId('btn.onboarding.feature.capture').tap();
  await screen.getByTestId('btn.onboarding.story.skip').tap();
  await expect(screen.getByTestId('component.onboarding.story.capture.3')).toBeVisible();
  await screen.getByTestId('btn.onboarding.globeCard.1').tap();
  await expect(screen.getByTestId('component.onboarding.dreamEntry')).toContainText('Flying over the harbour');
  await screen.getByTestId('btn.onboarding.story.continue').tap();
  await expect(screen.getByText('Once your dream is saved…')).toBeVisible();
  await screen.getByTestId('btn.onboarding.story.next').tap();
  await expect(screen.getByText('you can find the details that return…')).toBeVisible();
  await screen.getByTestId('btn.onboarding.story.next').tap();
  await expect(screen.getByText('and discover what connects your nights.')).toBeVisible();
  await app.screenshot('capture-story-bridge');
  await screen.getByTestId('btn.onboarding.story.continue').tap();
  await expect(screen.getByTestId('component.onboarding.story.connect.0')).toBeVisible();
  await screen.getByTestId('btn.onboarding.story.skip').tap();
  await screen.getByTestId('btn.onboarding.story.continue').tap();
  await expect(screen.getByTestId('component.onboarding.story.explore.0')).toBeVisible();
  await screen.getByTestId('btn.onboarding.story.skip').tap();
  await screen.getByTestId('btn.onboarding.story.continue').tap();
  await expect(screen.getByTestId('sheet.onboarding.feature')).toHaveCount(0);
  await expect(screen.getByTestId('component.onboarding.intro')).toBeVisible();
  await app.screenshot('onboarding-story-complete');
});

test('Quick Settings keeps interior taps open and accepts every sign-in button edge', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await app.open();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  await screen.getByTestId('btn.onboarding.skip').tap();
  const settings = screen.getByRole('button', 'Settings', { visible: true });
  const drawer = screen.getByTestId('quick-settings.drawer', { visible: true });
  const signIn = screen.getByTestId('quick-settings.signin', { visible: true });
  await settings.tap();
  await expect(signIn).toBeEnabled();
  const viewportWidth = await browser.evaluate(() => window.innerWidth);
  await expect.poll(async () => {
    const bounds = (await drawer.boundingBox())!;
    return Math.round(bounds.x + bounds.width);
  }).toBe(viewportWidth);
  const panel = (await drawer.boundingBox())!;
  const initialButton = (await signIn.boundingBox())!;
  expect(initialButton.height).toBeGreaterThanOrEqual(56);
  // Tap the drawer margin, away from every button's expanded hit target.
  await screen.tapAt({ x: panel.x + 4, y: initialButton.y + initialButton.height / 2 });
  await expect(drawer).toBeVisible();
  await expect(signIn).toBeEnabled();
  await app.screenshot('quick-settings-interior-tap');
  // The exposed strip remains an explicit dismissal target.
  await screen.tapAt({ x: panel.x / 2, y: initialButton.y });
  await expect(screen.getByRole('radio')).toHaveCount(0);
  for (const edge of ['left', 'right', 'bottom']) {
    await settings.tap();
    await expect(signIn).toBeEnabled();
    const bounds = (await signIn.boundingBox())!;
    const point = edge === 'left' ? { x: bounds.x + 2, y: bounds.y + bounds.height / 2 }
      : edge === 'right' ? { x: bounds.x + bounds.width - 2, y: bounds.y + bounds.height / 2 }
        : { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height - 2 };
    await signIn.tap({ position: { x: point.x - bounds.x, y: point.y - bounds.y } });
    await expect(screen.getByTestId('screen.account', { visible: true })).toBeVisible();
    await expect(screen.getByTestId('btn.auth.signIn', { visible: true })).toBeVisible();
    await app.screenshot(`quick-settings-signin-${edge}`);
    await app.back();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  }
});

// The mock paints with remote placeholder images, which isolation blocks. Serve one of
// the app's own paintings instead so the landing is deterministic and actually visible.
const MOCK_PAINTING = fileURLToPath(new URL('../../../assets/images/onboarding-reverie-background.webp', import.meta.url));

// Act III and the epilogue: the illustration is painted into the window and the page
// without moving what the reader sees; the journal card glows once; the next visit opens
// on the cover.
test('plus account watches its dream painted into the window, then finds it glowing in the journal', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await browser.route('https://picsum.photos/**', route => route.fulfill({ path: MOCK_PAINTING, contentType: 'image/webp' }));
  await selectProfile(app, screen, 'plus');
  const offConsent = await browser.onDialog(async (dialog) => { await dialog.accept(); });
  const story = 'E2E painted harbor where the lanterns float above the tide.';
  await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
  await screen.getByTestId('btn.saveDream', { visible: true }).tap();
  await screen.getByTestId('btn.dream.primaryCta', { visible: true }).tap();
  await expect(screen.getByTestId('component.dreamDetail.constellation', { visible: true })).toContainText('Doorway');
  await offConsent();
  await settledMotion(browser);
  await screen.getByTestId('btn.journal.illustrate').scrollIntoView();
  await screen.getByTestId('btn.journal.illustrate', { visible: true }).tap();
  const canvas = screen.getByTestId('journal.detail.image.generation_dots');
  await expect(canvas).toContainText('Noctalia is painting your dream…');
  await app.screenshot('plus-dream-being-painted');
  const readingZone = screen.getByTestId('component.dreamDetail.readingZone', { visible: true });
  const readingBefore = await readingZone.boundingBox();
  const painted = screen.getByTestId('component.dreamDetail.paintedArtwork', { visible: true });
  await expect(painted).toBeVisible();
  await expect(screen.getByTestId('journal.detail.image.generation_dots')).toHaveCount(0);
  await expect(screen.getByTestId('component.dreamDetail.savedMoment.artwork')).toHaveCount(1);
  // Nothing above the reading moved: no cover was inserted over the page being read.
  expect((await readingZone.boundingBox())!.y).toBe(readingBefore!.y);
  await settledMotion(browser);
  await app.screenshot('plus-painting-landed-in-page');
  const open = screen.getByTestId('btn.dreamDetail.savedMoment.open');
  await open.scrollIntoView();
  await settledMotion(browser);
  await app.screenshot('plus-painting-in-the-window');
  await open.tap();
  await expect(screen.getByTestId('modal.journal.illustration.fullscreen', { visible: true })).toBeVisible();
  await screen.getByTestId('btn.journal.illustration.close', { visible: true }).tap();
  await expect(screen.getByTestId('modal.journal.illustration.fullscreen')).toHaveCount(0);
  // Epilogue: the card of the dream just told glows once in the journal, then rests.
  await screen.getByTestId('btn.navigateJournal', { visible: true }).tap();
  await expect(screen.getByTestId('screen.journal', { visible: true })).toHaveCount(1);
  const halo = screen.getByTestId('component.journal.storyHalo');
  await expect(halo).toHaveCount(1);
  // Record the glow at its peak, a third of the way through its single pass.
  await expect.poll(() => browser.evaluate(() => Number(getComputedStyle(
    document.querySelector('[data-testid="component.journal.storyHalo"]') ?? document.body).opacity))).toBeGreaterThan(0.8);
  await app.screenshot('plus-journal-epilogue-glow');
  await expect(halo).toHaveCount(0);
  // The next visit opens on the cover, at rest.
  await screen.getByRole('textbox', 'Search dreams…', { visible: true }).fill('lanterns float');
  const card = screen.getByTestId(/^dream\.item\./, { visible: true });
  await expect(card).toHaveCount(1);
  await card.tap();
  await expect(screen.getByTestId('btn.journal.illustration.expand', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('component.dreamDetail.paintedArtwork')).toHaveCount(0);
  await expect(screen.getByTestId('component.dreamDetail.savedMoment')).toHaveCount(0);
  await expect(screen.getByTestId('component.journal.storyHalo')).toHaveCount(0);
  await app.screenshot('plus-revisit-opens-on-cover');
});
