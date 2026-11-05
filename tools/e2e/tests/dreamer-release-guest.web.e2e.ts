import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { isolateWeb } from '../web-fixtures';
import { MOCK_PAINTING, answerAiConsent, imageShown, journal, leaveGuidedStories, openQuickSettings, startGuest } from '../dreamer-release-fixtures';

// Owner rule (2026-10-25): only a guest's first dream is read and illustrated unasked, once
// the AI is allowed; each later dream waits for the guest, the seal offering its reading.
test('guest reads and sees its first dream illustrated unasked, then is offered the next reading', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await browser.route('https://picsum.photos/**', route => route.fulfill({ path: MOCK_PAINTING, contentType: 'image/webp' }));
  await startGuest(app, screen, browser);
  // Remember whether the journal ever asks to read, however briefly: the first dream is not asked.
  await browser.evaluate(() => {
    const w = window as unknown as { __readingAsked: boolean };
    w.__readingAsked = false;
    new MutationObserver(() => {
      w.__readingAsked ||= Boolean(document.querySelector('[data-testid="btn.dreamCaptureSeal.readNow"]'));
    }).observe(document.body, { childList: true, subtree: true });
    return null;
  });
  const story = 'E2E moonlit harbor with a golden lighthouse.';
  // Revised 2026-10-19 (was: guests are not asked, owner decision 2026-10-10): App Review
  // guideline 5.1.2(i) needs permission before a guest's dream reaches the AI providers too.
  await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
  await screen.getByTestId('btn.saveDream', { visible: true }).tap();
  await answerAiConsent(screen, 'accept');
  await expect(screen.getByTestId('component.transcriptCard', { visible: true })).toContainText(story);
  const reading = screen.getByTestId('component.dreamDetail.readingZone', { visible: true });
  // Revised 2026-10-16 (was 'Analysis'): the page is set as a book, its section names in
  // spaced capitals, so the visible heading reads "ANALYSIS".
  await expect(reading).toContainText(/Analysis/i);
  await expect(reading).toContainText('Symbols');
  expect((await reading.textContent() ?? '').length).toBeGreaterThan(100);
  await expect(screen.getByTestId('analysis.reading.modal')).toHaveCount(0);
  // Asked once: the reading does not ask again.
  await expect(screen.getByTestId('modal.aiConsent')).toHaveCount(0);
  await app.screenshot('guest-saved-analysis');
  // Its illustration is painted in the seal's window, unasked, then shown on the page's plate.
  await expect(screen.getByTestId('component.dreamDetail.savedMoment.artwork')).toHaveCount(1);
  await expect.poll(() => imageShown(browser, 'component.dreamDetail.savedMoment.artwork')).toBe(true);
  // It waits in the seal until the reader has the seal in sight, then leaves it for the plate.
  await screen.getByTestId('component.dreamDetail.savedMoment').scrollIntoView();
  const plate = screen.getByTestId('btn.journal.illustration.expand');
  await expect(plate).toHaveCount(1);
  await expect.poll(() => imageShown(browser, 'btn.journal.illustration.expand')).toBe(true);
  await expect(screen.getByTestId('component.dreamDetail.savedMoment.painting')).toHaveCount(0);
  expect(await browser.evaluate(() => (window as unknown as { __readingAsked: boolean }).__readingAsked)).toBe(false);
  await plate.scrollIntoView();
  await app.screenshot('guest-first-dream-illustrated-unasked');

  // The second dream is sealed with the offer of its reading, and nothing reads it meanwhile.
  await journal(screen);
  await screen.getByTestId('tab.addDream', { visible: true }).tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  const next = 'E2E second dream of a paper boat crossing a silver river.';
  await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(next);
  await screen.getByTestId('btn.saveDream', { visible: true }).tap();
  await expect(screen.getByTestId('component.recording.dreamSeal')).toHaveCount(1);
  await expect(screen.getByRole('heading', 'Run an analysis to understand this dream?', { visible: true })).toBeVisible();
  const readNow = screen.getByTestId('btn.dreamCaptureSeal.readNow', { visible: true });
  await expect(readNow).toBeEnabled();
  // The seal holds on its question: the page does not open, the dream is not read.
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await expect(readNow).toBeEnabled();
  await expect(screen.getByTestId('component.dreamDetail.savedMoment')).toHaveCount(0);
  await expect(screen.getByTestId('component.dreamDetail.readingWait')).toHaveCount(0);
  await app.screenshot('guest-second-dream-offered');
  await screen.getByTestId('btn.dreamCaptureSeal.readLater', { visible: true }).tap();
  const moment = screen.getByTestId('component.dreamDetail.savedMoment', { visible: true });
  await expect(screen.getByTestId('component.transcriptCard', { visible: true })).toContainText(next);
  // The page keeps the offer on the seal and stays unread.
  await expect(moment.getByTestId('btn.dream.primaryCta')).toContainText(/analyze this dream/i);
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await expect(screen.getByTestId('component.dreamDetail.readingWait')).toHaveCount(0);
  await expect(screen.getByTestId('component.dreamDetail.constellation')).toHaveCount(0);
  await expect(screen.getByTestId('component.dreamDetail.savedMoment.painting')).toHaveCount(0);
  await expect(screen.getByTestId('component.dreamDetail.savedMoment.artwork')).toHaveCount(0);
  await expect(screen.getByTestId('modal.aiConsent')).toHaveCount(0);
  await app.screenshot('guest-second-dream-unread');
});

