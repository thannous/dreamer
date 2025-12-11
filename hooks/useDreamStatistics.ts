import { useMemo, useState } from 'react';
import { getAnalyzedDreamCount, getExploredDreamCount, getUserChatMessageCount } from '@/lib/dreamUsage';
import { calculateStreaks, isWithinDays, startOfDay } from '@/lib/streakUtils';
import type { DreamAnalysis, DreamTheme } from '@/lib/types';

export interface DreamStatistics {
  totalDreams: number;
  favoriteDreams: number;
  dreamsThisWeek: number;
  dreamsThisMonth: number;
  currentStreak: number;
  longestStreak: number;
  averageDreamsPerWeek: number;

  // Time-based data
  dreamsByDay: { weekday: number; count: number }[];
  dreamsOverTime: { timestamp: number; count: number }[];

  // Content analysis
  dreamTypeDistribution: { type: string; count: number; percentage: number }[];
  topThemes: { theme: DreamTheme; count: number }[];

  // Engagement
  totalChatMessages: number;
  dreamsWithChat: number;
  analyzedDreams: number;
  mostDiscussedDream: DreamAnalysis | null;
  mostDiscussedDreamUserMessages: number;
}

const ORDERED_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

export const useDreamStatistics = (dreams: DreamAnalysis[]): DreamStatistics => {
  const [now] = useState(() => Date.now());

  return useMemo(() => {
    const effectiveNow = now;

    const totalDreams = dreams.length;
    const favoriteDreams = dreams.filter(d => d.isFavorite).length;
    const dreamsThisWeek = dreams.filter(d => isWithinDays(d.id, 7, effectiveNow)).length;
    const dreamsThisMonth = dreams.filter(d => isWithinDays(d.id, 30, effectiveNow)).length;

    const streaks = calculateStreaks(dreams);
    const currentStreak = streaks.current;
    const longestStreak = streaks.longest;

    const firstDreamDate = dreams.length > 0
      ? Math.min(...dreams.map(d => d.id))
      : effectiveNow;
    const weeksSinceFirst = Math.max(1, Math.floor((effectiveNow - firstDreamDate) / (7 * 24 * 60 * 60 * 1000)));
    const averageDreamsPerWeek = totalDreams / weeksSinceFirst;

    const dayCount = new Map<number, number>();
    dreams.forEach(dream => {
      const day = new Date(dream.id).getDay();
      dayCount.set(day, (dayCount.get(day) || 0) + 1);
    });

    const dreamsByDay = ORDERED_WEEKDAYS.map(weekday => ({
      weekday,
      count: dayCount.get(weekday) || 0,
    }));

    const dateCount = new Map<number, number>();
    const last30Days = dreams.filter(d => isWithinDays(d.id, 30, effectiveNow));
    last30Days.forEach(dream => {
      const date = startOfDay(dream.id);
      const dayTimestamp = date.getTime();
      dateCount.set(dayTimestamp, (dateCount.get(dayTimestamp) || 0) + 1);
    });

    const today = startOfDay(effectiveNow);
    const dreamsOverTime = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dreamsOverTime.push({
        timestamp: date.getTime(),
        count: dateCount.get(date.getTime()) || 0,
      });
    }

    const typeCount = new Map<string, number>();
    dreams.forEach(dream => {
      const type = dream.dreamType || 'Unknown';
      typeCount.set(type, (typeCount.get(type) || 0) + 1);
    });

    const dreamTypeDistribution = Array.from(typeCount.entries())
      .map(([type, count]) => ({
        type,
        count,
        percentage: totalDreams > 0 ? Math.round((count / totalDreams) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const themeCount = new Map<DreamTheme, number>();
    dreams.forEach(dream => {
      if (dream.theme) {
        themeCount.set(dream.theme, (themeCount.get(dream.theme) || 0) + 1);
      }
    });

    const topThemes = Array.from(themeCount.entries())
      .map(([theme, count]) => ({ theme, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const totalChatMessages = dreams.reduce((sum, dream) => sum + getUserChatMessageCount(dream), 0);
    const dreamsWithChat = getExploredDreamCount(dreams);
    const analyzedDreams = getAnalyzedDreamCount(dreams);

    let mostDiscussedDream: DreamAnalysis | null = null;
    let mostDiscussedDreamUserMessages = 0;
    dreams.forEach((dream) => {
      const userMessages = getUserChatMessageCount(dream);
      if (userMessages > mostDiscussedDreamUserMessages) {
        mostDiscussedDream = dream;
        mostDiscussedDreamUserMessages = userMessages;
      }
    });

    if (mostDiscussedDreamUserMessages === 0) {
      mostDiscussedDream = null;
    }

    return {
      totalDreams,
      favoriteDreams,
      dreamsThisWeek,
      dreamsThisMonth,
      currentStreak,
      longestStreak,
      averageDreamsPerWeek,
      dreamsByDay,
      dreamsOverTime,
      dreamTypeDistribution,
      topThemes,
      totalChatMessages,
      dreamsWithChat,
      analyzedDreams,
      mostDiscussedDream,
      mostDiscussedDreamUserMessages,
    };
  }, [dreams, now]);
};
