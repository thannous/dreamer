import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { forgetGuideReading } from '@/services/guideReadingStore';

import { fetchJSON } from '@/lib/http';
import { signOut } from '@/lib/auth';
import { forgetBadgeLedger } from '@/services/badgeLedgerStore';
import { forgetNotificationDreams } from '@/services/notificationDreamInbox';
import { clearRemoteDreamStorage } from '@/services/storageService';
import {
  finalizeAccountDeletion,
  requestAccountDeletion,
} from '@/services/accountDeletionService';

jest.mock('@/lib/config', () => ({
  getApiBaseUrl: () => 'https://example.functions.supabase.co/api',
}));

jest.mock('@/lib/http', () => ({
  fetchJSON: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  signOut: jest.fn(),
}));

jest.mock('@/services/guideReadingStore', () => ({ forgetGuideReading: jest.fn() }));

jest.mock('@/services/badgeLedgerStore', () => ({ forgetBadgeLedger: jest.fn() }));

jest.mock('@/services/notificationDreamInbox', () => ({
  forgetNotificationDreams: jest.fn(),
}));

jest.mock('@/services/storageService', () => ({
  clearRemoteDreamStorage: jest.fn(),
}));

const mockFetchJSON = jest.mocked(fetchJSON);
const mockSignOut = jest.mocked(signOut);
const mockClearRemoteDreamStorage = jest.mocked(clearRemoteDreamStorage);
const mockForgetGuideReading = jest.mocked(forgetGuideReading);
const mockForgetBadgeLedger = jest.mocked(forgetBadgeLedger);
const mockForgetNotificationDreams = jest.mocked(forgetNotificationDreams);

describe('requestAccountDeletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('issues a DELETE request against the account endpoint', async () => {
    mockFetchJSON.mockResolvedValue({ deleted: true });

    const result = await requestAccountDeletion();

    expect(result).toEqual({ deleted: true });
    expect(mockFetchJSON).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetchJSON.mock.calls[0];
    expect(url).toBe('https://example.functions.supabase.co/api/account');
    expect(options?.method).toBe('DELETE');
    // Destructive calls must not auto-retry.
    expect(options?.retries).toBe(0);
    expect(options?.body).toBeUndefined();
  });

  it('propagates backend and network errors', async () => {
    mockFetchJSON.mockRejectedValue(new Error('HTTP 500 Internal Server Error'));
    await expect(requestAccountDeletion()).rejects.toThrow('HTTP 500');
  });
});

describe('finalizeAccountDeletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clears the local dream cache and the waiting dictated dreams, then signs out', async () => {
    const calls: string[] = [];
    mockClearRemoteDreamStorage.mockImplementation(async () => {
      calls.push('clear');
    });
    mockForgetNotificationDreams.mockImplementation(async (scope: string) => {
      calls.push(`forget ${scope}`);
    });
    mockForgetBadgeLedger.mockImplementation(async (id: string) => { calls.push(`badges ${id}`); });
    mockForgetGuideReading.mockImplementation(async (id: string) => { calls.push(`guides ${id}`); });
    mockSignOut.mockImplementation(async () => {
      calls.push('signOut');
    });

    await finalizeAccountDeletion('user-1');

    expect(calls).toEqual(['clear', 'forget user:user-1', 'badges user-1', 'guides user-1', 'signOut']);
  });

  it('still signs out when cache clearing fails', async () => {
    mockClearRemoteDreamStorage.mockRejectedValue(new Error('sqlite busy'));
    mockForgetBadgeLedger.mockRejectedValue(new Error('badge storage busy'));
    mockForgetGuideReading.mockRejectedValue(new Error('guide storage busy'));
    mockSignOut.mockResolvedValue(undefined);

    await finalizeAccountDeletion('user-1');

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('surfaces sign-out failures', async () => {
    mockClearRemoteDreamStorage.mockResolvedValue(undefined);
    mockSignOut.mockRejectedValue(new Error('sign out failed'));

    await expect(finalizeAccountDeletion('user-1')).rejects.toThrow('sign out failed');
  });
});
