import { test, type Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import type { App, Screen } from 'e2e';
import { isolateWeb } from '../web-fixtures';

// Cards belong to accounts (owner decision, 2026-10-25). A guest's album stays locked, with
// one call to create a free account, yet everything the guest does counts: the first account
// that opens receives it all at once, face down and earned that day, including a dream deleted
// and a favourite let go before signing up. Exact steps only: no model is involved.

const GUEST_LEDGER = 'noctalia_badge_ledger_v2:guest';
const ACCOUNT_LEDGER = 'noctalia_badge_ledger_v2:user:';
const waiting = (count: number) => 'Cards are earned with a free account. What you have done already counts: '
  + `${count} cards are waiting for you when you create your account.`;

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

// Saved, the dream opens on its page; declining the AI keeps it saved and unread.
async function save(screen: Screen, story: string) {
  await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(story);
  await screen.getByTestId('btn.saveDream', { visible: true }).tap();
  await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
  await screen.getByTestId('btn.aiConsent.decline', { visible: true }).tap();
  await expect(screen.getByTestId('modal.aiConsent')).toHaveCount(0);
}

// From a dream's page its own way back, otherwise the tab.
async function journal(screen: Screen) {
  const back = screen.getByTestId('btn.navigateJournal', { visible: true });
  if (await back.isVisible()) await back.tap();
  else await screen.getByTestId('tab.journal', { visible: true }).tap();
  await expect(screen.getByTestId('screen.journal', { visible: true })).toHaveCount(1);
}

async function openDream(screen: Screen, story: string) {
  await screen.getByRole('textbox', 'Search dreams…', { visible: true }).fill(story);
  const item = screen.getByTestId(/^dream\.item\./, { visible: true });
  await expect(item).toHaveCount(1);
  await item.tap();
  await expect(screen.getByTestId('component.transcriptCard', { visible: true })).toContainText(story);
}

// From any tab: the Explore door tells a guest only what waits for its account.
async function openCollection(screen: Screen, door: string) {
  await screen.getByTestId('tab.explore', { visible: true }).tap();
  const entry = screen.getByTestId('btn.explore.collection', { visible: true });
  await expect(entry).toContainText(door);
  await expect(entry).not.toContainText('to reveal');
  await entry.tap();
  await expect(screen.getByTestId('screen.collection', { visible: true })).toBeVisible();
}

const card = (screen: Screen, id: string) => screen.getByTestId(`collection.card.${id}`, { visible: true });

test('a guest holds no card, yet its first account receives everything it did, face down',
  { tags: ['collection', 'guest', 'account'] }, async ({ app, screen, browser }) => {
    await isolateWeb(browser, app);
    await start(app, screen, browser);
    const kept = 'E2E guest collection: a lantern floating above a frozen lake.';
    const deleted = 'E2E guest collection: a corridor of clocks that all said noon.';
    // Marked as a favourite once, from its own page: the ledger keeps it seen.
    await save(screen, kept);
    await screen.getByTestId('btn.dream.favorite', { visible: true }).tap();
    await expect.poll(() => browser.evaluate((key: string) => localStorage.getItem(key) ?? '', GUEST_LEDGER), { timeout: 10_000 })
      .toContain('"treasure-keeper"');
    await journal(screen);
    await screen.getByTestId('tab.addDream', { visible: true }).tap();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
    await save(screen, deleted);
    await journal(screen);

    // The doors never show a held or new card to a guest, only what waits for an account.
    await openCollection(screen, '2 cards waiting for your account');
    const body = screen.getByTestId('collection.guest.body', { visible: true });
    await expect(body).toHaveText(waiting(2));
    await expect(screen.getByTestId('collection.summary')).toHaveCount(0);
    await expect(screen.getByTestId('collection.summary.new')).toHaveCount(0);
    await expect(card(screen, 'night-journal')).toHaveAttribute('aria-label', 'Night Journal. Earned with a free account.');
    await expect(card(screen, 'treasure-keeper')).toHaveAttribute('aria-label', 'Night Treasures. Earned with a free account.');
    await app.screenshot('guest-collection-locked');

    // A card's detail offers the account instead of its family's action, and nothing to turn.
    await card(screen, 'night-journal').tap();
    await expect(screen.getByTestId('collection.detail.reveal')).toHaveCount(0);
    await expect(screen.getByTestId('collection.detail.guest', { visible: true }))
      .toHaveText('This card is earned with a free account. What you already do will count when you create your account.');
    await expect(screen.getByTestId('collection.detail.action', { visible: true })).toHaveText('Create my free account');
    await screen.getByTestId('collection.detail.close', { visible: true }).tap();

    // The favourite is let go and the second dream deleted before the account exists. Each is
    // found with the journal's search, which itself counts: a result opened under a typed search.
    await app.back();
    await journal(screen);
    await openDream(screen, kept);
    await screen.getByTestId('btn.dream.favorite', { visible: true }).tap();
    await app.back();
    await openDream(screen, deleted);
    await screen.getByTestId('btn.dream.delete', { visible: true }).tap();
    await screen.getByRole('button', 'Delete', { visible: true }).tap();
    await expect(screen.getByTestId('screen.journal', { visible: true })).toHaveCount(1);
    // Kept on the device across a reload: nothing the guest did is lost or counted twice.
    await browser.reload();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
    await openCollection(screen, '3 cards waiting for your account');
    await expect(body).toHaveText(waiting(3));
    await expect(card(screen, 'dream-seeker')).toHaveAttribute('aria-label', 'Memory Seeker. Earned with a free account.');

    // The album's own call opens account creation; the account is created there.
    await screen.getByTestId('collection.guest.signup', { visible: true }).tap();
    await expect(screen.getByTestId('screen.account', { visible: true })).toBeVisible();
    await screen.getByTestId('input.auth.email', { visible: true }).fill('e2e.guest.collection@dreamer.app');
    await screen.getByTestId('input.auth.password', { visible: true }).fill('E2e-guest-collection-1');
    const signUpAt = await browser.evaluate(() => Date.now());
    await screen.getByTestId('btn.auth.signUp', { visible: true }).tap();

    // The guest's ledger moves once into the account's own, each tier stamped at sign-up.
    const accountLedger = () => browser.evaluate((prefix: string) => {
      const key = Object.keys(localStorage).find((name) => name.startsWith(prefix));
      return key ? localStorage.getItem(key) : null;
    }, ACCOUNT_LEDGER);
    await expect.poll(accountLedger, { timeout: 15_000 }).toContain('"night-journal"');
    expect(await browser.evaluate((key: string) => localStorage.getItem(key), GUEST_LEDGER)).toBeNull();
    const earned = JSON.parse((await accountLedger())!).earned as Record<string, number[]>;
    expect(Object.keys(earned).sort()).toEqual(['dream-seeker', 'night-journal', 'treasure-keeper']);
    for (const stamps of Object.values(earned)) for (const at of stamps) expect(at).toBeGreaterThanOrEqual(signUpAt);

    // Back in the album: every card arrives face down, the favourite let go included.
    await app.back();
    await expect(screen.getByTestId('screen.collection', { visible: true })).toBeVisible();
    await expect(screen.getByTestId('collection.guest')).toHaveCount(0);
    await expect(screen.getByTestId('collection.summary.count', { visible: true })).toHaveText('3 cards of 43');
    await expect(screen.getByTestId('collection.summary.new', { visible: true })).toContainText('3 new cards to reveal');
    await expect(card(screen, 'night-journal')).toHaveAttribute('aria-label', 'New Bronze card: Night Journal. Ready to reveal.');
    await expect(card(screen, 'treasure-keeper')).toHaveAttribute('aria-label', 'New discovery: Night Treasures. Ready to reveal.');
    await expect(card(screen, 'dream-seeker')).toHaveAttribute('aria-label', 'New discovery: Memory Seeker. Ready to reveal.');
    await app.screenshot('account-receives-guest-cards');

    // Turned over: the deleted dream still counts once toward the next tier.
    await card(screen, 'night-journal').tap();
    await screen.getByTestId('collection.detail.reveal', { visible: true }).tap();
    await expect(screen.getByTestId('collection.detail', { visible: true })).toContainText('Bronze earned on');
    await screen.getByTestId('collection.detail.close', { visible: true }).tap();
    await expect(card(screen, 'night-journal'))
      .toHaveAttribute('aria-label', 'Night Journal. Bronze earned. 2 of 10 toward Silver');
  });
