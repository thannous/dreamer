// Historical UI assertions, run on the public TesterArmy web surface.
import type { Browser } from '@e2e-dev/web';
import { expect, type App, type Screen } from 'e2e';
import { webLocale } from '../web-engine';
import { test } from '../traced-parity-test';
const options = { tags: ['historical-parity', 'locale-en-US'], skip: webLocale !== 'en-US' ? 'Requires the real en-US browser context; run E2E_WEB_LOCALE=en-US' : false, timeout: 180_000 };
type Fixtures = { app: App; screen: Screen; browser: Browser };

const story = 'Je marchais au bord d’un lac. Une maison éclairée apparaissait entre les arbres.';
const detail = 'Des arbres très hauts et une lumière douce.';


function viewportRatio(browser: Browser, id: string) {
  return browser.evaluate(testId => {
    const target = Array.from(document.querySelectorAll(`[data-testid="${testId}"]`)).find(node => node.getBoundingClientRect().width > 0);
    if (!target) return 0;
    return new Promise<number>(resolve => {
      const observer = new IntersectionObserver(([entry]) => { observer.disconnect(); resolve(entry.intersectionRatio); }, { threshold: [0, 1] });
      observer.observe(target);
    });
  }, id);
}
function opacity(browser: Browser, id: string, lastChild = false) {
  return browser.evaluate(({ testId, last }) => {
    const element = document.querySelector(`[data-testid="${testId}"]`);
    return element ? Number(getComputedStyle(last ? element.lastElementChild ?? element : element).opacity) : -1;
  }, { testId: id, last: lastChild });
}

async function startChat({ app, browser, screen }: Fixtures) {
  await browser.setViewport({ width: 390, height: 844 });
  await app.open();
  await browser.emulateMedia({ reducedMotion: 'reduce' });
  await browser.addInitScript(() => localStorage.setItem('noctalia.aiConsent.v2', 'granted'));
  await browser.reload();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    const stop = await browser.onDialog('accept');
    try { await screen.getByTestId('btn.onboarding.feature.close').tap(); }
    finally { await stop(); }
  }
  await screen.getByTestId('btn.onboarding.skip').tap();
  await screen.getByRole('button', /^(Settings|Paramètres)$/, { visible: true }).tap();
  await screen.getByTestId('quick-settings.language').tap();
  await screen.getByTestId('quick-settings.language.fr').tap();
  await screen.getByTestId('quick-settings.close').tap();
  await screen.getByTestId('btn.recording.inputMode.voice').tap();
  await expect(screen.getByTestId('recording-conversation-answer')).toBeVisible();
}

async function send(screen: Screen, answer: string) {
  await screen.getByTestId('recording-conversation-answer').fill(answer);
  await screen.getByTestId('recording-conversation-submit').tap();
  await expect(screen.getByTestId('recording-conversation-answer')).toHaveValue('');
}

async function finish(screen: Screen) {
  await screen.getByTestId('recording-conversation-finish').tap();
  await expect(screen.getByTestId('capture-review-card')).toBeVisible();
}


