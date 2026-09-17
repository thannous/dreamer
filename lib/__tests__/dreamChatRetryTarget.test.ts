import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('dream chat retry target and message counter', () => {
  const source = readFileSync(join(__dirname, '../../app/dream-chat/[id].tsx'), 'utf8');

  it('reads messageId and focuses the failed reply without auto-sending', () => {
    expect(source).toContain('messageId: routeMessageId');
    expect(source).toContain('targetMessageId');
    expect(source).toContain('TID.Chat.RetryTarget');
    expect(source).toContain("t('dream_chat.retry_target.label')");
    expect(source).toContain('handleRetryMessage(targetFailedMessage)');
    expect(source).toContain('AccessibilityInfo.setAccessibilityFocus');
    expect(source).toContain('|| targetMessageId');
    expect(source).toContain('|| targetMessageId) {');
  });

  it('keeps the targeted retry control at least 44 dp tall', () => {
    expect(source).toContain('retryTargetButton: {');
    expect(source).toContain('minHeight: 44');
    expect(source).toContain('justifyContent: \'center\'');
    expect(source).toContain('alignItems: \'center\'');
  });

  it('shows the chat counter from the first message with guest/free 10 and plus 20 without coercing null to 10', () => {
    expect(source).toContain("QUOTAS[tier === 'plus' ? 'plus' : tier === 'free' ? 'free' : 'guest'].messagesPerDream");
    expect(source).toContain('const shouldShowCounter = typeof messageLimit === \'number\';');
    expect(source).not.toContain('userMessageCount >= 15');
    expect(source).not.toContain('?? 10');
    expect(source).toContain('rawMessageLimit === null');
    expect(source).toContain('? null');
    expect(source).toContain(': fallbackMessageLimit');
  });
});
