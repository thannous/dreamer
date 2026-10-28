import type { Browser } from '@e2e-dev/web';
import { expect, type App, type Screen } from 'e2e';
import { webLocale } from '../web-engine';
import { test } from '../traced-parity-test';

const options = {
  tags: ['historical-parity', 'locale-en-US'],
  skip: webLocale !== 'en-US' ? 'Requires the real en-US browser context; run E2E_WEB_LOCALE=en-US' : false,
  timeout: 180_000,
};
type Fixtures = { app: App; browser: Browser; screen: Screen };
const story = 'Je marchais au bord d’un lac. Une maison éclairée apparaissait entre les arbres.\n\nJe reconnaissais cet endroit, sans savoir pourquoi. Tout semblait calme, comme si le temps s’était arrêté.\n\nJe me souviens surtout de la lumière et de cette sensation de douceur.';

async function startFrenchCapture({ app, browser, screen }: Fixtures) {
  await browser.setViewport({ width: 390, height: 844 });
  await app.open();
  await browser.emulateMedia({ reducedMotion: 'reduce' });
  await browser.addInitScript(() => localStorage.setItem('noctalia.aiConsent.v2', 'granted'));
  await browser.reload();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    const stop = await browser.onDialog('accept');
    try { await screen.getByTestId('btn.onboarding.feature.close').tap(); }
    finally { await stop(); }
  }
  await screen.getByTestId('btn.onboarding.skip').tap();
  await expect(screen.getByTestId('screen.recording')).toBeVisible();
  await screen.getByRole('button', /^(Settings|Paramètres)$/, { visible: true }).tap();
  await screen.getByTestId('quick-settings.language').tap();
  await screen.getByTestId('quick-settings.language.fr').tap();
  await screen.getByTestId('quick-settings.close').tap();
  await expect(screen.getByTestId('btn.recording.inputMode.text')).toContainText('Écrire');
}

function viewportRatio(browser: Browser, id: string) {
  return browser.evaluate(testId => {
    const target = Array.from(document.querySelectorAll(`[data-testid="${testId}"]`))
      .find(node => node.getBoundingClientRect().width > 0);
    if (!target) return 0;
    return new Promise<number>(resolve => {
      const observer = new IntersectionObserver(([entry]) => {
        observer.disconnect();
        resolve(entry.intersectionRatio);
      }, { threshold: [0, 1] });
      observer.observe(target);
    });
  }, id);
}

async function theme({ screen, browser }: Fixtures, value: 'light' | 'dark' | 'auto') {
  await screen.getByRole('button', /^(Settings|Paramètres)$/, { visible: true }).tap();
  await screen.getByTestId(`quick-settings.theme.${value}`).tap();
  await screen.getByTestId('quick-settings.close').tap();
  await expect.poll(() => viewportRatio(browser, 'quick-settings.drawer')).toBe(0);
}

function editorStyle(browser: Browser, property: 'backgroundColor' | 'color') {
  return browser.evaluate(name => {
    const element = document.querySelector<HTMLElement>('[data-testid="input.dreamTranscript"]');
    return element ? getComputedStyle(element)[name] : null;
  }, property);
}

