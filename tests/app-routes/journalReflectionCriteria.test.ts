import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('journal and chat reflection criteria', () => {
  const journal = readFileSync(join(__dirname, '../../app/journal/[id].tsx'), 'utf8');
  const chat = readFileSync(join(__dirname, '../../app/dream-chat/[id].tsx'), 'utf8');

  it('makes stale analysis the only primary action and shows quota from consumesQuota', () => {
    expect(journal).toContain('isStalePrimaryAction ? \'analyze\' : primaryAction');
    expect(journal).toContain("isStalePrimaryAction ? null : renderDetailActionCard(['explore', 'continue'])");
    expect(journal).toContain('getReflectionQuotaHint');
    expect(journal).toContain('reflectionJourney.primary.consumesQuota');
    expect(journal).toContain('TID.Text.DreamDetailQuotaHint');
  });

  it('resumes retry_chat from messageId without auto-sending a new turn', () => {
    expect(chat).toContain('messageId: routeMessageId');
    expect(chat).toContain('targetMessageId');
    expect(chat).toContain('TID.Chat.RetryTarget');
    expect(chat).toContain('if (!dream || !category || category === \'general\' || targetMessageId)');
    expect(chat).toContain('|| targetMessageId) {');
    expect(chat).toContain('const shouldShowCounter = typeof messageLimit === \'number\';');
    expect(chat).toContain("QUOTAS[tier === 'plus' ? 'plus' : tier === 'free' ? 'free' : 'guest'].messagesPerDream");
  });
});
