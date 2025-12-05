import { useMemo, useState } from 'react';
import { getAnalyzedDreamCount, getExploredDreamCount, getUserChatMessageCount } from '@/lib/dreamUsage';
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

const startOfDay = (timestamp: number): Date => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date;
};

const isWithinDays = (timestamp: number, days: number, now: number): boolean => {
  const dayInMs = 24 * 60 * 60 * 1000;
  return now - timestamp <= days * dayInMs;
};

const calculateStreaks = (dreams: DreamAnalysis[]): { current: number; longest: number } => {
  if (dreams.length === 0) return { current: 0, longest: 0 };

  const sortedDreams = [...dreams].sort((a, b) => b.id - a.id);
  const dayInMs = 24 * 60 * 60 * 1000;

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();

  const mostRecentDream = new Date(sortedDreams[0].id);
  mostRecentDream.setHours(0, 0, 0, 0);

  const daysSinceLastDream = Math.floor((todayTimestamp - mostRecentDream.getTime()) / dayInMs);

  if (daysSinceLastDream <= 1) {
    currentStreak = 1;

    for (let i = 1; i < sortedDreams.length; i++) {
      const currentDate = new Date(sortedDreams[i - 1].id);
      currentDate.setHours(0, 0, 0, 0);

      const prevDate = new Date(sortedDreams[i].id);
      prevDate.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor((currentDate.getTime() - prevDate.getTime()) / dayInMs);

      if (daysDiff <= 1) {
        currentStreak++;
        tempStreak++;
      } else {
        break;
      }

      longestStreak = Math.max(longestStreak, tempStreak);
    }
  }

  tempStreak = 1;
  for (let i = 1; i < sortedDreams.length; i++) {
    const currentDate = new Date(sortedDreams[i - 1].id);
    currentDate.setHours(0, 0, 0, 0);

    const prevDate = new Date(sortedDreams[i].id);
    prevDate.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor((currentDate.getTime() - prevDate.getTime()) / dayInMs);

    if (daysDiff <= 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }

  longestStreak = Math.max(longestStreak, tempStreak, currentStreak);

  return { current: currentStreak, longest: longestStreak };
};

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
