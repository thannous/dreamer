import { isCategoryExplored } from '@/lib/chatCategoryUtils';
import type { UserTier } from '@/constants/limits';
import type { ChatMessage, DreamAnalysis, DreamChatCategory } from '@/lib/types';

export type Exploration360AxisId = Exclude<DreamChatCategory, 'general'>;

export type Exploration360Axis = {
  id: Exploration360AxisId;
  titleKey: string;
  descriptionKey: string;
  promptKey: string;
};

export type Exploration360AxisProgress = Exploration360Axis & {
  completed: boolean;
};

export type Exploration360Progress = {
  axes: Exploration360AxisProgress[];
  completedCount: number;
  totalCount: number;
  isComplete: boolean;
  nextAxis: Exploration360Axis | null;
};

export type Exploration360SynthesisStatus = {
  progress: Exploration360Progress;
  hasSynthesis: boolean;
  canGenerateSynthesis: boolean;
};

export const EXPLORATION_360_AXES: readonly Exploration360Axis[] = [
  {
    id: 'symbols',
    titleKey: 'dream_categories.symbols.title',
    descriptionKey: 'dream_categories.symbols.description',
    promptKey: 'dream_chat.prompt.symbols',
  },
  {
    id: 'emotions',
    titleKey: 'dream_categories.emotions.title',
    descriptionKey: 'dream_categories.emotions.description',
    promptKey: 'dream_chat.prompt.emotions',
  },
  {
    id: 'growth',
    titleKey: 'dream_categories.growth.title',
    descriptionKey: 'dream_categories.growth.description',
    promptKey: 'dream_chat.prompt.growth',
  },
] as const;

export function getExploration360Progress(dream: DreamAnalysis | null | undefined): Exploration360Progress {
  const axes = EXPLORATION_360_AXES.map((axis) => ({
    ...axis,
    completed: dream ? isCategoryExplored(dream.chatHistory, axis.id) : false,
  }));
  const completedCount = axes.filter((axis) => axis.completed).length;
  const nextAxis = axes.find((axis) => !axis.completed) ?? null;

  return {
    axes,
    completedCount,
    totalCount: axes.length,
    isComplete: completedCount === axes.length,
    nextAxis,
  };
}

export function getNextExploration360Axis(dream: DreamAnalysis | null | undefined): Exploration360Axis | null {
  return getExploration360Progress(dream).nextAxis;
}

function successfulReplyIndex(history: ChatMessage[], promptIndex: number): number {
  for (let index = promptIndex + 1; index < history.length; index++) {
    const reply = history[index];
    // A later prompt starts another exchange; its reply cannot finish this one.
    if (reply.role === 'user' || reply.meta?.isError) return -1;
    if (reply.role === 'model' && reply.text?.trim()) return index;
  }
  return -1;
}

function latestSynthesisReplyIndex(history: ChatMessage[]): number {
  let latest = -1;
  history.forEach((message, index) => {
    if (message.role === 'user' && message.meta?.exploration360Synthesis) {
      latest = Math.max(latest, successfulReplyIndex(history, index));
    }
  });
  return latest;
}

export function hasExploration360Synthesis(dream: DreamAnalysis | null | undefined): boolean {
  return latestSynthesisReplyIndex(dream?.chatHistory ?? []) >= 0;
}

export function getExploration360SynthesisStatus(
  dream: DreamAnalysis | null | undefined
): Exploration360SynthesisStatus {
  const progress = getExploration360Progress(dream);
  const history = dream?.chatHistory ?? [];
  const latestSynthesis = latestSynthesisReplyIndex(history);
  const hasSynthesis = latestSynthesis >= 0;
  const hasNewExchange = history.some((message, index) =>
    index > latestSynthesis && message.role === 'user' &&
    !message.meta?.exploration360Synthesis && successfulReplyIndex(history, index) > latestSynthesis
  );

  return {
    progress,
    hasSynthesis,
    canGenerateSynthesis: progress.completedCount > 0 && hasNewExchange,
  };
}

export function canUseExploration360Synthesis(tier: UserTier | string | null | undefined): boolean {
  return tier === 'plus';
}
