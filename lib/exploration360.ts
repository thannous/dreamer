import { isCategoryExplored } from '@/lib/chatCategoryUtils';
import type { DreamAnalysis, DreamChatCategory } from '@/lib/types';

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

export function hasExploration360Synthesis(dream: DreamAnalysis | null | undefined): boolean {
  const history = dream?.chatHistory;
  if (!history?.length) return false;

  for (let index = 0; index < history.length; index++) {
    const message = history[index];
    if (message.role !== 'user' || !message.meta?.exploration360Synthesis) {
      continue;
    }

    for (let replyIndex = index + 1; replyIndex < history.length; replyIndex++) {
      const reply = history[replyIndex];
      if (reply.role !== 'model') continue;
      if (reply.meta?.isError) break;
      if (reply.text?.trim()) return true;
    }
  }

  return false;
}

export function getExploration360SynthesisStatus(
  dream: DreamAnalysis | null | undefined
): Exploration360SynthesisStatus {
  const progress = getExploration360Progress(dream);
  const hasSynthesis = hasExploration360Synthesis(dream);

  return {
    progress,
    hasSynthesis,
    canGenerateSynthesis: progress.isComplete && !hasSynthesis,
  };
}
