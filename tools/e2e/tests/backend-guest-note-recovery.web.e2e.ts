import { randomUUID } from 'node:crypto';
import type { Page } from 'playwright/test';
import { test, expect, login, journal, client, admin, restrictNetwork } from '../backend-fixtures';

type WireMutation = { mutation_id: string; client_request_id: string; operation: string; payload: Record<string, unknown> };
type GuestDream = { id: number; transcript: string; remoteId?: number; personalNotes?: { id: string; text: string; createdAt: number; updatedAt: number }[];
  migrationRecovery?: { remoteId: number } };

// Read only the synthetic guest journal and its migration owner. The real web
// journal is in IndexedDB; checking localStorage would miss premature cleanup.
async function guestSnapshot(page: Page, story: string) {
  return page.evaluate(async (transcript: string) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('gemini_dream_journal');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const read = (key: string) => new Promise<string | undefined>((resolve, reject) => {
        const request = db.transaction('storage', 'readonly').objectStore('storage').get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const dreams = JSON.parse(await read('gemini_dream_journal_dreams') ?? '[]') as GuestDream[];
      const claim = JSON.parse(await read('gemini_dream_journal_guest_migration_owner_v1') || 'null');
      return { dreams: dreams.filter(dream => dream.transcript === transcript), claim };
    } finally { db.close(); }
  }, story);
}

