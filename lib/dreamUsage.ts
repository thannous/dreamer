import {
  isRecoverablePendingAnalysis,
  isResumableAnalysisRequest,
} from './analysisRequest';
import { isCategoryExplored } from './chatCategoryUtils';
import {
  canUseExploration360Synthesis,
  EXPLORATION_360_AXES,
  getExploration360Progress,
  hasExploration360Synthesis,
} from './exploration360';
import type { Exploration360AxisId } from './exploration360';
import type { ChatMessage, DreamAnalysis, QuotaMetric, QuotaUsage } from './types';

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

const LEGACY_TRANSCRIPT_PREFIXES = [
  'Here is my dream:',
  'Voici mon rêve :',
  'Voici mon rêve:',
  'Aquí está mi sueño:',
  'Ecco il mio sogno:',
  'Hier ist mein Traum:',
  'Aqui está meu sonho:',
] as const;

const normalizeComparableText = (value: string): string => value.trim().replace(/\s+/g, ' ');

/**
 * A user message is the original dream only when it equals the transcript,
 * optionally wrapped in a known capture prefix. The prefix never exempts
 * chat by itself: without a transcript, only an empty suffix is bootstrap.
 */
export function isOriginalTranscriptMessage(
  message: Pick<ChatMessage, 'role' | 'text'> | null | undefined,
  dream?: Pick<DreamAnalysis, 'transcript'> | null
): boolean {
  if (!message || message.role !== 'user') return false;
  const text = normalizeComparableText(message.text ?? '');
  if (!text) return false;

  const transcript = normalizeComparableText(dream?.transcript ?? '');
  if (transcript && text === transcript) return true;

  return LEGACY_TRANSCRIPT_PREFIXES.some((prefix) => {
    const normalizedPrefix = normalizeComparableText(prefix);
    if (!text.startsWith(normalizedPrefix)) return false;
    const suffix = normalizeComparableText(text.slice(normalizedPrefix.length));
    if (transcript) return suffix === transcript;
    return suffix.length === 0;
  });
}

const hasNonErrorModelResponse = (dream?: DreamAnalysis | null): boolean =>
  Boolean(dream?.chatHistory?.some((message) => message.role === 'model' && !message.meta?.isError));

const hasUserMessage = (dream?: DreamAnalysis | null): boolean =>
  Boolean(dream?.chatHistory?.some((message) => message.role === 'user'));

const hasCategoryProof = (dream?: DreamAnalysis | null): boolean => {
  const history = dream?.chatHistory;
  if (!history?.length) return false;

  return EXPLORATION_360_AXES.some((axis) => {
    if (isCategoryExplored(history, axis.id)) return true;
    return history.some(
      (message) =>
        message.role === 'user' &&
        message.meta?.category === axis.id &&
        !isOriginalTranscriptMessage(message, dream)
    );
  });
};

const hasOpenConversation = (dream?: DreamAnalysis | null): boolean => {
  const history = dream?.chatHistory;
  if (!history?.length) return false;

  const hasNonTranscriptUserMessage = history.some(
    (message) => message.role === 'user' && !isOriginalTranscriptMessage(message, dream)
  );

  return hasNonTranscriptUserMessage || hasCategoryProof(dream);
};

const getLastFailedChatMessageId = (dream?: DreamAnalysis | null): string | null => {
  const history = dream?.chatHistory;
  if (!history?.length) return null;

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    if (message.role !== 'model' || !message.meta?.isError || !message.meta.retry) continue;
    const retryText = message.meta.retry.messageText;
    if (isOriginalTranscriptMessage({ role: 'user', text: retryText }, dream)) continue;
    return message.id;
  }

  return null;
};

