/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockGetPreference = jest.fn();
const mockIsAvailable = jest.fn();
const mockSetEnabled = jest.fn();

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/productAnalytics', () => ({
  getProductAnalyticsPreference: () => mockGetPreference(),
  isProductAnalyticsAvailable: () => mockIsAvailable(),
  setProductAnalyticsEnabled: (enabled: boolean) => mockSetEnabled(enabled),
}));

const { useAnalyticsPreferenceController } = require('../useAnalyticsPreferenceController');

describe('useAnalyticsPreferenceController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPreference.mockResolvedValue('enabled');
    mockIsAvailable.mockReturnValue(true);
    mockSetEnabled.mockResolvedValue(undefined);
  });

  it('loads the saved preference and exposes availability', async () => {
    const { result } = renderHook(() => useAnalyticsPreferenceController());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.available).toBe(true);
    expect(result.current.enabled).toBe(true);
    expect(result.current.status).toBe('analytics.privacy.enabled');
  });

  it('persists an optimistic toggle', async () => {
    const { result } = renderHook(() => useAnalyticsPreferenceController());
    await waitFor(() => expect(result.current.enabled).toBe(true));

    await act(async () => {
      await result.current.toggle(false);
    });

    expect(mockSetEnabled).toHaveBeenCalledWith(false);
    expect(result.current.enabled).toBe(false);
    expect(result.current.error).toBe(false);
    expect(result.current.saving).toBe(false);
  });

  it('rolls a failed activation back to the previous value', async () => {
    mockGetPreference.mockResolvedValue('disabled');
    mockSetEnabled.mockRejectedValueOnce(new Error('write failed'));
    const { result } = renderHook(() => useAnalyticsPreferenceController());
    await waitFor(() => expect(result.current.enabled).toBe(false));

    await act(async () => {
      await result.current.toggle(true);
    });

    expect(result.current.enabled).toBe(false);
    expect(result.current.error).toBe(true);
  });

  it('keeps a failed disable operation fail-closed', async () => {
    mockSetEnabled.mockRejectedValueOnce(new Error('write failed'));
    const { result } = renderHook(() => useAnalyticsPreferenceController());
    await waitFor(() => expect(result.current.enabled).toBe(true));

    await act(async () => {
      await result.current.toggle(false);
    });

    expect(result.current.enabled).toBe(false);
    expect(result.current.error).toBe(true);
  });

  it('stays disabled and skips persistence when analytics is unavailable', async () => {
    mockIsAvailable.mockReturnValue(false);
    const { result } = renderHook(() => useAnalyticsPreferenceController());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.available).toBe(false);
    expect(result.current.enabled).toBe(false);
    expect(result.current.status).toBe('analytics.privacy.unavailable');
    expect(mockGetPreference).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.toggle(true);
    });

    expect(result.current.enabled).toBe(false);
    expect(mockSetEnabled).not.toHaveBeenCalled();
  });
});
