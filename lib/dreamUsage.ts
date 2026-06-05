import type { DreamAnalysis } from './types';

/**
 * Helpers to derive quota-related info from dreams.
 * Keeping these in one place ensures every screen uses the same definition.
 */

export type DreamAnalysisStateStatus = 'none' | 'pending' | 'failed' | 'done';

export type DreamAnalysisState = {
  status: DreamAnalysisStateStatus;
  isAnalyzed: boolean;
  isPending: boolean;
  isFailed: boolean;
  isExplored: boolean;
  hasAnalysisContent: boolean;
  hasValidAnalysisTimestamp: boolean;
  hasModelResponse: boolean;
  hasUserMessage: boolean;
};

const isFiniteTimestamp = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const hasNonErrorModelResponse = (dream?: DreamAnalysis | null): boolean =>
  Boolean(dream?.chatHistory?.some((message) => message.role === 'model' && !message.meta?.isError));

const hasUserMessage = (dream?: DreamAnalysis | null): boolean =>
  Boolean(dream?.chatHistory?.some((message) => message.role === 'user'));

export function getDreamAnalysisState(dream?: DreamAnalysis | null): DreamAnalysisState {
  const rawStatus = dream?.analysisStatus ?? 'none';
  const hasAnalysisContent = Boolean(dream?.interpretation?.trim());
  const hasValidAnalysisTimestamp = isFiniteTimestamp(dream?.analyzedAt);
  const isPending = rawStatus === 'pending';
  const isFailed = rawStatus === 'failed';
  const isAnalyzed = Boolean(
    rawStatus === 'done' &&
      dream?.isAnalyzed === true &&
      hasValidAnalysisTimestamp &&
      hasAnalysisContent
  );
  const hasModelResponse = hasNonErrorModelResponse(dream);

  return {
    status: isPending ? 'pending' : isFailed ? 'failed' : isAnalyzed ? 'done' : 'none',
    isAnalyzed,
    isPending,
    isFailed,
    isExplored: Boolean(isFiniteTimestamp(dream?.explorationStartedAt) || hasModelResponse),
    hasAnalysisContent,
    hasValidAnalysisTimestamp,
    hasModelResponse,
    hasUserMessage: hasUserMessage(dream),
  };
}

export function isDreamAnalyzed(dream?: DreamAnalysis | null): dream is DreamAnalysis {
  return getDreamAnalysisState(dream).isAnalyzed;
}

export function isDreamExplored(dream?: DreamAnalysis | null): boolean {
  return getDreamAnalysisState(dream).isExplored;
}

export type DreamDetailAction = 'analyze' | 'explore' | 'continue';

/**
 * Primary CTA state for the dream detail screen.
 * - analyze: the dream is not tagged as analyzed yet
 * - explore: analyzed but no exploration started
 * - continue: an exploration/chat already exists
 */
export function getDreamDetailAction(dream?: DreamAnalysis | null): DreamDetailAction {
  const state = getDreamAnalysisState(dream);

  if (!state.isAnalyzed || state.isPending || state.isFailed) {
    return 'analyze';
  }

  if (state.isExplored) {
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
