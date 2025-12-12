import { getTranslator } from '@/lib/i18n';
import type { ChatMessage, DreamChatCategory } from '@/lib/types';

const CATEGORY_PROMPT_KEYS: Record<Exclude<DreamChatCategory, 'general'>, string> = {
  symbols: 'dream_chat.prompt.symbols',
  emotions: 'dream_chat.prompt.emotions',
  growth: 'dream_chat.prompt.growth',
};

const SUPPORTED_LANGUAGES = ['en', 'fr', 'es'] as const;

const getPromptVariants = (category: Exclude<DreamChatCategory, 'general'>): string[] => {
  const key = CATEGORY_PROMPT_KEYS[category];
  return SUPPORTED_LANGUAGES.map((lang) => getTranslator(lang)(key));
};

const getErrorVariants = (): string[] => {
  return SUPPORTED_LANGUAGES.map((lang) => getTranslator(lang)('dream_chat.error_message'));
};

const normalizeText = (value: string): string => value.trim().replace(/\s+/g, ' ');

const isNonErrorModelReplyAfter = (history: ChatMessage[], startIndex: number, errorVariants: string[]): boolean => {
  for (let i = startIndex + 1; i < history.length; i++) {
    const msg = history[i];
    if (msg.role !== 'model') continue;
    const candidate = normalizeText(msg.text ?? '');
    if (!candidate) continue;
    if (errorVariants.includes(candidate)) {
      return false;
    }
    return true;
  }
  return false;
};

/**
 * A category is considered explored only if the AI has replied at least once
 * to a category prompt (not just that the user tapped a theme).
 */
export const isCategoryExplored = (
  chatHistory: ChatMessage[] | undefined | null,
  category: Exclude<DreamChatCategory, 'general'>
): boolean => {
  if (!chatHistory?.length) return false;

  const errorVariants = getErrorVariants().map(normalizeText);
  const promptVariants = getPromptVariants(category).map(normalizeText);

  for (let i = 0; i < chatHistory.length; i++) {
    const msg = chatHistory[i];
    if (msg.role !== 'user') continue;

    const matchesMeta = msg.meta?.category === category;
    const matchesText = promptVariants.includes(normalizeText(msg.text ?? ''));

    if (!matchesMeta && !matchesText) continue;

    if (isNonErrorModelReplyAfter(chatHistory, i, errorVariants)) {
      return true;
    }
  }

  return false;
};

