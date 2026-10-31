import { expect } from 'e2e';
import {
  test,
  nativeCapture,
  nativeDismissCaptureKeyboard,
  nativeLogin,
  nativeSignOut,
  nativeJournal,
  nativeTap,
  nativeTranscript,
  type NativeFixtures,
} from '../native-backend-fixtures';

/**
 * Android allows AI at the first question (2026-10-29) and this local stack has no AI provider,
 * so the quick categorization after the save fails and says so; the dream itself stays saved.
 * iOS declined AI above and categorizes nothing.
 */
async function dismissUnavailableCategorization({ screen, platform }: Pick<NativeFixtures, 'screen' | 'platform'>) {
  if (platform !== 'android') return;
  const unavailable = screen.getByText(/^Automatic title and classification are unavailable\./, { visible: true });
  await expect(unavailable).toBeVisible();
  await screen.getByRole('button', /^OK$/i, { visible: true }).tap();
  await expect(unavailable).toHaveCount(0);
}

// The backend fixture first opens the owned QA app, signs out any retained QA
// session, clears only that app, and completes its first-launch onboarding.
// It also resets only the two disposable accounts of this live local stack.
test('Dreamer native first capture survives a mode switch and restart with exactly one dream', {
  platforms: ['ios', 'android'],
  tags: ['native-essential-capture', 'native-real-backend'],
  timeout: 300_000,
}, async fixtures => {
  const { app, screen, device, backend, platform } = fixtures;
  void backend; // Acquire the guarded local-backend fixture and its owned app state.
  await app.open();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  const editor = screen.getByTestId('input.dreamTranscript', { visible: true });
  const save = screen.getByTestId('btn.saveDream', { visible: true });
  await expect(editor).toHaveValue('');
  await expect(save).toBeDisabled();

  const story = 'First capture QA: a blue lighthouse above a quiet sea.';
  await editor.fill(story);
  await nativeDismissCaptureKeyboard(fixtures);
  await nativeTap(screen, 'btn.recording.inputMode.voice', 'up');
  const consent = screen.getByTestId('modal.aiConsent', { visible: true });
  // iOS asks before the first question and is declined here; Android asks nothing (2026-10-29).
  if (platform === 'ios') {
    await expect(consent).toBeVisible();
    await screen.getByTestId('btn.aiConsent.decline', { visible: true }).tap();
  }
  await expect(consent).toHaveCount(0);
  const writing = screen.getByTestId('btn.recording.inputMode.text', { visible: true });
  await screen.scrollUntilVisible(writing, { direction: 'up' });
  // iOS exposes the underlying tree before the consent Modal finishes fading.
  // Selection is idempotent; only this transition may repeat its tap. Once Write
  // focuses the editor it hides the selector, so the editor also proves arrival.
  await expect.poll(async () => {
    if (await editor.count()) return true;
    if (await writing.count()) await writing.tap();
    return (await editor.count()) === 1;
  }).toBe(true);
  await expect(editor).toHaveValue(story);
  // Returning to Write focuses the editor and opens its keyboard.
  await nativeDismissCaptureKeyboard(fixtures);
  await expect(save).toBeEnabled();
  await nativeTap(screen, 'btn.saveDream');
  await dismissUnavailableCategorization(fixtures);

  const later = screen.getByTestId('btn.dreamCaptureSeal.readLater', { visible: true });
  const detail = screen.getByTestId('screen.dreamDetail', { visible: true });
  // A first guest dream can ask separately for an optional analysis after save.
  // Declining that prompt must still leave the local dream available.
  await expect.poll(async () => (await later.count()) + (await detail.count()) + (await consent.count())).toBeGreaterThan(0);
  if (await consent.count()) {
    await screen.getByTestId('btn.aiConsent.decline', { visible: true }).tap();
    await expect(consent).toHaveCount(0);
  }
  await expect.poll(async () => (await later.count()) + (await detail.count())).toBeGreaterThan(0);
  if (await later.count()) await later.tap();
  await nativeTranscript(screen, story);
  await nativeJournal(screen);
  await expect(screen.getByTestId(/^dream\.item\./, { visible: true })).toHaveCount(1);

  await app.restart();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await device.dismissKeyboard();
  await nativeJournal(screen);
  const dreams = screen.getByTestId(/^dream\.item\./, { visible: true });
  await expect(dreams).toHaveCount(1);
  await dreams.tap();
  await nativeTranscript(screen, story);
  await app.screenshot('native-first-capture-durable-once');
});

