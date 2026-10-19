import { test, type Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import type { App, Screen } from 'e2e';
import { isolateWeb } from '../web-fixtures';

const symbolsQuestion = 'Tell me about the symbolic meanings in my dream. What do the key symbols represent?';
// The offline service selects one of five replies. The assertion still requires
// a completed reply, then preserves its exact observed text across UI navigation.
const mockReply = /^(That's an interesting question about|Based on your dream,|Dreams like yours often symbolize|The elements you mentioned in your dream|I sense that this dream is trying to tell you)/;

async function startPlus(app: App, screen: Screen, browser: Browser) {
  await app.open();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    const unsubscribe = await browser.onDialog('accept');
    try { await screen.getByTestId('btn.onboarding.feature.close', { visible: true }).tap(); }
    finally { await unsubscribe(); }
  }
  await screen.getByTestId('btn.onboarding.skip').tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  const home = screen.getByTestId('tab.home', { visible: true });
  if (await home.isVisible()) await home.tap();
  else await screen.getByTestId('btn.recording.home', { visible: true }).tap();
  await screen.getByTestId('btn.header.home.settings', { visible: true }).tap();
  await screen.getByTestId('quick-settings.all', { visible: true }).tap();
  await screen.getByTestId('settings-account-open-signin', { visible: true }).tap();
  await screen.getByTestId('btn.mockProfile.plus', { visible: true }).tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
}

async function openLibrary(screen: Screen) {
  const home = screen.getByTestId('tab.home', { visible: true });
  if (await home.isVisible()) await home.tap();
  else await screen.getByTestId('btn.recording.home', { visible: true }).tap();
  await screen.getByTestId('tab.journal', { visible: true }).tap();
  await expect(screen.getByTestId('screen.journal', { visible: true })).toHaveCount(1);
  await screen.getByTestId('input.searchDreams', { visible: true }).fill('The Infinite Library');
  const library = screen.getByTestId(/^dream\.item\./, { visible: true }).filter({ hasText: 'The Infinite Library' });
  await expect(library).toHaveCount(1);
  await library.tap();
  // Illustrated dreams open on their full-screen cover. Scrolling to the
  // story mounts the contextual action dock; the dock cannot reveal itself.
  const transcript = screen.getByTestId('component.transcriptCard');
  await expect(transcript).toBeAttached();
  await transcript.scrollIntoView();
  await expect(transcript).toBeVisible();
  const action = screen.getByTestId('component.dreamDetail.actionCard', { visible: true });
  await expect(action).toBeEnabled();
  await action.tap();
  await expect(screen.getByTestId('screen.dreamCategories', { visible: true })).toBeVisible();
}

test('plus opens a symbols question once and resumes the saved exchange from its category', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await startPlus(app, screen, browser);
  await openLibrary(screen);

  const consentPrompts: string[] = [];
  const unsubscribe = await browser.onDialog(async dialog => {
    consentPrompts.push(dialog.message);
    await dialog.accept();
  });
  try {
    await screen.getByTestId('btn.dreamCategory.symbols', { visible: true }).tap();
    const question = screen.getByText(symbolsQuestion, { exact: true, visible: true });
    await expect(question).toHaveCount(1);
    const reply = screen.getByText(mockReply, { visible: true });
    await expect(reply).toHaveCount(1);
    // This action is enabled only after the complete successful exchange has
    // been saved and the send lock has been released, including streaming.
    await expect(screen.getByTestId('btn.exploration360.synthesis', { visible: true })).toBeEnabled();
    const replyText = (await reply.textContent())?.trim();
    expect(replyText).toBeTruthy();
    expect(replyText!.length).toBeGreaterThan(80);
    await expect(question).toHaveCount(1);
    await app.screenshot('symbols-question-and-complete-reply');

    await screen.getByRole('button', 'Back', { exact: true, visible: true }).tap();
    await expect(screen.getByTestId('screen.dreamCategories', { visible: true })).toBeVisible();
    await expect(screen.getByTestId('text.reflection.exchangeSaved', { visible: true })).toBeVisible();
    const resume = screen.getByTestId('btn.dreamCategory.symbols', { visible: true });
    await expect(resume).toContainText('Resume');
    await resume.tap();

    // Completed category links reopen the conversation without a category or
    // messageId parameter. This proves that supported UI path; the explicit
    // messageId gate and the 500 ms replacement race have isolated coverage.
    const resumed = new URL(await browser.url());
    expect(resumed.searchParams.has('category')).toBe(false);
    expect(resumed.searchParams.has('messageId')).toBe(false);
    await expect(screen.getByTestId('chat.input.message', { visible: true })).toBeVisible();
    await expect(screen.getByTestId('btn.exploration360.synthesis', { visible: true })).toBeEnabled();
    await expect(question).toHaveCount(1);
    await expect(screen.getByText(replyText!, { exact: true, visible: true })).toHaveCount(1);
    await expect(reply).toHaveCount(1);
    expect(consentPrompts).toHaveLength(1);
    expect(consentPrompts[0]).toMatch(/generative AI/);
    await app.screenshot('symbols-category-resumes-one-exchange');
  } finally {
    await unsubscribe();
  }
});