test('capture gives the story room, respects explicit and automatic themes, and saves the exact draft', options, async fixtures => {
  const { screen, browser, app } = fixtures;
  await startFrenchCapture(fixtures);
  const editor = screen.getByTestId('input.dreamTranscript');
  const save = screen.getByTestId('btn.saveDream');
  const count = screen.getByTestId('component.recording.draftProgress.count');
  await expect(save).toBeDisabled();
  await expect(screen.getByText('Décris ton rêve', { exact: true })).toHaveCount(0);
  await expect(editor).toHaveAttribute('placeholder', 'Parle-moi de ton rêve…');
  await expect(screen.getByTestId('recording-guest-remaining')).toHaveCount(0);
  await editor.fill(story);
  await expect.poll(() => browser.evaluate(() => localStorage.getItem('noctalia_mock_dogfood_v1:gemini_dream_journal_recording_transcript:guest'))).toContain(story);
  await expect(count).toHaveCount(0);
  await expect(save).toBeEnabled();
  const editorBox = await editor.boundingBox();
  const saveBox = await save.boundingBox();
  if (!editorBox || !saveBox) throw new Error('The editor and save control must have visible bounds.');
  expect(editorBox.height).toBeGreaterThanOrEqual(260);
  expect(saveBox.y).toBeGreaterThanOrEqual(editorBox.y + editorBox.height);
  expect(saveBox.width).toBeGreaterThanOrEqual(340);
  for (const mode of ['light', 'dark'] as const) {
    await browser.emulateMedia({ colorScheme: mode === 'light' ? 'dark' : 'light' });
    await theme(fixtures, mode);
    await expect.poll(() => editorStyle(browser, 'backgroundColor')).toBe(mode === 'light' ? 'rgba(245, 234, 219, 0.88)' : 'rgba(20, 19, 26, 0.84)');
    await expect.poll(() => editorStyle(browser, 'color')).toBe(mode === 'light' ? 'rgb(56, 45, 53)' : 'rgb(255, 249, 239)');
    await expect(editor).toHaveValue(story);
    await expect.poll(() => viewportRatio(browser, 'btn.saveDream')).toBeGreaterThan(0);
    await expect.poll(() => viewportRatio(browser, 'tab.addDream')).toBeGreaterThan(0);
    await app.screenshot(`capture-${mode}`);
  }
  await theme(fixtures, 'auto');
  for (const mode of ['light', 'dark'] as const) {
    await browser.emulateMedia({ colorScheme: mode });
    await expect.poll(() => editorStyle(browser, 'backgroundColor')).toBe(mode === 'light' ? 'rgba(245, 234, 219, 0.88)' : 'rgba(20, 19, 26, 0.84)');
    await expect(editor).toHaveValue(story);
  }
  await save.tap();
  for (const paragraph of story.split('\n\n')) await expect(screen.getByTestId('component.transcriptCard')).toContainText(paragraph);
  await expect(screen.getByTestId('component.dreamDetail.readingZone')).toBeVisible();
  await expect(screen.getByTestId('analysis.reading.modal')).toHaveCount(0);
  await screen.getByTestId('btn.editDream').tap();
  await expect(screen.getByTestId('input.dreamTranscript')).toHaveValue(story);
  await screen.getByTestId('btn.saveDreamEdit').tap();
  await app.screenshot('capture-saved');
});

test('capture keeps long and fragmentary stories editable with a reachable save action in short windows', options, async fixtures => {
  const { screen, browser, app } = fixtures;
  await startFrenchCapture(fixtures);
  const editor = screen.getByTestId('input.dreamTranscript');
  const save = screen.getByTestId('btn.saveDream');
  await editor.fill('Une lumière');
  await expect(save).toBeEnabled();
  await editor.fill(story.repeat(5));
  for (const viewport of [{ width: 320, height: 640 }, { width: 640, height: 390 }]) {
    await browser.setViewport(viewport);
    await expect(editor).toHaveValue(story.repeat(5));
    await save.scrollIntoView();
    await expect.poll(() => viewportRatio(browser, 'btn.saveDream')).toBeGreaterThan(0);
    const box = await save.boundingBox();
    if (!box) throw new Error('The save control must have visible bounds.');
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    await app.screenshot(`capture-${viewport.width}x${viewport.height}`);
  }
  await editor.fill('   ');
  await expect(save).toBeDisabled();
});

test('capture stops a dream at 20,000 characters and its count shows the maximum only near it', options, async fixtures => {
  const { screen, app } = fixtures;
  await startFrenchCapture(fixtures);
  const editor = screen.getByTestId('input.dreamTranscript');
  const counter = screen.getByTestId('component.recording.draftProgress.count');
  await editor.fill('r'.repeat(17999));
  await expect(counter).toHaveCount(0);
  await editor.fill('r'.repeat(18500));
  await expect(counter).toHaveText(/^18\s500 \/ 20\s000 caractères$/);
  await editor.fill('r'.repeat(20000));
  await editor.press('End');
  await editor.pressSequentially('encore');
  await expect(editor).toHaveValue('r'.repeat(20000));
  await expect(counter).toHaveText(/^20\s000 caractères, le maximum$/);
  await expect(screen.getByTestId('btn.saveDream')).toBeEnabled();
  await app.screenshot('capture-length-limit');
});