test('Dreamer native capture reviews its original story and saves an added detail once across restart', {
  platforms: ['ios', 'android'],
  tags: ['native-essential-capture', 'native-real-backend'],
  timeout: 300_000,
}, async fixtures => {
  const { app, screen, device, backend, platform } = fixtures;
  void backend;
  await app.open();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  const story = 'A blue doorway opened onto the garden.';
  const detail = 'A brass key was still in my hand.';
  await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
  await nativeDismissCaptureKeyboard(fixtures);
  await nativeTap(screen, 'btn.recording.inputMode.voice', 'up');
  const consent = screen.getByTestId('modal.aiConsent', { visible: true });
  // iOS asks and is declined here; Android asks nothing (2026-10-29), so its first
  // question may come from the local backend. The review below is the same either way.
  if (platform === 'ios') {
    await expect(consent).toBeVisible();
    await screen.getByTestId('btn.aiConsent.decline', { visible: true }).tap();
  }
  await expect(consent).not.toBeVisible();

  // Exercise the extracted preparation even when AI is declined: the review
  // must gather the narrator's own words and remain editable before persistence.
  await nativeTap(screen, 'recording-conversation-finish');
  // iOS flattens the prose beside its empty narrative View; read actual text.
  const review = screen.getByTestId('capture-review-card', { visible: true });
  const originalStory = review.getByText(story, { exact: true, visible: true });
  await screen.scrollUntilVisible(originalStory, { direction: 'up' });
  await expect(originalStory).toHaveText([story]);
  const answer = screen.getByTestId('recording-conversation-answer', { visible: true });
  const save = screen.getByTestId('btn.saveDream', { visible: true });
  await answer.fill(detail);
  await screen.scrollUntilVisible(save, { direction: 'down' });
  await expect(save).toBeDisabled();
  await nativeTap(screen, 'recording-conversation-submit');
  await expect(answer).toHaveValue('');
  const addedDetail = review.getByText(detail, { exact: true, visible: true });
  await screen.scrollUntilVisible(addedDetail, { direction: 'up' });
  await expect(addedDetail).toHaveText([detail]);
  await screen.scrollUntilVisible(save, { direction: 'down' });
  await expect(save).toBeEnabled();
  await nativeTap(screen, 'btn.saveDream');
  await dismissUnavailableCategorization(fixtures);

  const later = screen.getByTestId('btn.dreamCaptureSeal.readLater', { visible: true });
  const dream = screen.getByTestId('screen.dreamDetail', { visible: true });
  await expect.poll(async () => (await later.count()) + (await dream.count()) + (await consent.count())).toBeGreaterThan(0);
  if (await consent.count()) {
    await screen.getByTestId('btn.aiConsent.decline', { visible: true }).tap();
    await expect(consent).not.toBeVisible();
  }
  await expect.poll(async () => (await later.count()) + (await dream.count())).toBeGreaterThan(0);
  if (await later.count()) await later.tap();
  const reviewedStory = `${story}\n\n${detail}`;
  await nativeTranscript(screen, reviewedStory);
  await nativeJournal(screen);
  await expect(screen.getByTestId(/^dream\.item\./, { visible: true })).toHaveCount(1);

  await app.restart();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await device.dismissKeyboard();
  await nativeJournal(screen);
  const dreams = screen.getByTestId(/^dream\.item\./, { visible: true });
  await expect(dreams).toHaveCount(1);
  await dreams.tap();
  await nativeTranscript(screen, reviewedStory);
  // Text matchers normalize paragraph breaks. The editor exposes the persisted
  // value verbatim, so also assert both paragraphs after restart without saving.
  const edit = screen.getByTestId('btn.editDream', { visible: true });
  // The compact Duo's fixed dock covers the default viewport swipe's start.
  // Drag only through the measured free reading area to reveal the last action.
  for (let scroll = 0; scroll < 6; scroll += 1) {
    const page = await dream.boundingBox();
    const dock = await screen.getByTestId('component.dreamDetail.actionDock', { visible: true }).boundingBox();
    if (!page || !dock) throw new Error('Journal scroll geometry is unavailable.');
    const rect = await edit.count() ? await edit.boundingBox() : null;
    if (rect && rect.y >= page.y && rect.y + rect.height <= dock.y) break;
    const fromY = dock.y - 24;
    const toY = page.y + 100;
    if (fromY - toY < 80) throw new Error('Journal has no clear scroll region above its dock.');
    const x = Math.min(page.x + page.width / 2, dock.x + dock.width / 2);
    await screen.swipe({ from: { x, y: fromY }, to: { x, y: toY }, duration: 350 });
  }
  await expect(edit).toBeVisible();
  await edit.tap();
  await expect(screen.getByTestId('component.dreamEditor', { visible: true })).toBeVisible();
  const persistedStory = screen.getByTestId('input.dreamTranscript', { visible: true });
  await screen.scrollUntilVisible(persistedStory);
  await expect(persistedStory).toHaveValue(reviewedStory);
  await nativeTap(screen, 'btn.cancelDreamEdit');
  await nativeTranscript(screen, reviewedStory);
  await app.screenshot('native-reviewed-capture-durable-once');
});


test('Dreamer native drafts stay private across guest and account switches and restart', {
  platforms: ['ios', 'android'],
  tags: ['native-essential-capture', 'native-real-backend'],
  timeout: 360_000,
}, async fixtures => {
  const { app, screen, backend } = fixtures;
  void backend;
  await app.open();
  const editor = screen.getByTestId('input.dreamTranscript', { visible: true });
  const guestStory = 'A guest saw a silver tide beside the pier.';
  const ownerStory = 'The first account kept a blue lantern in its private dream.';
  const otherStory = 'The second account found a golden staircase in its private dream.';
  await expect(editor).toHaveValue('');
  await editor.fill(guestStory);
  await nativeDismissCaptureKeyboard(fixtures);

  await nativeLogin(fixtures, 'owner');
  await nativeCapture(screen);
  await expect(editor).toHaveValue(guestStory);
  await editor.fill(ownerStory);
  await nativeDismissCaptureKeyboard(fixtures);
  await nativeSignOut(fixtures);
  await nativeCapture(screen);
  await expect(editor).toHaveValue('');

  await nativeLogin(fixtures, 'other');
  await nativeCapture(screen);
  await expect(editor).toHaveValue('');
  await editor.fill(otherStory);
  await nativeDismissCaptureKeyboard(fixtures);
  await nativeSignOut(fixtures);

  await nativeLogin(fixtures, 'owner');
  await nativeCapture(screen);
  await expect(editor).toHaveValue(ownerStory);
  await app.restart();
  await expect(editor).toHaveValue(ownerStory);
  await nativeDismissCaptureKeyboard(fixtures, { afterFill: false });
  await nativeSignOut(fixtures);

  await nativeLogin(fixtures, 'other');
  await nativeCapture(screen);
  await expect(editor).toHaveValue(otherStory);
  await app.screenshot('native-draft-account-isolation');
});
