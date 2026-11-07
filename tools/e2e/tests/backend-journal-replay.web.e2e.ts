import { randomUUID } from 'node:crypto';
import type { APIResponse, Page, Route } from 'playwright/test';
import { admin, client, expect, journal, localJournal, login, signInFromCapture, test, type Account } from '../backend-fixtures';

const syncRoute = '**/rest/v1/rpc/sync_dream_mutations';
type Create = { mutation_id: string; client_request_id: string; operation: string; payload: { transcript?: string } };

async function saveStory(page: Page, story: string) {
  await page.getByTestId('settings.back').click();
  await page.getByRole('button', { name: 'Capture', exact: true }).click();
  await page.getByTestId('input.dreamTranscript').fill(story);
  await page.getByTestId('btn.saveDream').click();
  const later = page.getByTestId('btn.dreamCaptureSeal.readLater');
  const detail = page.getByTestId('component.transcriptCard');
  await expect(later.or(detail).first()).toBeVisible();
  if (await later.isVisible()) await later.click();
  await expect(detail).toContainText(story);
}

async function switchFromJournal(page: Page, account: Account) {
  await page.getByTestId('tab.settings').click();
  await page.getByTestId('btn.auth.signOut').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
  await signInFromCapture(page, account);
  // Only the first signed-in account can adopt this browser's guest onboarding.
  const intro = page.getByTestId('btn.onboarding.intro.next');
  const capture = page.getByTestId('screen.recording');
  await expect(intro.or(capture).filter({ visible: true }).first()).toBeVisible();
  if (await intro.isVisible()) {
    await intro.click();
    await page.getByTestId('btn.onboarding.skip').click();
  }
  await expect(capture).toBeVisible();
  await journal(page);
}

