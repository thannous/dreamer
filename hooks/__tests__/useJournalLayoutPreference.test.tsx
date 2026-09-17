/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockTrackProductEvent = jest.fn();
const mockGetJournalLayoutPreference = jest.fn();
const mockSaveJournalLayoutPreference = jest.fn();

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React = require('react');
    React.useEffect(callback, [callback]);
  },
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
  });

  it('emits a layout-change event only after a successful persist of a new value', async () => {
    const { result } = renderHook(() => useJournalLayoutPreference());

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.preference).toBe('cards');

    await act(async () => {
      await result.current.setPreference('compact');
    });

    expect(mockSaveJournalLayoutPreference).toHaveBeenCalledWith('compact');
    expect(result.current.preference).toBe('compact');
    expect(mockTrackProductEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackProductEvent).toHaveBeenCalledWith('journal_layout_preference_changed', {
      from: 'cards',
      to: 'compact',
      source: 'settings',
    });

    await act(async () => {
      await result.current.setPreference('compact');
    });

    expect(mockSaveJournalLayoutPreference).toHaveBeenCalledTimes(2);
    expect(mockTrackProductEvent).toHaveBeenCalledTimes(1);
  });

  it('does not emit analytics when the restored layout is saved again', async () => {
    mockGetJournalLayoutPreference.mockResolvedValue('compact');
    const { result } = renderHook(() => useJournalLayoutPreference());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => { await result.current.setPreference('compact'); });
    expect(result.current.preference).toBe('compact');
    expect(mockSaveJournalLayoutPreference).toHaveBeenCalledWith('compact');
    expect(mockTrackProductEvent).not.toHaveBeenCalled();
  });

  it('does not emit analytics when persistence fails', async () => {
    mockSaveJournalLayoutPreference.mockRejectedValueOnce(new Error('storage unavailable'));
    const { result } = renderHook(() => useJournalLayoutPreference());

    await waitFor(() => expect(result.current.loaded).toBe(true));

    await expect(result.current.setPreference('compact')).rejects.toThrow('storage unavailable');

    expect(result.current.preference).toBe('cards');
    expect(mockTrackProductEvent).not.toHaveBeenCalled();
  });
});