test('chat keeps chronological replies, edits and pending details through reload, then saves the exact card once into its saved moment', options, async fixtures => {
  const { screen, browser, app } = fixtures;
  await startChat(fixtures);
  const reply = screen.getByTestId('recording-conversation-answer');
  await reply.fill(story);
  await expect(screen.getByTestId('capture-chat-user')).toHaveCount(0);
  await screen.getByTestId('recording-conversation-submit').tap();
  await expect(screen.getByTestId('capture-chat-user')).toHaveCount(1);
  await expect(screen.getByTestId('capture-chat-user')).toHaveText(story);
  await finish(screen);
  const card = screen.getByTestId('capture-review-card');
  const save = card.getByTestId('btn.saveDream');
  await expect(card.getByTestId('capture-review-narrative')).toHaveText(story);
  await expect(screen.getByTestId('btn.saveDream')).toHaveCount(1);
  await screen.getByTestId('capture-review-edit').tap();
  const edited = story + ' Je reconnaissais cet endroit.';
  await screen.getByTestId('capture-review-text').fill(edited);
  await screen.getByTestId('capture-review-edit-done').tap();
  await reply.fill(detail);
  await expect(save).toBeDisabled();
  await expect(screen.getByTestId('capture-chat-user')).toBeDisabled();
  await expect.poll(() => browser.evaluate(() => localStorage.getItem('noctalia_mock_dogfood_v1:gemini_dream_journal_recording_transcript:guest'))).toContain(detail);
  await browser.reload();
  await expect(screen.getByTestId('capture-review-card')).toBeVisible();
  await expect(reply).toHaveValue(detail);
  await expect(card.getByTestId('capture-review-narrative')).toHaveText(edited);
  await screen.getByTestId('recording-conversation-submit').tap();
  const expected = edited + '\n\n' + detail;
  await expect(card.getByTestId('capture-review-narrative')).toHaveText(expected);
  await expect(save).toBeEnabled();
  for (const mode of ['light', 'dark'] as const) {
    await screen.getByRole('button', 'Paramètres', { exact: true, visible: true }).tap();
    await screen.getByTestId(`quick-settings.theme.${mode}`).tap();
    await screen.getByTestId('quick-settings.close').tap();
    await expect.poll(() => viewportRatio(browser, 'recording-conversation-answer')).toBeGreaterThan(0);
    await save.scrollIntoView();
    await app.screenshot(`chat-card-${mode}.png`);
  }
  await save.doubleTap();
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
  await screen.getByTestId('btn.editDream').tap();
  await expect(screen.getByTestId('input.dreamTranscript')).toHaveValue(expected);
  await screen.getByTestId('btn.saveDreamEdit').tap();
  await screen.getByTestId('btn.navigateJournal').tap();
  await expect(screen.getByTestId('screen.journal', { visible: true })).toBeVisible();
  await expect(screen.getByTestId(/^dream\.item\./, { visible: true })).toHaveCount(1);
  await app.screenshot('chat-exactly-one-dream.png');
  await browser.goto('/recording');
  await expect(reply).toHaveValue('');
  await expect(screen.getByTestId('capture-review-card')).toHaveCount(0);
});

