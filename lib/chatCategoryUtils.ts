import type { ChatMessage, DreamChatCategory } from '@/lib/types';

const LEGACY_CATEGORY_PROMPTS: Record<
  Exclude<DreamChatCategory, 'general'>,
  readonly [en: string, fr: string, es: string]
> = {
  symbols: [
    'Tell me about the symbolic meanings in my dream. What do the key symbols represent?',
    'Parle-moi des significations symboliques de mon rêve. Que représentent les symboles clés ?',
    'Cuéntame sobre los significados simbólicos de mi sueño. ¿Qué representan los símbolos clave?',
  ],
  emotions: [
    'Help me understand the emotional landscape of this dream. What emotions am I processing?',
    'Aide-moi à comprendre le paysage émotionnel de ce rêve. Quelles émotions suis-je en train de travailler ?',
    'Ayúdame a entender el paisaje emocional de este sueño. ¿Qué emociones estoy procesando?',
  ],
  growth: [
    'What insights for personal growth can you share based on this dream?',
    'Quelles pistes de croissance personnelle vois-tu dans ce rêve ?',
    '¿Qué ideas de crecimiento personal puedes compartir a partir de este sueño?',
  ],
};

const LEGACY_ERROR_VARIANTS: readonly [en: string, fr: string, es: string] = [
  'Sorry, I encountered an error. Please try again.',
  'Désolé, une erreur est survenue. Réessaie.',
  'Lo siento, ocurrió un error. Inténtalo de nuevo.',
];

const getPromptVariants = (category: Exclude<DreamChatCategory, 'general'>): string[] => {
  return [...LEGACY_CATEGORY_PROMPTS[category]];
};

const getErrorVariants = (): string[] => {
  return [...LEGACY_ERROR_VARIANTS];
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
