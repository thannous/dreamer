// QA inspection (not a TesterArmy journey), campaign 2026-10-22: mock web dev server of the candidate.
// U01: notes/guides/collection in six locales at 320 px; Q01 UI: 4001 characters, 50 notes.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(new URL('../../../../tools/e2e/package.json', import.meta.url));
const { chromium } = require('playwright');
const base = process.env.QA_WEB_URL ?? 'http://127.0.0.1:8096';
// Screenshots stay outside Git (private QA artifacts).
const out = process.env.QA_OUT ?? 'test-results/qa-progression-inspect';
mkdirSync(out, { recursive: true });
const locales = (process.argv[2] ?? 'fr-FR,en-US,de-DE,es-ES,it-IT,pt-BR').split(',');
const limits = process.argv.includes('--limits');
const RAW_KEY = /\b(?:notes|guides?|guide_reading|collection|badges?|common|rediscovery|home)\.[a-z0-9_]+(?:\.[a-z0-9_]+)*\b/g;
const report = {};
const browser = await chromium.launch();

async function onboard(page) {
  await page.goto(`${base}/`, { timeout: 400000 });
  await page.getByTestId('btn.onboarding.intro.next').click({ timeout: 180000 });
  await page.getByTestId('btn.onboarding.skip').click();
  await page.getByTestId('screen.recording').waitFor();
}
async function audit(page, label, tag) {
  const data = await page.evaluate((source) => {
    const re = new RegExp(source, 'g');
    const text = document.body.innerText;
    const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    // Visible elements whose box exceeds the viewport on the right (clipped text, buttons).
    const vw = window.innerWidth;
    const outside = [...document.querySelectorAll('[role="button"], button, [data-testid]')]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right > vw + 1; })
      .slice(0, 8).map((el) => (el.getAttribute('data-testid') || el.textContent || '').slice(0, 60));
    return { rawKeys: [...new Set(text.match(re) ?? [])], overflowX, outside };
  }, RAW_KEY.source);
  await page.screenshot({ path: `${out}/${tag}-${label}.png` });
  return data;
}

for (const locale of locales) {
  const tag = locale;
  const context = await browser.newContext({ viewport: { width: 320, height: 640 }, locale, deviceScaleFactor: 1, timezoneId: 'Europe/Paris', reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  const entry = { errors };
  try {
    await onboard(page);
    await page.getByTestId('input.dreamTranscript').fill('QA synthetic dream: a glass bridge over a quiet sea.');
    await page.getByTestId('btn.saveDream').click();
    await page.getByTestId('component.transcriptCard').waitFor({ timeout: 60000 });
    const notes = page.getByTestId('dream.personal-notes');
    await notes.scrollIntoViewIfNeeded();
    await page.getByTestId('dream.note.add').click();
    await page.getByTestId('dream.note.input').fill('QA synthetic note');
    entry.editorText = (await notes.innerText()).replace(/\s+/g, ' ').slice(0, 400);
    entry.notesEditor = await audit(page, 'notes-editor', tag);
    await page.getByTestId('dream.note.save').click();
    await page.getByTestId('dream.note.input').waitFor({ state: 'detached' });
    entry.notesSavedText = (await notes.innerText()).replace(/\s+/g, ' ').slice(0, 400);
    entry.notesSaved = await audit(page, 'notes-saved', tag);

    if (limits) {
      // Q01 UI: a 4001-character paste, then the 50-note ceiling.
      await page.getByTestId('dream.note.add').click();
      const input = page.getByTestId('dream.note.input');
      await input.fill('z'.repeat(4001));
      entry.paste4001 = { valueLength: (await input.inputValue()).length, notesText: (await notes.innerText()).match(/\d+\s*\/\s*4000/)?.[0] ?? null };
      await page.getByRole('button', { name: /cancel|annuler/i }).last().click();
      for (let i = 2; i <= 50; i += 1) {
        await page.getByTestId('dream.note.add').click();
        await page.getByTestId('dream.note.input').fill(`QA note ${i}`);
        await page.getByTestId('dream.note.save').click();
        await page.getByTestId('dream.note.input').waitFor({ state: 'detached' });
      }
      const editButtons = notes.getByRole('button', { name: /edit note|modifier/i });
      entry.atFifty = {
        addButtons: await page.getByTestId('dream.note.add').count(),
        notesCount: await page.locator('[data-testid^="dream.note."]').evaluateAll((els) => els.filter((e) => /^dream\.note\.[0-9a-f-]{36}$/.test(e.getAttribute('data-testid'))).length),
        tailText: (await notes.innerText()).replace(/\s+/g, ' ').slice(-200),
        editEnabled: await editButtons.first().isEnabled(),
      };
      await editButtons.first().click();
      await page.getByTestId('dream.note.input').fill('QA note 1 edited at fifty');
      await page.getByTestId('dream.note.save').click();
      await page.getByTestId('dream.note.input').waitFor({ state: 'detached' });
      entry.atFifty.editSaved = (await notes.innerText()).includes('QA note 1 edited at fifty');
      entry.atFifty.shot = await audit(page, 'notes-fifty', tag);
    }

    await page.getByTestId('btn.navigateJournal').click();
    await page.getByTestId('tab.explore').click();
    await page.getByTestId('btn.explorer.guides').click();
    await page.getByTestId('screen.dreamGuides').waitFor();
    entry.guidesSummary = await page.getByTestId('guides.reading.summary').innerText();
    entry.guidesList = await audit(page, 'guides', tag);
    await page.getByTestId('dream-guide-dream-journal').click();
    entry.guideStatus = await page.getByTestId('guide.reading.status').innerText();
    await page.getByTestId('guide.reading.complete').scrollIntoViewIfNeeded();
    entry.guidePage = await audit(page, 'guide-complete-button', tag);
    await page.getByTestId('guide.reading.complete').click();
    await page.getByTestId('guide.reading.completed').waitFor();
    entry.guideCompletedText = (await page.getByTestId('guide.reading.completed').innerText()).replace(/\s+/g, ' ');
    entry.guideCompleted = await audit(page, 'guide-completed', tag);
    await page.goBack(); await page.goBack();
    await page.getByTestId('btn.explore.collection').click({ timeout: 60000 });
    await page.getByTestId('screen.collection').waitFor();
    await page.waitForTimeout(1500);
    entry.collectionTop = (await page.getByTestId('screen.collection').innerText()).replace(/\s+/g, ' ').slice(0, 300);
    entry.collection = await audit(page, 'collection', tag);
  } catch (error) {
    entry.failure = String(error.message ?? error).split('\n')[0];
    await page.screenshot({ path: `${out}/${tag}-failure.png` }).catch(() => {});
  }
  report[locale] = entry;
  console.log(locale, JSON.stringify(entry));
  await context.close();
}
await browser.close();
writeFileSync(`${out}/report${limits ? '-limits' : ''}.json`, JSON.stringify(report, null, 2));
// The report keeps every locale, but an incomplete inspection is not a pass.
const failed = Object.entries(report).filter(([, entry]) => entry.failure).map(([locale]) => locale);
if (failed.length) {
  console.error(`Inspection incomplete for: ${failed.join(', ')}`);
  process.exitCode = 1;
}
