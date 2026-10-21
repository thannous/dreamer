import { readDOM, byId, expectInViewport, expectInnerText, createExactWebTest, expect, expectCaptureDraftSaved, withExactDialog } from '../exact-web-fixtures';
import type { ExactWebUI } from '../exact-web-fixtures';
// Exact journeys using public TesterArmy APIs.
const test = createExactWebTest({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });

const story = 'Je marchais au bord d’un lac. Une maison éclairée apparaissait entre les arbres.';
const detail = 'Des arbres très hauts et une lumière douce.';

async function startChat(ui: ExactWebUI) {
  const { app, screen, browser } = ui;
  await app.open('/');
  await screen.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withExactDialog(browser, 'accept', () => screen.getByTestId('btn.onboarding.feature.close').click());
  }
  await screen.getByTestId('btn.onboarding.skip').click();
  await screen.getByRole('button', { name: /^(Settings|Paramètres)$/, visible: true }).click();
  await screen.getByTestId('quick-settings.language').click();
  await screen.getByTestId('quick-settings.language.fr').click();
  await screen.getByTestId('quick-settings.close').click();
  await screen.getByTestId('btn.recording.inputMode.voice').click();
  await expect(screen.getByTestId('recording-conversation-answer')).toBeVisible();
}

async function send(ui: ExactWebUI, answer: string) {
  const { screen } = ui;
  await screen.getByTestId('recording-conversation-answer').fill(answer);
  await screen.getByTestId('recording-conversation-submit').click();
  await expect(screen.getByTestId('recording-conversation-answer')).toHaveValue('');
}

async function finish(ui: ExactWebUI) {
  const { screen } = ui;
  await screen.getByTestId('recording-conversation-finish').click();
  await expect(screen.getByTestId('capture-review-card')).toBeVisible();
}


test('chat keeps chronological replies, edits and pending details through reload, then saves the exact card once into its saved moment', async (ui) => {
  const { app, screen, browser } = ui;
  await startChat(ui);
  const reply = screen.getByTestId('recording-conversation-answer');
  await reply.fill(story);
  await expect(screen.getByTestId('capture-chat-user')).toHaveCount(0);
  await screen.getByTestId('recording-conversation-submit').click();
  await expect(screen.getByTestId('capture-chat-user')).toHaveCount(1);
  await expect(screen.getByTestId('capture-chat-user')).toHaveText(story);
  await finish(ui);
  const card = screen.getByTestId('capture-review-card');
  const save = card.getByTestId('btn.saveDream');
  await expectInnerText(browser, byId('capture-review-narrative'), story);
  await expect(screen.getByTestId('btn.saveDream')).toHaveCount(1);
  await screen.getByTestId('capture-review-edit').click();
  const edited = story + ' Je reconnaissais cet endroit.';
  await screen.getByTestId('capture-review-text').fill(edited);
  await screen.getByTestId('capture-review-edit-done').click();
  await reply.fill(detail);
  await expect(save).toBeDisabled();
  await expect(screen.getByTestId('capture-chat-user')).toBeDisabled();
  await expectCaptureDraftSaved(browser, detail);
  await browser.reload();
  await expect(screen.getByTestId('capture-review-card')).toBeVisible();
  await expect(reply).toHaveValue(detail);
  await expectInnerText(browser, byId('capture-review-narrative'), edited);
  await screen.getByTestId('recording-conversation-submit').click();
  const expected = edited + '\n\n' + detail;
  await expectInnerText(browser, byId('capture-review-narrative'), expected);
  await expect(save).toBeEnabled();
  for (const mode of ['light', 'dark'] as const) {
    await screen.getByRole('button', { name: 'Paramètres', exact: true, visible: true }).click();
    await screen.getByTestId(`quick-settings.theme.${mode}`).click();
    await screen.getByTestId('quick-settings.close').click();
    await expectInViewport(reply, browser);
    await save.scrollIntoView();
    await app.screenshot(`chat-card-${mode}.png`);
  }
  await save.dblclick();
  // A told dream enters the story like a written one: the seal (skipped under reduced
  // motion), then its saved moment. The double tap still saves it once.
  await expect(screen.getByTestId('component.dreamDetail.savedMoment')).toBeVisible();
  await app.screenshot('chat-saved-moment.png');
  await expect(screen.getByTestId('component.transcriptCard')).toContainText(edited);
  await expect(screen.getByTestId('component.transcriptCard')).toContainText(detail);
  // A guest's new dream is read on arrival, told or written alike.
  await expect(screen.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
  await expect(screen.getByTestId('analysis.reading.modal')).toHaveCount(0);
  await app.screenshot('chat-dream-inline-analysis.png');
  await screen.getByTestId('btn.editDream').click();
  await expect(screen.getByTestId('input.dreamTranscript')).toHaveValue(expected);
  await screen.getByTestId('btn.saveDreamEdit').click();
  await screen.getByTestId('btn.navigateJournal').click();
  await expect(screen.getByTestId('screen.journal', { visible: true })).toBeVisible();
  await expect(screen.getByTestId(/^dream\.item\./, { visible: true })).toHaveCount(1);
  await app.screenshot('chat-exactly-one-dream.png');
  await app.open('/recording');
  await expect(reply).toHaveValue('');
  await expect(screen.getByTestId('capture-review-card')).toHaveCount(0);
});

test('chat finishes automatically and keeps a single card and reply reachable in small windows', async (ui) => {
  const { app, screen, browser } = ui;
  await startChat(ui);
  for (const answer of [story, detail, 'Un grand calme.', 'Je me souviens du silence.']) {
    await send(ui, answer);
  }
  await expect(screen.getByTestId('capture-review-card')).toHaveCount(1);
  // Answers to the questions are woven into one account (simulated in mock mode), and the card says so.
  await expect(screen.getByTestId('capture-review-woven')).toHaveText('Relié à partir de tes mots. Relis-le : tu peux tout modifier.');
  await expectInnerText(browser, byId('capture-review-narrative'), [story, detail, 'Un grand calme.', 'Je me souviens du silence.'].join(' '));
  // The page is told once (a fade under reduced motion): capture it once it has settled.
  await expect.poll(() => readDOM(browser, byId('capture-review-card'), card => Number(getComputedStyle(card).opacity))).toBe(1);
  await expect.poll(() => readDOM(browser, byId('capture-review-narrative'), narrative =>
    Number(getComputedStyle(narrative.lastElementChild ?? narrative).opacity))).toBe(1);
  // It lands where the reader sees it begin.
  await expectInViewport(screen.getByTestId('capture-review-title'), browser);
  await app.screenshot('chat-woven-card.png');
  for (const viewport of [{ width: 320, height: 640 }, { width: 640, height: 390 }]) {
    await browser.setViewport(viewport);
    const reply = screen.getByTestId('recording-conversation-answer');
    await reply.scrollIntoView();
    await expectInViewport(reply, browser);
    const save = screen.getByTestId('btn.saveDream');
    await save.scrollIntoView();
    await expectInViewport(save, browser);
    await expectInViewport(reply, browser);
    await reply.fill('Encore une lumière.');
    await expect(save).toBeDisabled();
    await screen.getByTestId('recording-conversation-submit').click();
    await expect(screen.getByTestId('capture-review-card')).toHaveCount(1);
    await expect(screen.getByTestId('capture-review-narrative')).toContainText('Encore une lumière.');
    // An added detail keeps the account marked as woven.
    await expect(screen.getByTestId('capture-review-woven')).toBeVisible();
    await app.screenshot(`chat-${viewport.width}x${viewport.height}.png`);
  }
});
