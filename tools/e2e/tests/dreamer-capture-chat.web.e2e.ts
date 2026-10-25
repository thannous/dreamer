// Historical UI assertions, run on the public TesterArmy web surface.
import type { Page } from 'playwright/test';
import { createParityTest, expect, expectCaptureDraftSaved, withDialog } from '../web-parity-fixtures';
const test = createParityTest();

const story = 'Je marchais au bord d’un lac. Une maison éclairée apparaissait entre les arbres.';
const detail = 'Des arbres très hauts et une lumière douce.';

async function startChat(page: Page) {
  await page.goto('/');
  await page.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withDialog(page, 'accept', () => page.getByTestId('btn.onboarding.feature.close').click());
  }
  await page.getByTestId('btn.onboarding.skip').click();
  await page.getByRole('button', { name: /^(Settings|Paramètres)$/ }).filter({ visible: true }).click();
  await page.getByTestId('quick-settings.language').click();
  await page.getByTestId('quick-settings.language.fr').click();
  await page.getByTestId('quick-settings.close').click();
  await page.getByTestId('btn.recording.inputMode.voice').click();
  await expect(page.getByTestId('recording-conversation-answer')).toBeVisible();
}

async function send(page: Page, answer: string) {
  await page.getByTestId('recording-conversation-answer').fill(answer);
  await page.getByTestId('recording-conversation-submit').click();
  await expect(page.getByTestId('recording-conversation-answer')).toHaveValue('');
}

async function finish(page: Page) {
  await page.getByTestId('recording-conversation-finish').click();
  await expect(page.getByTestId('capture-review-card')).toBeVisible();
}

test.use({ viewport: { width: 390, height: 844 }, contextOptions: { reducedMotion: 'reduce' } });

test('chat keeps chronological replies, edits and pending details through reload, then saves the exact card once into its saved moment', async ({ page }, info) => {
  await startChat(page);
  const reply = page.getByTestId('recording-conversation-answer');
  await reply.fill(story);
  await expect(page.getByTestId('capture-chat-user')).toHaveCount(0);
  await page.getByTestId('recording-conversation-submit').click();
  await expect(page.getByTestId('capture-chat-user')).toHaveCount(1);
  await expect(page.getByTestId('capture-chat-user')).toHaveText(story);
  await finish(page);
  const card = page.getByTestId('capture-review-card');
  const save = card.getByTestId('btn.saveDream');
  await expect(card.getByTestId('capture-review-narrative')).toHaveText(story, { useInnerText: true });
  await expect(page.getByTestId('btn.saveDream')).toHaveCount(1);
  await page.getByTestId('capture-review-edit').click();
  const edited = story + ' Je reconnaissais cet endroit.';
  await page.getByTestId('capture-review-text').fill(edited);
  await page.getByTestId('capture-review-edit-done').click();
  await reply.fill(detail);
  await expect(save).toBeDisabled();
  await expect(page.getByTestId('capture-chat-user')).toBeDisabled();
  await expectCaptureDraftSaved(page, detail);
  await page.reload();
  await expect(page.getByTestId('capture-review-card')).toBeVisible();
  await expect(reply).toHaveValue(detail);
  await expect(card.getByTestId('capture-review-narrative')).toHaveText(edited, { useInnerText: true });
  await page.getByTestId('recording-conversation-submit').click();
  const expected = edited + '\n\n' + detail;
  await expect(card.getByTestId('capture-review-narrative')).toHaveText(expected, { useInnerText: true });
  await expect(save).toBeEnabled();
  for (const mode of ['light', 'dark'] as const) {
    await page.getByRole('button', { name: 'Paramètres', exact: true }).filter({ visible: true }).click();
    await page.getByTestId(`quick-settings.theme.${mode}`).click();
    await page.getByTestId('quick-settings.close').click();
    await expect(reply).toBeInViewport();
    await save.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`chat-card-${mode}.png`) });
  }
  await save.dblclick();
  // A told dream enters the story like a written one: the seal (skipped under reduced
  // motion), then its saved moment. The double tap still saves it once.
  await expect(page.getByTestId('component.dreamDetail.savedMoment')).toBeVisible();
  await page.screenshot({ path: info.outputPath('chat-saved-moment.png') });
  await expect(page.getByTestId('component.transcriptCard')).toContainText(edited);
  await expect(page.getByTestId('component.transcriptCard')).toContainText(detail);
  // A guest's new dream is read on arrival, told or written alike.
  await expect(page.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
  await expect(page.getByTestId('analysis.reading.modal')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('chat-dream-inline-analysis.png') });
  await page.getByTestId('btn.editDream').click();
  await expect(page.getByTestId('input.dreamTranscript')).toHaveValue(expected);
  await page.getByTestId('btn.saveDreamEdit').click();
  await page.getByTestId('btn.navigateJournal').click();
  await expect(page.getByTestId('screen.journal').filter({ visible: true })).toBeVisible();
  await expect(page.getByTestId(/^dream\.item\./).filter({ visible: true })).toHaveCount(1);
  await page.screenshot({ path: info.outputPath('chat-exactly-one-dream.png') });
  await page.goto('/recording');
  await expect(reply).toHaveValue('');
  await expect(page.getByTestId('capture-review-card')).toHaveCount(0);
});

