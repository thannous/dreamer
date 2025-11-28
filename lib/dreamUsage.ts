import type { DreamAnalysis } from './types';

/**
 * Helpers to derive quota-related info from dreams.
 * Keeping these in one place ensures every screen uses the same definition.
 */

export function isDreamAnalyzed(dream?: DreamAnalysis | null): dream is DreamAnalysis {
  return Boolean(dream?.isAnalyzed && typeof dream.analyzedAt === 'number');
}

export function isDreamExplored(dream?: DreamAnalysis | null): boolean {
  return typeof dream?.explorationStartedAt === 'number';
}

export type DreamDetailAction = 'analyze' | 'explore' | 'continue';

const hasModelResponse = (dream?: DreamAnalysis | null): boolean => {
  return Boolean(dream?.chatHistory?.some((message) => message.role === 'model'));
};

/**
 * Primary CTA state for the dream detail screen.
 * - analyze: the dream is not tagged as analyzed yet
 * - explore: analyzed but no exploration started
 * - continue: an exploration/chat already exists
 */
export function getDreamDetailAction(dream?: DreamAnalysis | null): DreamDetailAction {
  if (!isDreamAnalyzed(dream)) {
    return 'analyze';
  }

  if (isDreamExplored(dream) || hasModelResponse(dream)) {
    return 'continue';
  }

  return 'explore';
}

export function getAnalyzedDreamCount(dreams: DreamAnalysis[]): number {
  return dreams.filter(isDreamAnalyzed).length;
}

export function getExploredDreamCount(dreams: DreamAnalysis[]): number {
  return dreams.filter(isDreamExplored).length;
}

export function getUserChatMessageCount(dream?: DreamAnalysis | null): number {
  if (!dream?.chatHistory?.length) {
    return 0;
  }
  return dream.chatHistory.filter((message) => message.role === 'user').length;
}
