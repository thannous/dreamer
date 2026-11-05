import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { isolateWeb } from '../web-fixtures';
import { MOCK_PAINTING, answerAiConsent, journal, selectProfile, settledMotion } from '../dreamer-release-fixtures';

// Act I of the dream story: the arrival from capture opens on the saved moment once. The
// seal carries the dream's next step, which follows the analysis permission: the journal
// asks during the seal whether to analyse a dream it can analyse now, and "Later" leaves
// that offer on the seal (owner decision 2026-10-14, PR #358, which replaced the "Dream
// saved" line and the dock's analysis button with the seal itself).
for (const profile of ['plus', 'existing'] as const) {
  test(`${profile} account lands once on the saved moment with its next step`, async ({ app, screen, browser }) => {
    await isolateWeb(browser, app);
    await selectProfile(app, screen, browser, profile);
    // One run per theme: the moment's sky, orbit and dock fade must hold on both grounds.
    if (profile === 'existing') {
      await screen.getByRole('button', /^(Settings|Paramètres)$/, { visible: true }).tap();
      const light = screen.getByTestId('quick-settings.theme.light', { visible: true });
      await light.tap();
      await expect(light).toHaveAttribute('aria-checked', 'true');
      await screen.getByTestId('quick-settings.close', { visible: true }).tap();
    }
    const story = `E2E ${profile} silver owl above a sleeping mountain.`;
    await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
    await screen.getByTestId('btn.saveDream', { visible: true }).tap();
    // Prologue: the dream is written into the journal and sealed before its page opens.
    await expect(screen.getByTestId('component.recording.dreamSeal')).toHaveCount(1);
    if (profile === 'plus') {
      await expect(screen.getByRole('heading', 'Run an analysis to understand this dream?', { visible: true })).toBeVisible();
      await screen.getByTestId('btn.dreamCaptureSeal.readLater', { visible: true }).tap();
    }
    const moment = screen.getByTestId('component.dreamDetail.savedMoment', { visible: true });
    // The struck seal is the confirmation, and its words offer the next step: no toast or line announces the save.
    const next = moment.getByTestId('btn.dream.primaryCta');
    // Written large under the seal; an account out of free readings is offered this dream's reading with Plus.
    await expect(next).toContainText(profile === 'plus' ? /analyze this dream/i : /analyze this dream with plus/i);
    await expect(screen.getByTestId('text.recording.saveConfirmation')).toHaveCount(0);
    await expect(screen.getByTestId('component.transcriptCard', { visible: true })).toContainText(story);
    await expect(screen.getByTestId('component.dreamRecall.offer', { visible: true })).toContainText('Remember a little more?');
    const back = screen.getByTestId('btn.savedDream.returnToJournal', { visible: true });
    await expect(back).toContainText('Back to journal');
    // The seal stands under the dream's name, above its story; the way back stays at hand below.
    const [nextBox, backBox] = [await next.boundingBox(), await back.boundingBox()];
    expect(nextBox!.y).toBeLessThan(backBox!.y);
    // The arrival is authored motion: record the settled moment, not one of its frames.
    await expect.poll(() => browser.evaluate(() => document.getAnimations().filter(animation =>
      animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity).length)).toBe(0);
    await app.screenshot(`${profile}-saved-moment`);
    // The end of the page lifts the story and the recall question above the action dock.
    await screen.getByTestId('btn.dream.delete').scrollIntoView();
    // Nothing generated yet, so nothing to report.
    await expect(screen.getByTestId('btn.dream.report')).toHaveCount(0);
    await app.screenshot(`${profile}-saved-story-and-recall`);
    await back.tap();
    await expect(screen.getByTestId('screen.journal', { visible: true })).toHaveCount(1);
    await screen.getByRole('textbox', 'Search dreams…', { visible: true }).fill(`${profile} silver owl`);
    const card = screen.getByTestId(/^dream\.item\./, { visible: true });
    await expect(card).toHaveCount(1);
    await card.tap();
    await expect(screen.getByTestId('component.transcriptCard', { visible: true })).toContainText(story);
    await expect(screen.getByTestId('component.dreamDetail.savedMoment')).toHaveCount(0);
    await app.screenshot(`${profile}-revisit-without-moment`);
  });
}

