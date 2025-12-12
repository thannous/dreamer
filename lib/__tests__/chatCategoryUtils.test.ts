import { describe, expect, it } from 'vitest';

import { isCategoryExplored } from '../chatCategoryUtils';
import { getTranslator } from '../i18n';
import type { ChatMessage } from '../types';

describe('chatCategoryUtils', () => {
  it('returns false when history is empty', () => {
    expect(isCategoryExplored([], 'symbols')).toBe(false);
  });

  it('returns false when only user prompt exists', () => {
    const history: ChatMessage[] = [{ role: 'user', text: 'Q', meta: { category: 'symbols' } }];
    expect(isCategoryExplored(history, 'symbols')).toBe(false);
  });

  it('returns false when only error message follows prompt', () => {
    const errorFr = getTranslator('fr')('dream_chat.error_message');
    const history: ChatMessage[] = [
      { role: 'user', text: 'Q', meta: { category: 'symbols' } },
      { role: 'model', text: errorFr },
    ];
    expect(isCategoryExplored(history, 'symbols')).toBe(false);
  });

  it('returns true when a non-error model reply follows prompt', () => {
    const history: ChatMessage[] = [
      { role: 'user', text: 'Q', meta: { category: 'symbols' } },
      { role: 'model', text: 'Here is an answer.' },
    ];
    expect(isCategoryExplored(history, 'symbols')).toBe(true);
  });

  it('matches legacy prompt text without meta (any supported language)', () => {
    const promptEn = getTranslator('en')('dream_chat.prompt.symbols');
    const history: ChatMessage[] = [
      { role: 'user', text: promptEn },
      { role: 'model', text: 'Answer' },
    ];
    expect(isCategoryExplored(history, 'symbols')).toBe(true);
  });
});

