/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockTrackProductEvent = jest.fn();
const mockGetJournalLayoutPreference = jest.fn();
const mockSaveJournalLayoutPreference = jest.fn();
const mockUseFocusEffect = jest.fn();

jest.mock('expo-router', () => ({
  useFocusEffect: (...args: unknown[]) => mockUseFocusEffect(...args),
}));

jest.mock('@/lib/analytics', () => ({
  trackProductEvent: (...args: unknown[]) => mockTrackProductEvent(...args),
}));

jest.mock('@/services/storageService', () => ({
  getJournalLayoutPreference: () => mockGetJournalLayoutPreference(),
  saveJournalLayoutPreference: (preference: unknown) => mockSaveJournalLayoutPreference(preference),
}));

const { useJournalLayoutPreference } = require('../useJournalLayoutPreference');

describe('useJournalLayoutPreference', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetJournalLayoutPreference.mockResolvedValue('cards');
    mockSaveJournalLayoutPreference.mockResolvedValue(undefined);
    mockUseFocusEffect.mockImplementation((callback: () => void | (() => void)) => {
      callback();
    });
  });

  it('emits a layout-change event only after a successful persist of a new value', async () => {
    const { result } = renderHook(() => useJournalLayoutPreference());

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.preference).toBe('cards');
    mockUseFocusEffect.mockImplementation(() => undefined);

    await act(async () => {
      await result.current.setPreference('compact');
    });

    expect(mockSaveJournalLayoutPreference).toHaveBeenCalledWith('compact');
    expect(result.current.preference).toBe('compact');
    expect(mockTrackProductEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackProductEvent).toHaveBeenCalledWith('journal_layout_preference_changed', {
      from: 'cards',
      to: 'compact',
    });
  });

  it('does not emit analytics when the same layout is saved again', async () => {
    mockGetJournalLayoutPreference.mockResolvedValue('compact');
    const { result } = renderHook(() => useJournalLayoutPreference());

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.preference).toBe('compact');
    mockUseFocusEffect.mockImplementation(() => undefined);

    await act(async () => {
      await result.current.setPreference('compact');
    });

    expect(mockSaveJournalLayoutPreference).toHaveBeenCalledWith('compact');
    expect(result.current.preference).toBe('compact');
    expect(mockTrackProductEvent).not.toHaveBeenCalled();
  });

  it('does not update state or emit analytics when persistence fails', async () => {
    mockSaveJournalLayoutPreference.mockRejectedValueOnce(new Error('storage unavailable'));
    const { result } = renderHook(() => useJournalLayoutPreference());

    await waitFor(() => expect(result.current.loaded).toBe(true));
    mockUseFocusEffect.mockImplementation(() => undefined);

    await expect(result.current.setPreference('compact')).rejects.toThrow('storage unavailable');

    expect(result.current.preference).toBe('cards');
    expect(mockTrackProductEvent).not.toHaveBeenCalled();
  });
});