// Act II of the dream story: the analysis is visibly waited for, then the dream's real
// symbols land as a constellation and the reading is brought into view, once.
test('plus account watches its saved dream being read, then lit as a constellation', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await selectProfile(app, screen, browser, 'plus');
  const story = 'E2E lantern drifting over dark water toward a doorway of light.';
  await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
  await screen.getByTestId('btn.saveDream', { visible: true }).tap();
  // The journal asks during the seal; yes opens the page already reading the dream.
  await screen.getByTestId('btn.dreamCaptureSeal.readNow', { visible: true }).tap();
  // A signed-in user's first analysis asks once for permission.
  await answerAiConsent(screen, 'accept');
  await expect(screen.getByTestId('component.dreamDetail.savedMoment', { visible: true })).toBeVisible();
  const wait = screen.getByTestId('component.dreamDetail.readingWait');
  await expect(wait).toContainText('Noctalia is reading your dream…');
  await expect(wait).toContainText('Its symbols and emotions will appear here.');
  await settledMotion(browser);
  await app.screenshot('plus-dream-being-read');
  // The mock reading names three symbols; the constellation draws exactly those.
  const constellation = screen.getByTestId('component.dreamDetail.constellation', { visible: true });
  for (const symbol of ['Water', 'Light', 'Doorway']) await expect(constellation).toContainText(symbol);
  await expect(screen.getByTestId('component.dreamDetail.readingWait')).toHaveCount(0);
  await expect(screen.getByTestId('component.dreamDetail.readingZone', { visible: true })).toContainText('Symbols');
  await expect(screen.getByTestId('modal.aiConsent')).toHaveCount(0);
  await settledMotion(browser);
  const landed = await constellation.boundingBox();
  // The reading lands under the seal, above the story, where the reader already is.
  expect(landed!.y).toBeGreaterThan(0);
  expect(landed!.y + landed!.height).toBeLessThan(844);
  await app.screenshot('plus-reading-constellation');
  // The reading ends on its questions and the dream's own line.
  expect(await browser.evaluate(() => {
    const questions = document.querySelector('[data-testid="component.dreamDetail.reflectionZone"]');
    questions?.scrollIntoView({ block: 'center' });
    return Boolean(questions);
  })).toBe(true);
  const quote = screen.getByTestId('text.dreamDetail.quote', { visible: true });
  await expect(quote).toContainText('«');
  // The last chapter enters after the others; wait until the reader can actually see it.
  await expect.poll(() => browser.evaluate(() => {
    let node: Element | null = document.querySelector('[data-testid="text.dreamDetail.quote"]');
    let opacity = 1;
    for (; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
    return opacity;
  })).toBe(1);
  await app.screenshot('plus-reading-chapters');
  // A return visit shows the constellation lit at once, with no story replayed.
  await journal(screen);
  await screen.getByRole('textbox', 'Search dreams…', { visible: true }).fill('lantern drifting');
  const card = screen.getByTestId(/^dream\.item\./, { visible: true });
  await expect(card).toHaveCount(1);
  await card.tap();
  await expect(screen.getByTestId('component.dreamDetail.constellation')).toContainText('Doorway');
  // A read dream can be reported to us from the end of its page.
  await screen.getByTestId('btn.dream.report').scrollIntoView();
  await expect(screen.getByTestId('btn.dream.report', { visible: true })).toContainText('Report generated content');
  // The seal stays at the head of the reading, at rest.
  await expect(screen.getByTestId('component.dreamDetail.savedMoment')).toHaveCount(1);
  expect(await browser.evaluate(() => [...document.querySelectorAll('[data-testid="component.dreamDetail.constellation"]')]
    .reduce((count, node) => count + node.getAnimations({ subtree: true }).length, 0))).toBe(0);
  await app.screenshot('plus-revisit-constellation-at-rest');
});