// App Review (2026-10-19): each card leads with the amount billed, and a guest reads why to
// sign in and the renewal terms before any purchase.
// The web, like Android, leads the annual card with its monthly equivalent and bills in the
// small line; only iOS leads with the billed amount (owner decision 2026-10-19).
test('guest Plus offer shows the yearly bill, the sign-in reason and the renewal terms', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await startGuest(app, screen, browser);
  await openQuickSettings(screen);
  await screen.getByTestId('quick-settings.plus', { visible: true }).tap();
  await expect(screen.getByTestId('screen.paywall', { visible: true })).toBeVisible();
  const annual = screen.getByTestId('btn.paywall.selectAnnual', { visible: true });
  await expect(annual.getByTestId('btn.paywall.selectAnnual.price')).toHaveText('€2.50');
  await expect(annual).toContainText('per month');
  await expect(annual.getByTestId('btn.paywall.selectAnnual.detail')).toHaveText('Billed 29,99 € yearly');
  await expect(screen.getByTestId('btn.paywall.selectMonthly.price', { visible: true })).toHaveText('4,99 €');
  await expect(screen.getByTestId('text.paywall.authReason', { visible: true }))
    .toHaveText('Sign in to unlock and sync your subscription across devices.');
  await expect(screen.getByTestId('text.paywall.storeNotice', { visible: true })).toContainText('renews automatically');
  await expect(screen.getByTestId('btn.paywall.termsOfUse', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('btn.paywall.restore', { visible: true })).toBeVisible();
  await app.screenshot('guest-plus-offer');
});

test('onboarding prevents an empty save and capture preserves the draft', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await app.open();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  await leaveGuidedStories(browser, screen);
  await screen.getByTestId('btn.onboarding.skip').tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('btn.saveDream')).toBeDisabled();
  const story = 'E2E lighthouse above a quiet sea.';
  await screen.getByTestId('input.dreamTranscript').fill(story);
  await screen.getByTestId('btn.recording.inputMode.voice').tap();
  // Telling continues the draft as a conversation: its first question asks for AI consent.
  // Declining keeps the draft and the general questions.
  await answerAiConsent(screen, 'decline');
  await screen.getByTestId('btn.recording.inputMode.text').tap();
  await expect(screen.getByTestId('input.dreamTranscript')).toHaveValue(story);
  await expect(screen.getByTestId('btn.saveDream')).toBeEnabled();
  await app.screenshot('draft-preserved');
});

test('Quick Settings changes language and theme without losing the Capture draft', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await app.open();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  await leaveGuidedStories(browser, screen);
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
  for (const [theme, background] of [['dark', 'rgba(20, 19, 26, 0.84)'], ['light', 'rgba(245, 234, 219, 0.88)']]) {
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
    ? 'Feature presentations are switched off for this bundle.' : false,
}, async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await app.open();
  await screen.getByTestId('btn.onboarding.feature.capture').tap();
  await expect(screen.getByTestId('btn.onboarding.story.next')).toBeEnabled();
  await screen.getByTestId('btn.onboarding.story.next').tap();
  await expect(screen.getByTestId('btn.onboarding.story.next')).toBeEnabled();
  await screen.getByTestId('btn.onboarding.story.next').tap();
  await expect(screen.getByTestId('btn.onboarding.story.next')).toBeEnabled();
  await screen.getByTestId('btn.onboarding.story.next').tap();
  await expect(screen.getByTestId('component.onboarding.story.capture.3')).toBeVisible();
  await screen.getByTestId('btn.onboarding.globeCard.1').tap();
  await expect(screen.getByTestId('component.onboarding.dreamEntry')).toContainText('Flying over the harbour');
  await expect(screen.getByTestId('btn.onboarding.story.continue')).toBeEnabled();
  await screen.getByTestId('btn.onboarding.story.continue').tap();
  await expect(screen.getByTestId('component.onboarding.story.connect.0')).toBeVisible();
  await expect(screen.getByTestId('btn.onboarding.story.next')).toBeEnabled();
  await screen.getByTestId('btn.onboarding.story.next').tap();
  await expect(screen.getByTestId('btn.onboarding.story.next')).toBeEnabled();
  await screen.getByTestId('btn.onboarding.story.next').tap();
  await expect(screen.getByTestId('btn.onboarding.story.next')).toBeEnabled();
  await screen.getByTestId('btn.onboarding.story.next').tap();
  await expect(screen.getByTestId('btn.onboarding.story.continue')).toBeEnabled();
  await screen.getByTestId('btn.onboarding.story.continue').tap();
  await expect(screen.getByTestId('component.onboarding.story.explore.0')).toBeVisible();
  await expect(screen.getByTestId('btn.onboarding.story.next')).toBeEnabled();
  await screen.getByTestId('btn.onboarding.story.next').tap();
  await expect(screen.getByTestId('btn.onboarding.story.next')).toBeEnabled();
  await screen.getByTestId('btn.onboarding.story.next').tap();
  await expect(screen.getByTestId('btn.onboarding.story.next')).toBeEnabled();
  await screen.getByTestId('btn.onboarding.story.next').tap();
  // The Explorer example waits for the reader's answer before its door opens (owner, 2026-10-24).
  await screen.getByTestId('btn.onboarding.dialogue.home').tap();
  await expect(screen.getByTestId('btn.onboarding.story.continue')).toBeEnabled();
  await screen.getByTestId('btn.onboarding.story.continue').tap();
  await expect(screen.getByTestId('sheet.onboarding.feature')).toHaveCount(0);
  await expect(screen.getByTestId('component.onboarding.intro')).toBeVisible();
  await app.screenshot('onboarding-story-complete');
});

test('Quick Settings keeps interior taps open and accepts every sign-in button edge', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await app.open();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  await leaveGuidedStories(browser, screen);
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
