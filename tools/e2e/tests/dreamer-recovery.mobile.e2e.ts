import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, type TestFixtures } from 'e2e';
import { test, nativeGuest, nativeLogin, nativeJournal } from '../native-backend-fixtures';

// These journeys run in an identified local-backend Release. They use real
// Auth/Postgres, app HTTP, persisted native storage, API handlers and atomic
// quota/job/chat RPCs. Only paid provider replies are deterministic fixtures.
const recoveryOptions = { platforms: ['ios', 'android'], tags: ['native-recovery'], timeout: 300_000 };
const analysisText = 'A lighthouse can be a point of orientation. What does this particular lighthouse bring to mind for you?';
const chatText = 'The blue door is the detail you chose. What association does that door have for you?';
type RecoveryState = {
  analysisProviderCalls: number; chatProviderCalls: number; droppedChatCompletions: number; analysisDispatches: number;
  analysisRequests: string[]; chatRequests: string[]; blockedExternalRequests: number; workerFailures: number; pendingWorkers: number;
};

async function control<T = RecoveryState>(token: string, command?: Record<string, unknown>): Promise<T> {
  const port = Number(process.env.E2E_NATIVE_RECOVERY_PORT ?? 31284);
  if (!Number.isSafeInteger(port) || port < 20000 || port > 32767) throw new Error('Invalid recovery control port');
  const response = await fetch(`http://127.0.0.1:${port}/${command ? '__control' : '__state'}`, {
    method: command ? 'POST' : 'GET', headers: { 'X-E2E-Control-Token': token, 'Content-Type': 'application/json' },
    ...(command ? { body: JSON.stringify(command) } : {}),
  });
  if (!response.ok) throw new Error(`Recovery control failed (${response.status})`);
  return response.json() as Promise<T>;
}

async function tap(screen: TestFixtures['screen'], id: string) {
  const target = screen.getByTestId(id, { visible: true });
  await screen.scrollUntilVisible(target);
  await expect(target).toBeEnabled();
  await target.tap();
}

async function openDream(screen: TestFixtures['screen'], title: string) {
  await nativeJournal(screen);
  const card = screen.getByTestId(/^dream\.item\./, { visible: true }).filter({ hasText: title });
  await expect(card).toHaveCount(1);
  await card.tap();
  await expect(screen.getByTestId('screen.dreamDetail', { visible: true })).toBeVisible();
}

async function acceptAi(screen: TestFixtures['screen']) {
  const consent = screen.getByRole('button', 'Accept and continue', { visible: true });
  await expect(consent).toBeVisible();
  await consent.tap();
  await expect(consent).toHaveCount(0);
}

