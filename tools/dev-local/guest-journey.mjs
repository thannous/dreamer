#!/usr/bin/env node
/**
 * `node tools/dev-local/guest-journey.mjs`: the guest journey in the app, against the local
 * backend's real API (tools/dev-local), not the mock. The browser journeys of tools/e2e play
 * guests on the mock; this one goes through the real guest session, the server's quotas and
 * « Nouvel invité ».
 *
 * Needs, on this machine: `node tools/dev-local/dev-local.mjs`, then Metro for the web with its
 * profile: `node scripts/expo-safe-runner.js --profile outputs/dev-local/expo.env start --web`.
 * A new browser profile is a new guest device. Screenshots go to outputs/dev-local/guest-journey/.
 *
 *   --url http://localhost:8081   the app (default)
 *   --headed                      watch it play
 */
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../../', import.meta.url));
const { values: options } = parseArgs({ options: {
  url: { type: 'string', default: process.env.DEV_LOCAL_APP_URL ?? 'http://localhost:8081' },
  headed: { type: 'boolean', default: false },
} });
const dataDir = resolve(process.env.DEV_LOCAL_DIR ?? join(root, 'outputs/dev-local'));
const shots = join(dataDir, 'guest-journey');
rmSync(shots, { recursive: true, force: true });
mkdirSync(shots, { recursive: true });

// The browsers of the e2e tooling (npm run test:testerarmy:browsers), else the root install.
const require = createRequire(join(root, 'tools/e2e/package.json'));
const { chromium } = require('playwright');
// The local API serves the guest session, analyses, quotas and the guest reset.
const API = /\/functions\/v1\/api\/(guest\/session|quota\/status|analyzeDream|dev-local\/guest-reset)$/;

