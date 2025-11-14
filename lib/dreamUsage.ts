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
