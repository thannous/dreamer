import type { App, Screen } from 'e2e';
import type { Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import { test } from '../traced-parity-test';
import { webLocale } from '../web-engine';

const paragraphs = ['Une porte bleue donnait sur le lac.', 'J’avais la clé dans ma poche.'];
const story = paragraphs.join('\n\n');
const journalKey = 'noctalia_mock_dogfood_v1:gemini_dream_journal_dreams';
const draftKey = 'noctalia_mock_dogfood_v1:gemini_dream_journal_recording_transcript:guest';
const options = {
  tags: ['first-text-capture', 'locale-fr-FR', 'zone-sauvegarde'],
  skip: webLocale !== 'fr-FR' ? 'Requires the French first-launch context (E2E_WEB_LOCALE=fr-FR)' : false,
  timeout: 180_000,
};

type Fixtures = { app: App; screen: Screen; browser: Browser };

async function markObservation(browser: Browser, name: string) {
  if (process.env.EXPO_PUBLIC_PERFORMANCE_TRACING !== 'true') return;
  await browser.evaluate(label => {
    console.info(`[FirstTextQA] ${label} elapsed_ms=${performance.now().toFixed(1)}`);
    return null;
  }, name);
}

// Browser layout stress only. Measure every original size before applying the
// scale so that nested spans do not inherit the increase twice.
async function doubleWebText(browser: Browser, testID: string) {
  await browser.evaluate(id => {
    const root = document.querySelector(`[data-testid="${id}"]`);
    if (!root) throw new Error(`Missing surface: ${id}`);
    const sizes = [...root.querySelectorAll<HTMLElement>('[dir="auto"], textarea')]
      .filter(node => node.matches('textarea') || [...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE))
      .map(node => ({ node, size: parseFloat(getComputedStyle(node).fontSize), line: parseFloat(getComputedStyle(node).lineHeight) }));
    for (const { node, size, line } of sizes) {
      node.style.fontSize = `${size * 2}px`;
      if (Number.isFinite(line)) node.style.lineHeight = `${line * 2}px`;
    }
    return null;
  }, testID);
}

async function firstEditor({ app, browser, screen }: Fixtures) {
  await app.open();
  const skip = screen.getByRole('button', 'Passer', { exact: true, visible: true });
  await expect(skip).toBeVisible();
  expect(await browser.evaluate(() => localStorage.getItem('noctalia.aiConsent.v2'))).toBeNull();
  await markObservation(browser, 'before-skip');
  await skip.tap();
  const editor = screen.getByTestId('input.dreamTranscript', { visible: true });
  await expect(editor).toHaveValue('');
  await markObservation(browser, 'field-visible');
  await editor.tap();
  await expect.poll(() => browser.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null)).toBe('input.dreamTranscript');
  await markObservation(browser, 'field-focused');
  return editor;
}

async function readStory({ browser, screen }: Fixtures) {
  const prose = screen.getByTestId('text.dreamDetail.transcript', { visible: true });
  await expect(prose).toHaveText(story);
  await prose.scrollIntoView();
  // The raised initial lives in a separate span. Check the rendered words across
  // spans, with each line clear of the consent modal and the navigation dock.
  await expect.poll(() => browser.evaluate(expected => {
    const block = document.querySelector('[data-testid="text.dreamDetail.transcript"]');
    if (!block || block.textContent !== expected) return false;
    const range = document.createRange();
    range.selectNodeContents(block);
    const lines = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
    return lines.length > 0 && lines.every(rect =>
      block.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)));
  }, story)).toBe(true);
  await markObservation(browser, 'both-paragraphs-readable');
}