const results = [];
let page;
async function step(name, run) {
  if (results.some((result) => !result.ok)) {
    results.push({ name, ok: false, skipped: true });
    console.log(`skip ${name}`);
    return;
  }
  try {
    const detail = await run();
    results.push({ name, ok: true });
    console.log(`ok   ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    results.push({ name, ok: false });
    console.log(`FAIL ${name} — ${String(error.message).split('\n')[0]}`);
    await page?.screenshot({ path: join(shots, `failure-${results.length}.png`) }).catch(() => {});
  }
}

const browser = await chromium.launch({ headless: !options.headed });
const context = await browser.newContext({ viewport: { width: 393, height: 852 }, locale: 'fr-FR' });
page = await context.newPage();
page.setDefaultTimeout(30_000);
const calls = [];
page.on('response', (response) => {
  const match = API.exec(new URL(response.url()).pathname);
  if (match && response.request().method() === 'POST') calls.push({ route: match[1], status: response.status() });
});
// Browser alerts (react-native-web Alert) are accepted, as a tap on their main action.
page.on('dialog', (dialog) => { void dialog.accept(); });

const visible = (testId) => page.locator(`[data-testid="${testId}"]:visible`).first();
const count = (route, status = 200) => calls.filter((call) => call.route === route && call.status === status).length;
const waitFor = async (what, check, timeout = 30_000) => {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await check()) return;
    await page.waitForTimeout(250);
  }
  throw new Error(`timed out waiting for ${what}`);
};

async function startAsNewGuest() {
  await visible('btn.onboarding.intro.next').click({ timeout: 120_000 });
  const close = visible('btn.onboarding.feature.close');
  if (await close.isVisible({ timeout: 3_000 }).catch(() => false)) await close.click();
  await visible('btn.onboarding.skip').click();
  await visible('screen.recording').waitFor();
}

// The AI consent is asked once, whenever the first AI use comes: accept it wherever it shows.
async function answerConsent() {
  const accept = visible('btn.aiConsent.accept');
  if (await accept.isVisible().catch(() => false)) await accept.click({ timeout: 2_000 }).catch(() => {});
}

/** Saves a dream through the seal; `read` answers the seal's reading question when it asks. */
async function saveDream(story, { read = false } = {}) {
  await visible('input.dreamTranscript').fill(story);
  await visible('btn.saveDream').click();
  const card = visible('component.transcriptCard');
  const readNow = visible('btn.dreamCaptureSeal.readNow');
  const open = visible('btn.dreamCaptureSeal.openDream');
  let asked = false;
  // The seal asks its question once its animation pauses; only after that is it opened by hand.
  const openAfter = Date.now() + 10_000;
  await waitFor('the saved dream', async () => {
    await answerConsent();
    if (await readNow.isVisible().catch(() => false)) {
      asked = true;
      await visible(read ? 'btn.dreamCaptureSeal.readNow' : 'btn.dreamCaptureSeal.readLater').click({ timeout: 2_000 }).catch(() => {});
    } else if (Date.now() > openAfter && await open.isVisible().catch(() => false)) {
      await open.click({ timeout: 2_000 }).catch(() => {});
    }
    return card.isVisible();
  }, 60_000);
  return { asked };
}

async function readingShown() {
  const reading = visible('component.dreamDetail.readingZone');
  await waitFor('the analysis', async () => {
    await answerConsent();
    return ((await reading.textContent().catch(() => '')) ?? '').length > 100;
  }, 60_000);
}

async function openSettings() {
  await page.goto(options.url, { waitUntil: 'domcontentloaded' });
  await visible('tab.home').click({ timeout: 60_000 });
  await visible('btn.header.home.settings').click();
  await visible('quick-settings.all').click();
}

async function openJournal() {
  await page.goto(options.url, { waitUntil: 'domcontentloaded' });
  await visible('tab.journal').click({ timeout: 60_000 });
  await visible('screen.journal').waitFor();
}

async function newDream() {
  await openJournal();
  await visible('tab.addDream').click();
  await visible('screen.recording').waitFor();
}

const stories = [
  'Je marchais dans un jardin la nuit, une lampe restait allumée au bout de l’allée.',
  'Un train de nuit traversait une forêt de lanternes, et je cherchais mon billet.',
  'Une horloge de sable comptait à rebours sous la mer, et personne ne la voyait.',
];

try {
  await step('a new guest gets a session and its quota from the local API', async () => {
    // A cold Metro builds the web bundle on this first request.
    await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 300_000 });
    await startAsNewGuest();
    // Saved before the quota is known, a first dream would be offered a reading instead of read.
    await waitFor('the guest quota', async () => count('guest/session') > 0 && count('quota/status') > 0);
    return `${count('guest/session')} session, ${count('quota/status')} quota read`;
  });

  await step('its first dream is read at once by the server', async () => {
    const { asked } = await saveDream(stories[0]);
    if (asked) throw new Error('the first dream was not read at once');
    await readingShown();
    if (count('analyzeDream') !== 1) throw new Error(`${count('analyzeDream')} analyses answered`);
    await page.screenshot({ path: join(shots, '1-first-dream-read.png') });
  });

  await step('its second dream is read on request', async () => {
    await newDream();
    const { asked } = await saveDream(stories[1], { read: true });
    if (!asked) throw new Error('the seal did not offer to read it');
    await readingShown();
    if (count('analyzeDream') !== 2) throw new Error(`${count('analyzeDream')} analyses answered`);
  });

  await step('its third dream is kept, with an account offered for new analyses', async () => {
    await newDream();
    await saveDream(stories[2]);
    await page.getByText('Tes analyses offertes sont utilisées', { exact: false }).first().waitFor({ timeout: 60_000 });
    const cta = visible('btn.dream.primaryCta');
    await waitFor('the account invitation', async () => /Créer un compte/.test(await cta.textContent().catch(() => '') ?? ''));
    if (count('analyzeDream') !== 2) throw new Error(`${count('analyzeDream')} analyses answered`);
    await page.screenshot({ path: join(shots, '2-analyses-spent.png') });
  });

  await step('« Nouvel invité » refuses while guest dreams remain', async () => {
    await openSettings();
    await visible('guest-local-new-guest-button').click();
    const result = visible('guest-recording-qa-reset-result');
    await waitFor('the refusal', async () => /Supprime d’abord les 3 rêves invités/.test(await result.textContent().catch(() => '') ?? ''));
    if (count('dev-local/guest-reset') !== 0) throw new Error('the server was reset with dreams on the device');
  });

  await step('the journal is emptied by hand', async () => {
    for (let left = 3; left > 0; left -= 1) {
      await openJournal();
      await page.locator('[data-testid^="dream.item."]:visible').first().click();
      await visible('btn.dream.delete').click();
      await page.getByRole('button', { name: 'Supprimer' }).last().click();
      await visible('screen.journal').waitFor();
    }
    await openJournal();
    if (await page.locator('[data-testid^="dream.item."]:visible').count()) throw new Error('a dream is still listed');
  });

  await step('« Nouvel invité » resets this device on the server and reopens the welcome', async () => {
    await openSettings();
    await visible('guest-local-new-guest-button').click();
    await visible('btn.onboarding.intro.next').waitFor({ timeout: 60_000 });
    if (count('dev-local/guest-reset') !== 1) throw new Error('no server reset');
  });

  await step('the new guest\'s first dream is read at once again', async () => {
    await startAsNewGuest();
    // Its quota is read again after the reset, as for the first guest, before its first dream.
    const reset = calls.findIndex((call) => call.route === 'dev-local/guest-reset');
    await waitFor('the new guest quota', async () =>
      calls.slice(reset + 1).some((call) => call.route === 'quota/status' && call.status === 200));
    const { asked } = await saveDream(stories[0]);
    if (asked) throw new Error('the first dream was not read at once');
    await readingShown();
    if (count('analyzeDream') !== 3) throw new Error(`${count('analyzeDream')} analyses answered`);
    await page.screenshot({ path: join(shots, '3-new-guest-read.png') });
  });

  await step('the new guest\'s welcome stays done after a reload', async () => {
    // The welcome skipped after « Nouvel invité » is saved, as on a first launch.
    await openJournal();
    if (await visible('btn.onboarding.intro.next').isVisible().catch(() => false)) {
      throw new Error('the welcome opened again');
    }
  });
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok).length;
console.log(`\n${results.length - failed}/${results.length} guest journey steps passed against ${options.url}. Screenshots: ${shots}`);
process.exit(failed ? 1 : 0);