export function getDreamAnalysisState(dream?: DreamAnalysis | null): DreamAnalysisState {
  const hasAnalysisContent = Boolean(dream?.interpretation?.trim());
  const hasValidAnalysisTimestamp = isFiniteTimestamp(dream?.analyzedAt);
  const hasLegacyCompletedAnalysis = Boolean(
    dream?.analysisStatus == null &&
      dream?.isAnalyzed === true &&
      hasValidAnalysisTimestamp &&
      hasAnalysisContent
  );
  const rawStatus = dream?.analysisStatus ?? (hasLegacyCompletedAnalysis ? 'done' : 'none');
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
    isExplored: Boolean(isFiniteTimestamp(dream?.explorationStartedAt) || hasOpenConversation(dream)),
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

export type ReflectionStage = 'lecture' | 'approfondir' | 'conversation';

export type ReflectionPrimaryKind =
  | 'analyze'
  | 'wait'
  | 'retry_analysis'
  | 'start_approfondir'
  | 'continue_axis'
  | 'synthesize'
  | 'open_conversation'
  | 'continue_chat'
  | 'retry_chat';

export type ReflectionResumeTarget =
  | { kind: 'detail' }
  | { kind: 'categories' }
  | {
      kind: 'chat';
      category?: Exploration360AxisId;
      mode?: 'synthesis';
      messageId?: string;
    };

export type ReflectionQuotaKind = 'analysis' | 'message' | 'synthesis360' | 'none';

export type ReflectionPrimaryAction = {
  kind: ReflectionPrimaryKind;
  consumesQuota: ReflectionQuotaKind;
  resume: ReflectionResumeTarget;
};

export type ReflectionJourney = {
  stage: ReflectionStage;
  analysisStatus: DreamAnalysisStateStatus;
  isAnalyzed: boolean;
  isPendingFresh: boolean;
  isResumableAnalysis: boolean;
  exploredAxes: Exploration360AxisId[];
  nextAxis: Exploration360AxisId | null;
  hasSynthesis: boolean;
  hasOpenChat: boolean;
  lastFailedChatMessageId: string | null;
  primary: ReflectionPrimaryAction;
};

export type ReflectionJourneyOptions = {
  tier?: string | null;
};

export type JournalDetailPrimaryFamily = 'analyze' | 'explore' | 'continue';

export type ReflectionQuotaHint =
  | { kind: 'none' }
  | { kind: 'unlimited' }
  | { kind: 'unknown'; quota: Exclude<ReflectionQuotaKind, 'none'> }
  | { kind: 'remaining'; quota: Exclude<ReflectionQuotaKind, 'none'>; remaining: number };

function readQuotaMetric(
  usage: QuotaUsage | null | undefined,
  quota: Exclude<ReflectionQuotaKind, 'none'>
): QuotaMetric | undefined {
  if (!usage) return undefined;
  if (quota === 'analysis') return usage.analysis;
  if (quota === 'message') return usage.messages;
  return usage.exploration;
}

/**
 * Visible pre-action quota copy for a reflection CTA.
 * Never invents a remaining count: unknown stays unknown, free resume stays none.
 */
export function getReflectionQuotaHint(
  consumesQuota: ReflectionQuotaKind,
  usage?: QuotaUsage | null,
  options?: { unlimited?: boolean }
): ReflectionQuotaHint {
  if (consumesQuota === 'none') {
    return { kind: 'none' };
  }
  if (options?.unlimited) {
    return { kind: 'unlimited' };
  }

  const metric = readQuotaMetric(usage, consumesQuota);
  if (metric?.limit === null) {
    return { kind: 'unlimited' };
  }
  if (typeof metric?.remaining === 'number' && Number.isFinite(metric.remaining)) {
    return { kind: 'remaining', quota: consumesQuota, remaining: metric.remaining };
  }
  return { kind: 'unknown', quota: consumesQuota };
}


/**
 * Collapse the 9 journey kinds onto the existing Journal detail CTA families.
 * Internal family ids stay analyze / explore / continue for compatibility.
 * Visible copy uses Analyze, then Reflection: Approfondir then Conversation.
 */
export function getJournalDetailPrimaryFamily(
  kind: ReflectionPrimaryKind
): JournalDetailPrimaryFamily {
  if (kind === 'analyze' || kind === 'wait' || kind === 'retry_analysis') {
    return 'analyze';
  }
  if (kind === 'start_approfondir') {
    return 'explore';
  }
  return 'continue';
}

export type ReflectionResumeHref =
  | {
      pathname: '/dream-categories/[id]';
      params: { id: string };
    }
  | {
      pathname: '/dream-chat/[id]';
      params: {
        id: string;
        category?: Exploration360AxisId;
        mode?: 'synthesis';
        messageId?: string;
      };
    };

/**
 * Map a resume target to the Expo Router href used by the Journal detail CTA.
 *
 * `retry_chat` carries `messageId` as a chat param so the failed turn can be
 * identified later. Dream chat currently reads only `id`, `category`, and
 * `mode`, so this does not auto-retry from the Journal CTA.
 */
export function buildReflectionResumeHref(
  dreamId: number,
  resume: ReflectionResumeTarget
): ReflectionResumeHref | null {
  if (resume.kind === 'detail') {
    return null;
  }

  if (resume.kind === 'categories') {
    return {
      pathname: '/dream-categories/[id]',
      params: { id: String(dreamId) },
    };
  }

  const params: {
    id: string;
    category?: Exploration360AxisId;
    mode?: 'synthesis';
    messageId?: string;
  } = { id: String(dreamId) };

  if (resume.category) {
    params.category = resume.category;
  }
  if (resume.mode) {
    params.mode = resume.mode;
  }
  if (resume.messageId) {
    params.messageId = resume.messageId;
  }

  return {
    pathname: '/dream-chat/[id]',
    params,
  };
}

const DETAIL_RESUME: ReflectionResumeTarget = { kind: 'detail' };

function getLecturePrimary(
  dream: DreamAnalysis | null | undefined,
  now: number,
  analysis: DreamAnalysisState
): ReflectionPrimaryAction {
  if (analysis.isPending && !isRecoverablePendingAnalysis(dream, now)) {
    return { kind: 'wait', consumesQuota: 'none', resume: DETAIL_RESUME };
  }

  if (analysis.isFailed || analysis.isPending) {
    const alreadyClaimed = Boolean(dream && isResumableAnalysisRequest(dream));
    return {
      kind: 'retry_analysis',
      consumesQuota: alreadyClaimed ? 'none' : 'analysis',
      resume: DETAIL_RESUME,
    };
  }

  return { kind: 'analyze', consumesQuota: 'analysis', resume: DETAIL_RESUME };
}

function getAnalyzedPrimary(
  dream: DreamAnalysis | null | undefined,
  options: ReflectionJourneyOptions | undefined,
  exploredAxes: Exploration360AxisId[],
  nextAxis: Exploration360AxisId | null,
  hasSynthesis: boolean,
  hasOpenChat: boolean,
  lastFailedChatMessageId: string | null
): ReflectionPrimaryAction {
  if (lastFailedChatMessageId) {
    return {
      kind: 'retry_chat',
      consumesQuota: 'none',
      resume: { kind: 'chat', messageId: lastFailedChatMessageId },
    };
  }

  if (nextAxis) {
    const hasStartedApprofondir =
      exploredAxes.length > 0 ||
      hasOpenChat ||
      isFiniteTimestamp(dream?.explorationStartedAt);

    if (!hasStartedApprofondir) {
      return {
        kind: 'start_approfondir',
        consumesQuota: 'none',
        resume: { kind: 'categories' },
      };
    }

    return {
      kind: 'continue_axis',
      consumesQuota: 'message',
      resume: { kind: 'chat', category: nextAxis },
    };
  }

  if (!hasSynthesis) {
    if (canUseExploration360Synthesis(options?.tier)) {
      return {
        kind: 'synthesize',
        consumesQuota: 'synthesis360',
        resume: { kind: 'chat', mode: 'synthesis' },
      };
    }

    return {
      kind: 'open_conversation',
      consumesQuota: 'none',
      resume: { kind: 'chat' },
    };
  }

  return {
    kind: 'continue_chat',
    consumesQuota: 'none',
    resume: { kind: 'chat' },
  };
}

export function getReflectionJourney(
  dream?: DreamAnalysis | null,
  now = Date.now(),
  options?: ReflectionJourneyOptions
): ReflectionJourney {
  const analysis = getDreamAnalysisState(dream);
  const progress = getExploration360Progress(dream);
  const exploredAxes = EXPLORATION_360_AXES
    .filter((axis) => isCategoryExplored(dream?.chatHistory, axis.id))
    .map((axis) => axis.id);
  const nextAxis = progress.nextAxis?.id ?? null;
  const hasSynthesis = hasExploration360Synthesis(dream);
  const hasOpenChat = hasOpenConversation(dream);
  const lastFailedChatMessageId = getLastFailedChatMessageId(dream);
  const isPendingFresh = analysis.isPending && !isRecoverablePendingAnalysis(dream, now);
  const isResumableAnalysis = Boolean(dream && isResumableAnalysisRequest(dream));

  const primary = !analysis.isAnalyzed
    ? getLecturePrimary(dream, now, analysis)
    : getAnalyzedPrimary(
        dream,
        options,
        exploredAxes,
        nextAxis,
        hasSynthesis,
        hasOpenChat,
        lastFailedChatMessageId
      );

  const stage: ReflectionStage =
    primary.kind === 'analyze' || primary.kind === 'wait' || primary.kind === 'retry_analysis'
      ? 'lecture'
      : primary.kind === 'continue_chat' || primary.kind === 'retry_chat'
        ? 'conversation'
        : 'approfondir';

  return {
    stage,
    analysisStatus: analysis.status,
    isAnalyzed: analysis.isAnalyzed,
    isPendingFresh,
    isResumableAnalysis,
    exploredAxes,
    nextAxis,
    hasSynthesis,
    hasOpenChat,
    lastFailedChatMessageId,
    primary,
  };
}

export type DreamDetailAction = 'analyze' | 'explore' | 'continue';

/**
 * Primary CTA state for the dream detail screen.
 * Internal ids stay analyze / explore / continue for compatibility.
 * - analyze: first action, the dream is not tagged as analyzed yet
 * - explore: analyzed, ready to start reflection (Approfondir)
 * - continue: reflection already started (Approfondir or Conversation)
 *
 * Kept as a compatibility wrapper over `getReflectionJourney`.
 */
export function getDreamDetailAction(
  dream?: DreamAnalysis | null,
  now = Date.now()
): DreamDetailAction {
  return getJournalDetailPrimaryFamily(getReflectionJourney(dream, now).primary.kind);
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
  return dream.chatHistory.filter(
    (message) => message.role === 'user' && !isOriginalTranscriptMessage(message, dream)
  ).length;
}