// Each case uses its own accounts and browser. The first request really commits,
// but only the test driver can see its response until the chosen fault occurs.
for (const fault of ['lost response', 'account switch'] as const) {
  test(`journal replay after ${fault} preserves one receipt, revision and dream`, async ({ page, accounts }) => {
    const story = `Journal replay ${randomUUID()}. A bell rang twice in the empty square.`;
    const witness = 'The second account sailed a green boat.';
    const a = accounts.free;
    const b = accounts.other;
    const owner = client();
    expect((await owner.auth.signInWithPassword(a)).error).toBeNull();
    const authProbe = client();
    const state: { held?: { route: Route; response: APIResponse; mutation: Create };
      claimed: boolean; released: boolean; waitingForPress: boolean } = {
      claimed: false, released: false, waitingForPress: false,
    };
    const attempts: { subject?: string; requestId: string }[] = [];
    const replays: unknown[] = [];
    const readServer = async () => {
      const dreams = await owner.from('dreams').select('id,user_id,client_request_id,revision_id,transcript');
      const receipts = await admin.from('dream_sync_receipts').select('id,user_id,client_request_id,dream_id,mutation_status,response').eq('user_id', a.id);
      expect(dreams.error).toBeNull();
      expect(receipts.error).toBeNull();
      return { dreams: dreams.data!, receipts: receipts.data! };
    };
    const intercept = async (route: Route) => {
      const body = route.request().postDataJSON() as { mutations: Create[] };
      const mutation = body.mutations.find(item => item.operation === 'create' && item.payload.transcript === story);
      if (!mutation) return route.continue();
      const token = await route.request().headerValue('authorization');
      const user = token ? (await authProbe.auth.getUser(token.replace(/^Bearer /i, ''))).data.user : null;
      attempts.push({ subject: user?.id, requestId: mutation.client_request_id });
      if (!state.claimed) {
        state.claimed = true;
        state.held = { route, mutation, response: await route.fetch() };
        return;
      }
      if (!state.waitingForPress || !await page.evaluate(() => document.documentElement.dataset.journalReplay === '1')) {
        return route.abort('failed');
      }
      const response = await route.fetch();
      const result = await response.json();
      await route.fulfill({ response });
      replays.push(result);
    };
    await page.route(syncRoute, intercept);
    try {
      await login(page, a);
      await saveStory(page, story);
      await expect.poll(() => Boolean(state.held)).toBe(true);
      const first = state.held!;
      expect(first.response.ok()).toBe(true);
      const [ack] = await first.response.json();
      expect(ack).toMatchObject({ status: 'ack', mutation_id: first.mutation.mutation_id, client_request_id: first.mutation.client_request_id });

      const committed = await readServer();
      expect(committed.dreams).toEqual([expect.objectContaining({ id: ack.remote_id, user_id: a.id, transcript: story,
        revision_id: ack.dream.revision_id, client_request_id: first.mutation.client_request_id })]);
      expect(committed.dreams[0].revision_id).toBeTruthy();
      expect(committed.receipts).toEqual([expect.objectContaining({ user_id: a.id, client_request_id: first.mutation.client_request_id,
        dream_id: ack.remote_id, mutation_status: 'ack', response: ack })]);
      const pending = expect.objectContaining({ id: first.mutation.mutation_id, clientRequestId: first.mutation.client_request_id,
        userScope: `user:${a.id}`, payload: expect.objectContaining({ dream: expect.objectContaining({ transcript: story }) }) });
      await expect.poll(async () => (await localJournal(page, a.id)).pending).toEqual([pending]);

      if (fault === 'lost response') {
        const lost = page.waitForEvent('requestfailed', request => request === first.route.request());
        await first.route.abort('failed');
        state.released = true;
        await lost;
        await expect.poll(async () => (await localJournal(page, a.id)).pending).toEqual([pending]);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('screen.recording')).toBeVisible();
      } else {
        const other = client();
        expect((await other.auth.signInWithPassword(b)).error).toBeNull();
        const seeded = await other.from('dreams').insert({ user_id: b.id, client_request_id: randomUUID(), transcript: witness,
          title: 'Green boat', interpretation: '', shareable_quote: '', dream_type: 'Symbolic Dream' });
        expect(seeded.error).toBeNull();
        await journal(page);
        await switchFromJournal(page, b);
        const cards = page.getByTestId(/^dream\.item\./).filter({ visible: true });
        await expect(cards).toHaveCount(1);
        await expect(cards).toContainText(witness);
        const received = page.waitForResponse(response => response.request() === first.route.request());
        // A's held RPC is the only in-flight replay here. Wait for the journal
        // engine to finish processing it before reading B's persisted state.
        const settled = page.waitForEvent('console', message =>
          message.type() === 'log' && message.text() === '[JournalSync] Replay settled after scope change');
        await first.route.fulfill({ response: first.response });
        state.released = true;
        const [late] = await Promise.all([received, settled]);
        expect(late.ok()).toBe(true);
        expect(await late.json()).toEqual([ack]);
        await cards.click();
        await expect(page.getByTestId('component.transcriptCard')).toContainText(witness);
        await journal(page);
        expect((await other.from('dreams').select('transcript')).data).toEqual([{ transcript: witness }]);
        expect((await admin.from('dream_sync_receipts').select('id').eq('user_id', b.id)).data).toEqual([]);
        const localB = await localJournal(page, b.id);
        expect(localB.pending).toEqual([]);
        expect(localB.dreams).not.toContainEqual(expect.objectContaining({ clientRequestId: first.mutation.client_request_id }));
        await expect(cards).toHaveCount(1);
        await expect(cards).toContainText(witness);
        await expect.poll(async () => (await localJournal(page, a.id)).pending).toEqual([pending]);
        // Close only the verifier's session; the browser still has to sign out B itself.
        expect((await other.auth.signOut({ scope: 'local' })).error).toBeNull();
        await switchFromJournal(page, a);
      }

      await expect.poll(async () => (await localJournal(page, a.id)).pending).toEqual([pending]);
      if (fault === 'lost response') await journal(page);
      const card = page.getByTestId(/^dream\.item\./).filter({ hasText: story, visible: true });
      await expect(card).toHaveCount(1);
      await card.click();
      const retry = page.getByText('Retry sync', { exact: true });
      await expect(retry).toBeVisible();
      // While held, automatic retries fail. Open the gate on the actual press
      // so a retry racing the click cannot remove its own button.
      await page.evaluate(() => document.addEventListener('pointerdown', event => {
        for (let node = event.target as Element | null; node; node = node.parentElement) {
          if (node.textContent === 'Retry sync') { document.documentElement.dataset.journalReplay = '1'; break; }
        }
      }, { capture: true }));
      state.waitingForPress = true;
      await retry.click();
      await expect.poll(() => replays.length).toBeGreaterThan(0);
      for (const replay of replays) expect(replay).toEqual([ack]);
      for (const attempt of attempts) expect(attempt).toEqual({ subject: a.id, requestId: first.mutation.client_request_id });
      await expect.poll(() => localJournal(page, a.id)).toMatchObject({ pending: [], dreams: [
        { remoteId: ack.remote_id, revisionId: committed.dreams[0].revision_id, clientRequestId: first.mutation.client_request_id, transcript: story },
      ] });
      await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
      expect(await readServer()).toEqual(committed);
      console.info('[journal-replay]', JSON.stringify({ fault, dream: ack.remote_id, revision: ack.dream.revision_id,
        mutation: first.mutation.mutation_id, request: first.mutation.client_request_id, receipt: committed.receipts[0].id, replays: replays.length }));
    } finally {
      if (state.held && !state.released) await state.held.route.abort('failed').catch(() => undefined);
      await page.unroute(syncRoute);
      await owner.auth.signOut({ scope: 'local' });
    }
  });
}