// Act III and the epilogue: the illustration is painted in the seal's window, then leaves
// it for the plate at the top of the page without moving what the reader sees (PR #358);
// the journal card glows once; the next visit opens on the plate.
test('plus account watches its dream painted into the window, then finds it glowing in the journal', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await browser.route('https://picsum.photos/**', route => route.fulfill({ path: MOCK_PAINTING, contentType: 'image/webp' }));
  await selectProfile(app, screen, browser, 'plus');
  const story = 'E2E painted harbor where the lanterns float above the tide.';
  await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
  await screen.getByTestId('btn.saveDream', { visible: true }).tap();
  await screen.getByTestId('btn.dreamCaptureSeal.readNow', { visible: true }).tap();
  await answerAiConsent(screen, 'accept');
  await expect(screen.getByTestId('component.dreamDetail.constellation', { visible: true })).toContainText('Doorway');
  await settledMotion(browser);
  await screen.getByTestId('btn.journal.illustrate').scrollIntoView();
  // The seal offers the illustration itself; the page below keeps only the dreamer's own picture.
  const sealBox = (await screen.getByTestId('component.dreamDetail.savedMoment').boundingBox())!;
  const illustrateBox = (await screen.getByTestId('btn.journal.illustrate').boundingBox())!;
  expect(illustrateBox.y >= sealBox.y && illustrateBox.y + illustrateBox.height <= sealBox.y + sealBox.height).toBe(true);
  await expect(screen.getByTestId('btn.journal.addImageFromLibrary')).toHaveCount(1);
  await app.screenshot('plus-seal-offers-illustration');
  // While the illustration lands, the astrolabe holds still: the date engraved on its rim
  // stays whole, never fading out, and nothing but the illustration plays its entrance again.
  await browser.evaluate(() => {
    const w = window as unknown as { __sealDate: { settled: number; lowest: number | null; replayed: number } };
    // Letters seen, each through every view down from the rim's date.
    const seen = () => {
      const date = document.querySelector('[data-testid="component.savedDream.sealDate"]');
      if (!date) return 0;
      return Array.from(date.querySelectorAll('[class*="css-text"]')).filter((letter) => {
        let opacity = 1;
        for (let el: Element | null = letter; el && el !== date.parentElement; el = el.parentElement) {
          opacity *= Number(getComputedStyle(el).opacity);
        }
        return opacity > 0.99;
      }).length;
    };
    // Animations running in the seal outside its window's illustration.
    const replaying = (artwork: Element) => {
      const seal = document.querySelector('[data-testid="component.dreamDetail.savedMoment"]');
      return (seal?.getAnimations({ subtree: true }) ?? []).filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        return animation.playState === 'running' && target instanceof Element && !artwork.contains(target);
      }).length;
    };
    w.__sealDate = { settled: seen(), lowest: null, replayed: 0 };
    const start = performance.now();
    const tick = () => {
      const artwork = document.querySelector('[data-testid="component.dreamDetail.savedMoment.artwork"]');
      if (artwork) {
        w.__sealDate.lowest = Math.min(w.__sealDate.lowest ?? Infinity, seen());
        w.__sealDate.replayed = Math.max(w.__sealDate.replayed, replaying(artwork));
      }
      if (performance.now() - start < 6000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return null;
  });
  await screen.getByTestId('btn.journal.illustrate', { visible: true }).tap();
  // Painted in the seal's window: no canvas of its own is added to the page.
  await expect(screen.getByTestId('component.dreamDetail.savedMoment.artwork')).toHaveCount(1);
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const sealDate = await browser.evaluate(() => (window as unknown as { __sealDate: { settled: number; lowest: number | null; replayed: number } }).__sealDate);
  expect(sealDate.settled).toBeGreaterThan(0);
  expect(sealDate.lowest).toBe(sealDate.settled);
  expect(sealDate.replayed).toBe(0);
  await expect(screen.getByTestId('journal.detail.image.generation_dots')).toHaveCount(0);
  await expect(screen.getByTestId('component.dreamDetail.paintedArtwork')).toHaveCount(0);
  await app.screenshot('plus-painting-landed-in-the-seal');
  // Back at the seal, the reader watches the illustration leave it for the plate at the top of
  // the page, while the reading stays where it is on the screen.
  const readingZone = screen.getByTestId('component.dreamDetail.readingZone', { visible: true });
  await screen.getByTestId('component.dreamDetail.savedMoment').scrollIntoView();
  const readingBefore = await readingZone.boundingBox();
  const plate = screen.getByTestId('btn.journal.illustration.expand');
  await expect(plate).toHaveCount(1);
  await settledMotion(browser);
  expect(Math.abs((await readingZone.boundingBox())!.y - readingBefore!.y)).toBeLessThanOrEqual(2);
  await app.screenshot('plus-painting-on-the-plate');
  await plate.scrollIntoView();
  await plate.tap();
  await expect(screen.getByTestId('modal.journal.illustration.fullscreen', { visible: true })).toBeVisible();
  await screen.getByTestId('btn.journal.illustration.close', { visible: true }).tap();
  await expect(screen.getByTestId('modal.journal.illustration.fullscreen')).toHaveCount(0);
  // Epilogue: the card of the dream just told glows once in the journal, then rests.
  await screen.getByTestId('btn.navigateJournal', { visible: true }).tap();
  await expect(screen.getByTestId('screen.journal', { visible: true })).toHaveCount(1);
  const halo = screen.getByTestId('component.journal.storyHalo');
  await expect(halo).toHaveCount(1);
  // Record the glow at its peak, a third of the way through its single pass.
  await expect.poll(() => browser.evaluate(() => Number(getComputedStyle(
    document.querySelector('[data-testid="component.journal.storyHalo"]') ?? document.body).opacity))).toBeGreaterThan(0.8);
  await app.screenshot('plus-journal-epilogue-glow');
  await expect(halo).toHaveCount(0);
  // The next visit opens on the plate, at rest, the seal at the head of the reading.
  await screen.getByRole('textbox', 'Search dreams…', { visible: true }).fill('lanterns float');
  const card = screen.getByTestId(/^dream\.item\./, { visible: true });
  await expect(card).toHaveCount(1);
  await card.tap();
  await expect(screen.getByTestId('btn.journal.illustration.expand', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('component.dreamDetail.paintedArtwork')).toHaveCount(0);
  await expect(screen.getByTestId('component.dreamDetail.savedMoment.artwork')).toHaveCount(0);
  await expect(screen.getByTestId('component.journal.storyHalo')).toHaveCount(0);
  await app.screenshot('plus-revisit-opens-on-the-plate');
});
