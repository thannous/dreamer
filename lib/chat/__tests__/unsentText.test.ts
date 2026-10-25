import type { ChatMessage } from '@/lib/types';
import { restoreUnsentChatText } from '../unsentText';

describe('chat draft recovery after consent withdrawal', () => {
  it('restores the exact text typed by the dreamer', () => {
    const composer = { restoreUnsentText: jest.fn() };
    restoreUnsentChatText(composer, 'Pourquoi cette porte bleue ?');
    expect(composer.restoreUnsentText).toHaveBeenCalledWith('Pourquoi cette porte bleue ?');
  });

  it('retains authored text on retries even when displayText is defined', () => {
    const composer = { restoreUnsentText: jest.fn() };
    const retry: NonNullable<NonNullable<ChatMessage['meta']>['retry']> = {
      messageText: 'Ma question', displayText: 'Ma question', userText: 'Ma question',
    };
    restoreUnsentChatText(composer, retry.userText);
    expect(composer.restoreUnsentText).toHaveBeenCalledWith('Ma question');
  });

  it.each(['category', 'synthesis'])('never restores generated %s instructions on send or retry', () => {
    const composer = { restoreUnsentText: jest.fn() };
    const retry = { messageText: 'INTERNAL provider instruction', displayText: 'Ma synthèse', userText: undefined };
    restoreUnsentChatText(composer, retry.userText);
    expect(composer.restoreUnsentText).not.toHaveBeenCalled();
  });
});