test('chat finishes automatically and keeps a single card and reply reachable in small windows', options, async fixtures => {
  const { screen, browser, app } = fixtures;
  await startChat(fixtures);
  for (const answer of [story, detail, 'Un grand calme.', 'Je me souviens du silence.']) {
    await send(screen, answer);
  }
  await expect(screen.getByTestId('capture-review-card')).toHaveCount(1);
  // Answers to the questions are woven into one account (simulated in mock mode), and the card says so.
  await expect(screen.getByTestId('capture-review-woven')).toHaveText('Relié à partir de tes mots. Relis-le : tu peux tout modifier.');
  await expect(screen.getByTestId('capture-review-narrative')).toHaveText([story, detail, 'Un grand calme.', 'Je me souviens du silence.'].join(' '));
  // The page is told once (a fade under reduced motion): capture it once it has settled.
  await expect.poll(() => opacity(browser, 'capture-review-card')).toBe(1);
  await expect.poll(() => opacity(browser, 'capture-review-narrative', true)).toBe(1);
  // It lands where the reader sees it begin.
  await expect.poll(() => viewportRatio(browser, 'capture-review-title')).toBeGreaterThan(0);
  await app.screenshot('chat-woven-card.png');
  for (const viewport of [{ width: 320, height: 640 }, { width: 640, height: 390 }]) {
    await browser.setViewport(viewport);
    const reply = screen.getByTestId('recording-conversation-answer');
    await reply.scrollIntoView();
    await expect.poll(() => viewportRatio(browser, 'recording-conversation-answer')).toBeGreaterThan(0);
    const save = screen.getByTestId('btn.saveDream');
    await save.scrollIntoView();
    await expect.poll(() => viewportRatio(browser, 'btn.saveDream')).toBeGreaterThan(0);
    await expect.poll(() => viewportRatio(browser, 'recording-conversation-answer')).toBeGreaterThan(0);
    await reply.fill('Encore une lumière.');
    await expect(save).toBeDisabled();
    await screen.getByTestId('recording-conversation-submit').tap();
    await expect(screen.getByTestId('capture-review-card')).toHaveCount(1);
    await expect(screen.getByTestId('capture-review-narrative')).toContainText('Encore une lumière.');
    // An added detail keeps the account marked as woven.
    await expect(screen.getByTestId('capture-review-woven')).toBeVisible();
    await app.screenshot(`chat-${viewport.width}x${viewport.height}.png`);
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
  test(`chat asks for consent at the first question and keeps a ${scenario.kind} saveable with local recall after declining`, options, async fixtures => {
  const { screen, browser, app } = fixtures;
    await startChat(fixtures);
    // The historical fixture grants consent in storage. Remove it before this
    // capture's first AI request to exercise the real modal and local questions.
    await browser.evaluate(() => { localStorage.removeItem('noctalia.aiConsent.v2'); return null; });
    const modal = screen.getByTestId('modal.aiConsent');
    const reply = screen.getByTestId('recording-conversation-answer');
    const question = screen.getByTestId('recording-conversation-question');
    let browserDialogs = 0;
    const stop = await browser.onDialog(async dialog => {
      browserDialogs += 1;
      await dialog.dismiss();
    });
    try {
      await reply.fill(scenario.opening);
      await expect(modal).toHaveCount(0);
      await screen.getByTestId('recording-conversation-submit').tap();
      await expect(modal).toBeVisible();
      await expect(screen.getByTestId('capture-chat-user')).toHaveText(scenario.opening);
      await app.screenshot(`${scenario.kind}-recall-consent.png`);
      await screen.getByTestId('btn.aiConsent.decline').tap();
      const answers = [detail, 'Je ne sais plus.', 'C’est tout ce qui me revient.'];
      for (const [index, expected] of scenario.questions.entries()) {
        // The order distinguishes an image fragment from a longer story and
        // guards against repeating the same general question after refusal.
        await expect(question).toHaveText(expected);
        await expect(modal).toHaveCount(0);
        await expect.poll(() => browser.evaluate(() => {
          const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>('[data-testid="recording-conversation-answer"]');
          return Boolean(input && !input.disabled && !input.readOnly);
        })).toBe(true);
        await send(screen, answers[index]);
      }
      const narrative = [scenario.opening, ...answers].join('\n\n');
      const card = screen.getByTestId('capture-review-card');
      await expect(card).toHaveCount(1);
      await expect(card.getByTestId('capture-review-narrative')).toHaveText(narrative);
      await expect(screen.getByTestId('capture-review-woven')).toHaveCount(0);
      expect(await browser.evaluate(() => localStorage.getItem('noctalia.aiConsent.v2'))).toBeNull();
      await card.getByTestId('btn.saveDream').tap();
      // Saving is local; the separate optional reading may ask again, and can
      // also be declined without losing any of the narrator's words.
      await expect(modal).toBeVisible();
      await screen.getByTestId('btn.aiConsent.decline').tap();
      for (const paragraph of [scenario.opening, ...answers]) {
        await expect(screen.getByTestId('component.transcriptCard')).toContainText(paragraph);
      }
      await expect(screen.getByTestId('component.dreamDetail.readingZone')).toBeHidden();
      await screen.getByTestId('btn.navigateJournal').tap();
      await expect(screen.getByTestId(/^dream\.item\./, { visible: true })).toHaveCount(1);
      expect(browserDialogs).toBe(0);
      expect(await browser.evaluate(() => localStorage.getItem('noctalia.aiConsent.v2'))).toBeNull();
      await app.screenshot(`${scenario.kind}-local-recall-saved.png`);
    } finally { await stop(); }
  });
}