test('a guest personal note survives an old create receipt and reload until account migration is durable',
  async ({ page, browserSurface, accounts }) => {
    const owner = client();
    expect((await owner.auth.signInWithPassword(accounts.free)).error).toBeNull();
    const story = `E2E guest note recovery ${randomUUID()}: a notebook beside the river.`;
    const noteText = 'This guest reflection must reach my account before local cleanup.';
    const read = async () => {
      const result = await owner.from('dreams').select('id,transcript,client_request_id,personal_notes').eq('transcript', story);
      expect(result.error).toBeNull();
      return result.data!;
    };
    const state: { legacyRequest?: WireMutation; remoteId?: number; recoveryAllowed: boolean; seeded: boolean; blocked: number } = {
      recoveryAllowed: false, seeded: false, blocked: 0,
    };
    const syncRoute = '**/rest/v1/rpc/sync_dream_mutations';
    await page.route(syncRoute, async route => {
      const request = route.request().postDataJSON() as { mutations: WireMutation[] };
      const noteMutation = request.mutations.find(mutation =>
        (mutation.payload.transcript === story || mutation.payload.remote_id === state.remoteId && state.remoteId !== undefined) &&
        Array.isArray(mutation.payload.personal_notes) && mutation.payload.personal_notes.length > 0);
      if (!noteMutation || state.recoveryAllowed) return route.continue();
      if (state.seeded) { state.blocked += 1; return route.abort(); }
      state.seeded = true;
      expect(noteMutation.operation).toBe('create');
      // Only the owned local backend is modified: the old server stores the
      // dream, omits notes, and keeps a genuinely replayable old-format receipt.
      const legacyMutations = request.mutations.map(mutation => {
        const payload = { ...mutation.payload };
        delete payload.personal_notes;
        return { ...mutation, payload };
      });
      const legacy = await owner.rpc('sync_dream_mutations', { mutations: legacyMutations });
      expect(legacy.error).toBeNull();
      const responses = legacy.data.map((result: { dream?: Record<string, unknown> }) => {
        const dream = { ...result.dream };
        delete dream.personal_notes;
        return { ...result, dream };
      });
      for (const response of responses) {
        const saved = await admin.from('dream_sync_receipts').update({ response })
          .eq('user_id', accounts.free.id).eq('client_request_id', response.client_request_id).select('id').single();
        expect(saved.error).toBeNull();
      }
      const acknowledgement = responses.find((result: { client_request_id: string }) => result.client_request_id === noteMutation.client_request_id);
      expect(acknowledgement.status).toBe('ack');
      state.remoteId = acknowledgement.remote_id;
      state.legacyRequest = noteMutation;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(responses) });
    });
    // Saving can offer a reading or open the story directly, depending on the
    // guest quota snapshot. Decline any AI prompt without requiring one to save.
    const consent = page.getByTestId('modal.aiConsent');
    await page.addLocatorHandler(consent, async modal => {
      await modal.getByTestId('btn.aiConsent.decline').click();
    });
    try {
      await page.goto('/');
      await page.getByTestId('btn.onboarding.intro.next').click();
      await page.getByTestId('btn.onboarding.skip').click();
      await expect(page.getByTestId('screen.recording')).toBeVisible();
      await page.getByTestId('input.dreamTranscript').fill(story);
      await page.getByTestId('btn.saveDream').click();
      const later = page.getByTestId('btn.dreamCaptureSeal.readLater');
      const savedStory = page.getByTestId('component.transcriptCard');
      await expect(later.or(savedStory).first()).toBeVisible();
      if (await later.isVisible()) await later.click();
      await expect(savedStory).toContainText(story);
      await expect(page.getByTestId('component.dreamDetail.readingZone')).toBeHidden();
      expect(await page.evaluate(() => localStorage.getItem('noctalia.aiConsent.v2'))).toBeNull();
      await page.getByTestId('dream.note.add').click();
      await page.getByTestId('dream.note.input').fill(noteText);
      await page.getByTestId('dream.note.save').click();
      await expect(page.getByTestId('dream.note.input')).toHaveCount(0);
      await expect(page.getByTestId('dream.personal-notes')).toContainText(noteText);
      const local = await guestSnapshot(page, story);
      expect(local.dreams).toHaveLength(1);
      expect(local.dreams[0].personalNotes).toEqual([expect.objectContaining({ text: noteText })]);
      const originalNotes = local.dreams[0].personalNotes!;
      expect(await read()).toEqual([]);

      // Sign in from the completed guest session; the login helper intentionally
      // starts onboarding and is used only for the fresh second profile below.
      await journal(page);
      await page.getByTestId('tab.home').filter({ visible: true }).click();
      await page.getByTestId('btn.header.home.settings').click();
      await page.getByTestId('quick-settings.all').click();
      await page.getByTestId('settings-account-open-signin').click();
      await page.getByTestId('input.auth.email').fill(accounts.free.email);
      await page.getByTestId('input.auth.password').fill(accounts.free.password);
      await page.getByTestId('btn.auth.signIn').click();
      await expect(page.getByTestId('screen.recording')).toBeVisible();
      await expect.poll(() => Boolean(state.legacyRequest)).toBe(true);
      expect((await read()).map(row => row.personal_notes)).toEqual([[]]);
      const replay = await owner.rpc('sync_dream_mutations', { mutations: [state.legacyRequest!] });
      expect(replay.error).toBeNull();
      expect(replay.data[0].status).toBe('ack');
      expect(replay.data[0].dream).not.toHaveProperty('personal_notes');
      // The guest copy records the acknowledged identity with a fresh receipt.
      // Restart only once that recovery state is durable on the device.
      await expect.poll(async () => (await guestSnapshot(page, story)).dreams[0]?.migrationRecovery?.remoteId)
        .toBe(state.remoteId);

      // Reload with recovery unavailable: an ID alone must not justify deleting
      // the guest's only complete copy or releasing its claim to another account.
      const blockedBeforeReload = state.blocked;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('screen.recording')).toBeVisible();
      await expect.poll(() => state.blocked).toBeGreaterThan(blockedBeforeReload);
      const retained = await guestSnapshot(page, story);
      expect(retained.dreams).toHaveLength(1);
      expect(retained.dreams[0].personalNotes).toEqual(originalNotes);
      expect(retained.dreams[0].remoteId).toBeUndefined();
      expect(retained.claim).toEqual({ userId: accounts.free.id, dreamIds: [local.dreams[0].id] });
      expect((await read()).map(row => row.personal_notes)).toEqual([[]]);

      state.recoveryAllowed = true;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('screen.recording')).toBeVisible();
      await expect.poll(async () => (await read()).map(row => row.personal_notes)).toEqual([originalNotes]);
      await expect.poll(async () => (await guestSnapshot(page, story)).dreams).toEqual([]);
      await expect.poll(async () => (await guestSnapshot(page, story)).claim).toBeNull();
      const saved = await read();
      expect(saved).toHaveLength(1);
      expect(saved[0].id).toBe(state.remoteId);
      expect(saved[0].client_request_id).toBe(state.legacyRequest!.payload.client_request_id);
      await journal(page);
      await page.getByTestId(/^dream\.item\./).filter({ hasText: story }).click();
      await expect(page.getByTestId('dream.personal-notes')).toContainText(noteText);
      await expect(page.getByTestId('component.transcriptCard')).toContainText(story);

      const fresh = await browserSurface.newContext({ locale: 'en-US', serviceWorkers: 'block' });
      await restrictNetwork(fresh);
      try {
        const second = await fresh.newPage();
        await login(second, accounts.free);
        await journal(second);
        await second.getByTestId(/^dream\.item\./).filter({ hasText: story }).click();
        await expect(second.getByTestId('dream.personal-notes')).toContainText(noteText);
        await expect(second.getByTestId('component.transcriptCard')).toContainText(story);
      } finally { await fresh.close(); }
    } finally {
      await page.removeLocatorHandler(consent);
      await page.unroute(syncRoute);
      await owner.auth.signOut();
    }
  });
