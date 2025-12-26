import { describe, expect, it } from 'vitest';

import { getLocalDateKey, shouldResetDailyProgress } from '@/lib/ritualProgressUtils';

describe('ritualProgressUtils', () => {
  it('[B] Given a local Date When building the key Then it returns YYYY-MM-DD', () => {
    // Given
    const date = new Date(2024, 0, 2, 10, 30, 0);

    // When
    const key = getLocalDateKey(date);

    // Then
    expect(key).toBe('2024-01-02');
  });

  it('[E] Given a previous key When the day changes Then it requires a reset', () => {
    // Given
    const previous = '2024-01-02';
    const sameDay = new Date(2024, 0, 2, 23, 59, 59);
    const nextDay = new Date(2024, 0, 3, 0, 0, 0);

    // When
    const resetSameDay = shouldResetDailyProgress(previous, sameDay);
    const resetNextDay = shouldResetDailyProgress(previous, nextDay);

    // Then
    expect(resetSameDay).toBe(false);
    expect(resetNextDay).toBe(true);
  });
});

