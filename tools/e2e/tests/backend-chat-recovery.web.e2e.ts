import { randomUUID } from 'node:crypto';
import { describe, expect, type Screen } from 'e2e';
import { client, journal, login, test } from '../backend-recovery-fixtures';

const reading = 'A lighthouse can be a point of orientation. What does this particular lighthouse bring to mind for you?';
const answer = 'The blue door is the detail you chose. What association does that door have for you?';
const question = 'The blue door stayed in my memory.';

async function openChat(screen: Screen, journalId: number) {
  await screen.getByTestId(`dream.item.${journalId}`, { visible: true }).tap();
  await expect(screen.getByTestId('screen.dreamDetail', { visible: true })).toBeVisible();
  const action = screen.getByTestId('component.dreamDetail.actionCard', { visible: true });
  await action.scrollIntoView();
  await action.tap();

  // After reload, the saved conversation may open directly.
  const freeChat = screen.getByTestId('btn.dreamCategory.freeChat', { visible: true });
  const input = screen.getByTestId('chat.input.message', { visible: true });
  await expect(freeChat.or(input).first()).toBeVisible();
  if (await freeChat.isVisible()) await freeChat.tap();
  await expect(input).toBeEnabled();
}

describe('Chat recovery on the local backend', { tags: ['chat-recovery'] }, () => {
  test('retrying a lost completion keeps one exchange and one quota charge after reload', {
    timeout: 180_000,
  }, async ({ accounts, browser, page, recovery, screen }) => {
    const owner = client();
    const { error: signInError } = await owner.auth.signInWithPassword(accounts.plus);
    expect(signInError).toBeNull();
    try {
      const inserted = await owner.from('dreams').insert({
        user_id: accounts.plus.id,
        title: 'Recovery conversation',
        transcript: 'I walked to a lighthouse. Its door was blue and I could hear the sea.',
        interpretation: reading,
        shareable_quote: '',
        dream_type: 'Everyday Dream',
        theme: 'calm',
        client_request_id: randomUUID(),
        analysis_status: 'done',
        is_analyzed: true,
        analyzed_at: new Date().toISOString(),
        chat_history: [],
      }).select('id,created_at').single();
      if (inserted.error) throw inserted.error;
      const dreamId = inserted.data.id;
      const journalId = Date.parse(inserted.data.created_at);
      expect(Number.isFinite(journalId)).toBe(true);
      const quota = () => owner.rpc('get_authenticated_quota_snapshot', { p_target_dream_id: dreamId });
      const history = () => owner.from('dreams').select('chat_history').eq('id', dreamId).single();
      const before = await quota();
      if (before.error) throw before.error;

      await login(page, accounts.plus);
      await journal(page);
      await openChat(screen, journalId);
      // Drop the acknowledgement after the real backend records the chat.
      await recovery.control({ reset: true, chatDropDone: true });
      await screen.getByTestId('chat.input.message', { visible: true }).fill(question);
      await screen.getByTestId('chat.button.send', { visible: true }).tap();
      const consent = screen.getByTestId('modal.aiConsent');
      await expect(consent).toBeVisible();
      await consent.getByTestId('btn.aiConsent.accept').tap();

      const retry = screen.getByRole('button', 'Try again', { exact: true, visible: true });
      await expect(retry).toBeVisible({ timeout: 45_000 });
      expect(await recovery.state()).toMatchObject({ droppedChatCompletions: 1, chatProviderCalls: 1 });
      const committed = await history();
      if (committed.error) throw committed.error;
      expect(committed.data.chat_history.map(({ role, text }: { role: string; text: string }) => ({ role, text }))).toEqual([
        { role: 'user', text: question },
        { role: 'model', text: answer },
      ]);

      await retry.tap();
      const visibleAnswer = screen.getByText(answer, { exact: true, visible: true });
      const visibleQuestion = screen.getByText(question, { exact: true, visible: true });
      await expect(visibleAnswer).toHaveCount(1, { timeout: 30_000 });
      await expect(visibleQuestion).toHaveCount(1);
      await expect(retry).toHaveCount(0);

      await browser.reload();
      await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
      await screen.getByTestId('tab.journal', { visible: true }).tap();
      await expect(screen.getByTestId('screen.journal', { visible: true })).toBeVisible();
      await openChat(screen, journalId);
      await expect(visibleAnswer).toHaveCount(1);
      await expect(visibleQuestion).toHaveCount(1);

      const final = await history();
      if (final.error) throw final.error;
      expect(final.data.chat_history).toEqual(committed.data.chat_history);
      const after = await quota();
      if (after.error) throw after.error;
      expect(after.data.usage.messages.used).toBe(before.data.usage.messages.used + 1);
      const recovered = await recovery.state();
      expect(recovered.chatRequests).toHaveLength(2);
      expect(recovered.chatRequests[0]).toMatch(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);
      expect(recovered.chatRequests[1]).toBe(recovered.chatRequests[0]);
      expect(recovered).toMatchObject({ chatProviderCalls: 1, blockedExternalRequests: 0 });
    } finally {
      await owner.auth.signOut({ scope: 'local' });
    }
  });
});