test('first French text capture opens directly, saves on one press and can be read again after declining AI', options, async fixtures => {
  const { app, screen, browser } = fixtures;
  const editor = await firstEditor(fixtures);
  await editor.fill(story);
  const save = screen.getByRole('button', 'Ajouter au journal', { exact: true, visible: true });
  await expect(save).toBeEnabled();
  await app.screenshot('direct-first-text-before-save');
  await markObservation(browser, 'before-save');
  await save.tap();
  const consent = screen.getByTestId('modal.aiConsent', { visible: true });
  await expect(consent).toBeVisible();
  await screen.getByTestId('btn.aiConsent.decline', { visible: true }).tap();
  await readStory(fixtures);
  await app.screenshot('first-text-readable-after-refusal');
  const readRecords = () => browser.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '[]') as
    { transcript: string; clientRequestId: string }[], journalKey);
  const records = await readRecords();
  expect(records).toHaveLength(1);
  expect(records[0].transcript).toBe(story);
  expect(records[0].clientRequestId).toBeTruthy();
  await browser.reload();
  await expect(screen.getByTestId('input.dreamTranscript', { visible: true })).toHaveValue('');
  await screen.getByTestId('tab.journal', { visible: true }).tap();
  const entries = screen.getByTestId(/^dream\.item\./, { visible: true });
  await expect(entries).toHaveCount(1);
  await entries.tap();
  await readStory(fixtures);
  const reopened = await readRecords();
  expect(reopened).toHaveLength(1);
  expect(reopened[0]).toMatchObject({ transcript: story, clientRequestId: records[0].clientRequestId });
});

test('first French text capture recovers the last paragraph across an immediate reload and a failed save', options, async fixtures => {
  const { app, browser, screen } = fixtures;
  await browser.setViewport({ width: 320, height: 568 });
  const editor = await firstEditor(fixtures);
  await editor.fill(paragraphs[0]);
  await expect.poll(() => browser.evaluate(key => localStorage.getItem(key), draftKey)).toBe(paragraphs[0]);
  await editor.fill(story);
  // Reload immediately after the last edit, before deliberately waiting for its autosave.
  await browser.reload();
  await expect(editor).toHaveValue(story);
  await editor.tap();
  await doubleWebText(browser, 'screen.recording');
  const save = screen.getByTestId('btn.saveDream', { visible: true });
  await save.scrollIntoView();
  await app.screenshot('first-text-enlarged-before-retry');
  let storageErrors = 0;
  const stop = await browser.onDialog(async dialog => {
    storageErrors++;
    await dialog.accept();
  });
  await browser.evaluate(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) {
        Storage.prototype.setItem = original;
        throw new DOMException('QA: first journal write fails', 'QuotaExceededError');
      }
      original.call(this, name, value);
    };
    return null;
  }, journalKey);
  try {
    await save.tap();
    await expect.poll(() => storageErrors).toBe(1);
    await expect(editor).toHaveValue(story);
    await expect(save).toBeEnabled();
    expect(await browser.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '[]').length, journalKey)).toBe(0);
    expect(await browser.evaluate(key => localStorage.getItem(key), draftKey)).toBe(story);
    await save.doubleTap();
  } finally { await stop(); }
  await expect(screen.getByTestId('modal.aiConsent', { visible: true })).toBeVisible();
  await doubleWebText(browser, 'modal.aiConsent');
  // The modal fades in; its decorative animations continue after it settles.
  await expect.poll(() => browser.evaluate(() => document.getAnimations().filter(animation =>
    animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity).length)).toBe(0);
  await app.screenshot('first-text-choice-at-double-size');
  const choices = await browser.evaluate(() => ['btn.aiConsent.accept', 'btn.aiConsent.decline'].map(id => {
    const element = document.querySelector(`[data-testid="${id}"]`);
    if (!element) throw new Error(`Missing choice: ${id}`);
    const rect = element.getBoundingClientRect();
    const hit = element.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
    console.info(`[FirstTextQA] ${id} viewport=${window.innerHeight} top=${rect.top} bottom=${rect.bottom} hit=${hit}`);
    return { id, top: rect.top, bottom: rect.bottom, height: window.innerHeight, hit };
  }));
  for (const choice of choices) {
    expect(choice.top, choice.id).toBeGreaterThanOrEqual(0);
    expect(choice.bottom, choice.id).toBeLessThanOrEqual(choice.height);
    expect(choice.hit, choice.id).toBe(true);
  }
  const details = screen.getByTestId('btn.aiConsent.details', { visible: true });
  await details.scrollIntoView();
  await details.tap();
  await expect(screen.getByTestId('component.aiConsent.details')).toContainText('Ce qui est envoyé');
  const policy = screen.getByTestId('btn.aiConsent.privacyPolicy', { visible: true });
  await policy.scrollIntoView();
  await expect(policy).toBeVisible();
  await screen.getByTestId('btn.aiConsent.decline', { visible: true }).tap();
  await readStory(fixtures);
  const stored = await browser.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '[]') as { transcript: string }[], journalKey);
  expect(stored).toHaveLength(1);
  expect(stored[0].transcript).toBe(story);
});