test('chat finishes automatically and keeps a single card and reply reachable in small windows', async ({ page }, info) => {
  await startChat(page);
  for (const answer of [story, detail, 'Un grand calme.', 'Je me souviens du silence.']) {
    await send(page, answer);
  }
  await expect(page.getByTestId('capture-review-card')).toHaveCount(1);
  // Answers to the questions are woven into one account (simulated in mock mode), and the card says so.
  await expect(page.getByTestId('capture-review-woven')).toHaveText('Relié à partir de tes mots. Relis-le : tu peux tout modifier.');
  await expect(page.getByTestId('capture-review-narrative')).toHaveText([story, detail, 'Un grand calme.', 'Je me souviens du silence.'].join(' '), { useInnerText: true });
  // The page is told once (a fade under reduced motion): capture it once it has settled.
  await expect.poll(() => page.getByTestId('capture-review-card').evaluate(card => Number(getComputedStyle(card).opacity))).toBe(1);
  await expect.poll(() => page.getByTestId('capture-review-narrative').evaluate(narrative =>
    Number(getComputedStyle(narrative.lastElementChild ?? narrative).opacity))).toBe(1);
  // It lands where the reader sees it begin.
  await expect(page.getByTestId('capture-review-title')).toBeInViewport();
  await page.screenshot({ path: info.outputPath('chat-woven-card.png') });
  for (const viewport of [{ width: 320, height: 640 }, { width: 640, height: 390 }]) {
    await page.setViewportSize(viewport);
    const reply = page.getByTestId('recording-conversation-answer');
    await reply.scrollIntoViewIfNeeded();
    await expect(reply).toBeInViewport();
    const save = page.getByTestId('btn.saveDream');
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();
    await expect(reply).toBeInViewport();
    await reply.fill('Encore une lumière.');
    await expect(save).toBeDisabled();
    await page.getByTestId('recording-conversation-submit').click();
    await expect(page.getByTestId('capture-review-card')).toHaveCount(1);
    await expect(page.getByTestId('capture-review-narrative')).toContainText('Encore une lumière.');
    // An added detail keeps the account marked as woven.
    await expect(page.getByTestId('capture-review-woven')).toBeVisible();
    await page.screenshot({ path: info.outputPath(`chat-${viewport.width}x${viewport.height}.png`) });
  }
});

for (const scenario of [
  {
    kind: 'fragment',
    opening: 'Un phare bleu.',
    questions: ['Qu’est-ce que tu revois le mieux ?', 'Ça se passait où ?', 'Qu’est-ce qui te revient d’autre ?'],
  },
  {
    kind: 'story',
    opening: story,
    questions: ['Qu’est-ce qui te revient d’autre ?', 'Il y avait quelqu’un d’autre ?', 'Qu’est-ce que tu revois le mieux ?'],
  },
] as const) {
  test(`chat asks for consent at the first question and keeps a ${scenario.kind} saveable with local recall after declining`, async ({ page }, info) => {
    await startChat(page);
    // The historical fixture grants consent in storage. Remove it before this
    // capture's first AI request to exercise the real modal and local questions.
    await page.evaluate(() => localStorage.removeItem('noctalia.aiConsent.v2'));
    const modal = page.getByTestId('modal.aiConsent');
    const reply = page.getByTestId('recording-conversation-answer');
    const question = page.getByTestId('recording-conversation-question');
    let browserDialogs = 0;
    await withDialog(page, async dialog => {
      browserDialogs += 1;
      await dialog.dismiss();
    }, async () => {
      await reply.fill(scenario.opening);
      await expect(modal).toHaveCount(0);
      await page.getByTestId('recording-conversation-submit').click();
      await expect(modal).toBeVisible();
      await expect(page.getByTestId('capture-chat-user')).toHaveText(scenario.opening);
      await page.screenshot({ path: info.outputPath(`${scenario.kind}-recall-consent.png`) });
      await page.getByTestId('btn.aiConsent.decline').click();
      const answers = [detail, 'Je ne sais plus.', 'C’est tout ce qui me revient.'];
      for (const [index, expected] of scenario.questions.entries()) {
        // The order distinguishes an image fragment from a longer story and
        // guards against repeating the same general question after refusal.
        await expect(question).toHaveText(expected);
        await expect(modal).toHaveCount(0);
        await expect(reply).toBeEditable();
        await send(page, answers[index]);
      }
      const narrative = [scenario.opening, ...answers].join('\n\n');
      const card = page.getByTestId('capture-review-card');
      await expect(card).toHaveCount(1);
      await expect(card.getByTestId('capture-review-narrative')).toHaveText(narrative, { useInnerText: true });
      await expect(page.getByTestId('capture-review-woven')).toHaveCount(0);
      expect(await page.evaluate(() => localStorage.getItem('noctalia.aiConsent.v2'))).toBeNull();
      await card.getByTestId('btn.saveDream').click();
      // Saving is local; the separate optional reading may ask again, and can
      // also be declined without losing any of the narrator's words.
      await expect(modal).toBeVisible();
      await page.getByTestId('btn.aiConsent.decline').click();
      for (const paragraph of [scenario.opening, ...answers]) {
        await expect(page.getByTestId('component.transcriptCard')).toContainText(paragraph);
      }
      await expect(page.getByTestId('component.dreamDetail.readingZone')).toBeHidden();
      await page.getByTestId('btn.navigateJournal').click();
      await expect(page.getByTestId(/^dream\.item\./).filter({ visible: true })).toHaveCount(1);
      expect(browserDialogs).toBe(0);
      expect(await page.evaluate(() => localStorage.getItem('noctalia.aiConsent.v2'))).toBeNull();
      await page.screenshot({ path: info.outputPath(`${scenario.kind}-local-recall-saved.png`) });
    });
  });
}
