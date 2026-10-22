import { test, type Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import type { App, Screen } from 'e2e';
import { isolateWeb } from '../web-fixtures';

// The collection counts a dream once it is saved, keeps its new card face down until it is
// turned over, counts a dictionary entry once it has been read, and keeps all of it across
// a reload. Exact steps only: no model is involved.

const LEDGER = 'noctalia_badge_ledger_v1:guest';

async function start(app: App, screen: Screen, browser: Browser) {
  await app.open();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    const unsubscribe = await browser.onDialog('accept');
    try { await screen.getByTestId('btn.onboarding.feature.close', { visible: true }).tap(); }
    finally { await unsubscribe(); }
  }
  await screen.getByTestId('btn.onboarding.skip').tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
}

async function openCollection(screen: Screen) {
  await screen.getByTestId('tab.explore', { visible: true }).tap();
  await screen.getByTestId('btn.explore.collection', { visible: true }).tap();
  await expect(screen.getByTestId('screen.collection', { visible: true })).toBeVisible();
}

const card = (screen: Screen, id: string) => screen.getByTestId(`collection.card.${id}`, { visible: true });

test('a written dream earns its card face down, turned over once and kept after a reload',
  { tags: ['collection', 'persistence'] }, async ({ app, screen, browser }) => {
    await isolateWeb(browser, app);
    await start(app, screen, browser);

    // A guest's first dream is read at once: declining the AI keeps the dream saved, unread.
    const story = 'E2E collection: a glass beach under an enormous moon.';
    const dialogs: string[] = [];
    const decline = await browser.onDialog(async (dialog) => {
      dialogs.push(dialog.message);
      await dialog.dismiss();
    });
    try {
    await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
    await screen.getByTestId('btn.saveDream', { visible: true }).tap();
    await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
    await expect.poll(() => dialogs.length).toBe(1);

    await screen.getByTestId('btn.navigateJournal', { visible: true }).tap();
    await screen.getByTestId('tab.explore', { visible: true }).tap();
    const door = screen.getByTestId('btn.explore.collection', { visible: true });
    await expect(door).toContainText('1 card of 60');
    await expect(door).toContainText('1 new card to reveal');
    await door.tap();
    await expect(screen.getByTestId('screen.collection', { visible: true })).toBeVisible();

    // The journal's own card waits face down; the written dream counts toward its own family.
    await expect(screen.getByTestId('collection.summary.count')).toHaveText('1 card of 60');
    await expect(card(screen, 'night-journal')).toHaveAttribute('aria-label', 'New Bronze card: Night Journal. Ready to reveal.');
    await expect(card(screen, 'ink-dreamer'))
      .toHaveAttribute('aria-label', 'Night Quill. Not earned yet. 1 of 3 toward Bronze');
    await expect(card(screen, 'night-voice'))
      .toHaveAttribute('aria-label', 'Voice of Dreams. Not earned yet. 0 of 1 toward Bronze');
    await app.screenshot('collection-new-card-face-down');

    // The summary's own link opens the card waiting to be turned, its back holding the focus.
    await screen.getByTestId('collection.summary.new', { visible: true }).tap();
    await expect(screen.getByTestId('collection.detail.reveal', { visible: true }))
      .toHaveAttribute('aria-label', /Night Journal/);
    const focused = () => browser.evaluate(() => {
      const active = document.activeElement;
      return {
        testId: active?.getAttribute('data-testid') ?? null,
        role: active?.getAttribute('role') ?? null,
        label: active?.getAttribute('aria-label') ?? null,
        hidden: Boolean(active?.closest('[aria-hidden="true"]')),
      };
    });
    await expect.poll(focused).toMatchObject({ testId: 'collection.detail.reveal', hidden: false });
    // Turned with the keyboard: the focus leaves the back for the revealed face, never staying
    // in a part hidden from assistive technology.
    await browser.keyboard.press('Enter');
    await expect.poll(focused).toEqual({ testId: null, role: 'img', label: 'Night Journal, Bronze', hidden: false });
    await expect(screen.getByTestId('collection.detail.tier.bronze', { visible: true })).toBeVisible();
    await expect(screen.getByTestId('collection.detail')).toContainText('Next tier: Silver');
    // The capture waits for the card to settle face up: nothing fading on the way in (opacity
    // through every ancestor), the turn and the lean over, the back and every star of the
    // reveal burst gone.
    await expect.poll(() => browser.evaluate(() => {
      const opacity = (element: Element | null) => {
        let value = 1;
        for (let node = element; node instanceof Element; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
        return value;
      };
      const face = document.querySelector<HTMLElement>('[role="img"][aria-label="Night Journal, Bronze"]');
      const card = face?.parentElement?.parentElement;
      if (!face || !card) return 'no face';
      // The first transformed view inside the face is the one that leans under the hand.
      const leaning = [...face.querySelectorAll<HTMLElement>('*')].find((element) => getComputedStyle(element).transform !== 'none');
      const flat = Math.min(face.getBoundingClientRect().width / face.offsetWidth,
        leaning ? leaning.getBoundingClientRect().width / leaning.offsetWidth : 1);
      // Outside the face, the card box holds only the back and the burst's stars.
      const around = Math.max(0, ...[...card.querySelectorAll('svg')].filter((svg) => !face.contains(svg)).map(opacity));
      const state = { face: opacity(face), around, flat: Number(flat.toFixed(4)) };
      return state.face === 1 && around === 0 && flat > 0.995 ? 'settled' : JSON.stringify(state);
    }), { timeout: 10_000 }).toBe('settled');
    await app.screenshot('collection-bronze-revealed');
    await screen.getByTestId('collection.detail.close', { visible: true }).tap();
    await expect(card(screen, 'night-journal'))
      .toHaveAttribute('aria-label', 'Night Journal. Bronze earned. 1 of 25 toward Silver');
    await expect(screen.getByTestId('collection.summary.new')).toHaveCount(0);

    // The family's own way in leads to the dictionary; an entry read for a moment counts once.
    await card(screen, 'symbol-explorer').tap();
    await screen.getByTestId('collection.detail.action', { visible: true }).tap();
    await screen.getByTestId('symbol.popular.water', { visible: true }).tap();
    await expect(screen.getByTestId('screen.symbolDetail', { visible: true })).toBeVisible();
    await expect.poll(() => browser.evaluate((key: string) => localStorage.getItem(key) ?? '', LEDGER), { timeout: 10_000 })
      .toContain('"symbol-explorer":["water"]');

    // After a reload, nothing earned or turned over is lost, and nothing counts twice.
    await browser.reload();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
    await openCollection(screen);
    await expect(card(screen, 'night-journal'))
      .toHaveAttribute('aria-label', 'Night Journal. Bronze earned. 1 of 25 toward Silver');
    await expect(card(screen, 'symbol-explorer'))
      .toHaveAttribute('aria-label', 'Symbol Explorer. Not earned yet. 1 of 3 toward Bronze');
    await expect(card(screen, 'ink-dreamer'))
      .toHaveAttribute('aria-label', 'Night Quill. Not earned yet. 1 of 3 toward Bronze');
    await expect(screen.getByTestId('collection.summary.new')).toHaveCount(0);
    await app.screenshot('collection-after-reload');
    } finally { await decline(); }
  });