test('Dreamer queued real analysis survives process restart and completes once with one quota claim', recoveryOptions, async fixtures => {
  const { app, screen, backend } = fixtures;
  const token = backend.state.proxy.controlToken;
  await control(token, { reset: true, analysisHold: true });
  const admin = createClient(backend.state.status.API_URL, backend.state.status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const title = `Recovery lighthouse ${randomUUID().slice(0, 8)}`;
  const transcript = 'I walked to a lighthouse. Its door was blue and I could hear the sea.';
  const inserted = await backend.owner.from('dreams').insert({
    user_id: backend.state.accounts.owner.id, title, transcript, interpretation: '', shareable_quote: '',
    dream_type: 'Everyday Dream', theme: 'calm', client_request_id: randomUUID(),
    analysis_status: 'none', is_analyzed: false,
  }).select('id').single();
  expect(inserted.error).toBeNull();
  const dreamId = inserted.data!.id;
  const before = await backend.owner.rpc('get_authenticated_quota_snapshot', { p_target_dream_id: dreamId });
  expect(before.error).toBeNull();
  try {
    await nativeGuest(fixtures);
    await nativeLogin(fixtures);
    await openDream(screen, title);
    await tap(screen, 'btn.dream.primaryCta');
    await acceptAi(screen);
    await expect.poll(async () => (await control(token)).analysisDispatches, { timeout: 30_000 }).toBeGreaterThan(0);
    const pending = await admin.from('ai_jobs').select('id,status,client_request_id,quota_claimed').eq('dream_id', dreamId);
    expect(pending.error).toBeNull();
    expect(pending.data).toHaveLength(1);
    expect(pending.data![0]).toMatchObject({ status: 'queued', quota_claimed: true });
    expect((await control(token)).analysisProviderCalls).toBe(0);
    // A process restart is the interruption. No simulated React reload, storage
    // injection or completed-result fixture substitutes for it.
    await app.restart();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
    await control(token, { analysisHold: false });
    await expect.poll(async () => {
      const result = await admin.from('ai_jobs').select('status').eq('id', pending.data![0].id).single();
      expect(result.error).toBeNull(); return result.data?.status;
    }, { timeout: 45_000 }).toBe('succeeded');
    await openDream(screen, 'The lighthouse and the blue door');
    const reading = screen.getByText(analysisText, { visible: true });
    await screen.scrollUntilVisible(reading);
    await expect(reading).toHaveCount(1);
    // Reopening again must retain the completed result without buying another
    // analysis, even though the original caller was destroyed mid-request.
    await app.restart();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
    await openDream(screen, 'The lighthouse and the blue door');
    await screen.scrollUntilVisible(reading);
    await expect(reading).toHaveCount(1);
    const after = await backend.owner.rpc('get_authenticated_quota_snapshot', { p_target_dream_id: dreamId });
    expect(after.error).toBeNull();
    expect(after.data.usage.analysis.used).toBe(before.data.usage.analysis.used + 1);
    const completed = await admin.from('ai_jobs').select('id,status,client_request_id,attempt_count').eq('dream_id', dreamId);
    expect(completed.error).toBeNull();
    expect(completed.data).toEqual([{
      id: pending.data![0].id, status: 'succeeded', client_request_id: pending.data![0].client_request_id, attempt_count: 1,
    }]);
    const state = await control(token);
    expect(state.analysisProviderCalls).toBe(1);
    expect(new Set(state.analysisRequests).size).toBe(1);
    expect(state.blockedExternalRequests).toBe(0);
    expect(state.workerFailures).toBe(0);
  } finally {
    await control(token, { analysisHold: false });
    await expect.poll(async () => (await control(token)).pendingWorkers, { timeout: 30_000 }).toBe(0);
  }
});

test('Dreamer real chat retries a lost completion without duplicate messages or message quota', recoveryOptions, async fixtures => {
  const { app, screen, device, backend } = fixtures;
  const token = backend.state.proxy.controlToken;
  await control(token, { reset: true, chatDropDone: true });
  const title = `Recovery conversation ${randomUUID().slice(0, 8)}`;
  const inserted = await backend.owner.from('dreams').insert({
    user_id: backend.state.accounts.owner.id, title,
    transcript: 'I walked to a lighthouse. Its door was blue and I could hear the sea.',
    interpretation: analysisText, shareable_quote: '', dream_type: 'Everyday Dream', theme: 'calm',
    client_request_id: randomUUID(), analysis_status: 'done', is_analyzed: true, chat_history: [],
  }).select('id').single();
  expect(inserted.error).toBeNull();
  const dreamId = inserted.data!.id;
  const before = await backend.owner.rpc('get_authenticated_quota_snapshot', { p_target_dream_id: dreamId });
  expect(before.error).toBeNull();
  const question = 'The blue door stayed in my memory.';
  await nativeGuest(fixtures);
  await nativeLogin(fixtures);
  await openDream(screen, title);
  await tap(screen, 'btn.dream.primaryCta');
  await tap(screen, 'btn.dreamCategory.freeChat');
  const input = screen.getByTestId('chat.input.message', { visible: true });
  await expect(input).toBeEnabled();
  await input.fill(question);
  await device.dismissKeyboard();
  await tap(screen, 'chat.button.send');
  await acceptAi(screen);
  const retry = screen.getByRole('button', 'Try again', { visible: true });
  await expect(retry).toBeVisible({ timeout: 45_000 });
  const interrupted = await control(token);
  expect(interrupted.droppedChatCompletions).toBe(1);
  expect(interrupted.chatProviderCalls).toBe(1);
  const committed = await backend.owner.from('dreams').select('chat_history').eq('id', dreamId).single();
  expect(committed.error).toBeNull();
  expect(committed.data!.chat_history).toHaveLength(2);
  await retry.tap();
  const answer = screen.getByText(chatText, { visible: true });
  await expect(answer).toHaveCount(1, { timeout: 30_000 });
  await expect(screen.getByText(question, { visible: true })).toHaveCount(1);
  await expect(retry).toHaveCount(0);
  const final = await backend.owner.from('dreams').select('chat_history').eq('id', dreamId).single();
  expect(final.error).toBeNull();
  expect(final.data!.chat_history).toEqual(committed.data!.chat_history);
  const after = await backend.owner.rpc('get_authenticated_quota_snapshot', { p_target_dream_id: dreamId });
  expect(after.error).toBeNull();
  expect(after.data.usage.messages.used).toBe(before.data.usage.messages.used + 1);
  const recovered = await control(token);
  expect(recovered.chatRequests).toHaveLength(2);
  expect(new Set(recovered.chatRequests).size).toBe(1);
  expect(recovered.chatProviderCalls).toBe(1);
  expect(recovered.blockedExternalRequests).toBe(0);
  await app.restart();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await openDream(screen, title);
  await tap(screen, 'btn.dream.primaryCta');
  await expect(answer).toHaveCount(1);
  await expect(screen.getByText(question, { visible: true })).toHaveCount(1);
});
