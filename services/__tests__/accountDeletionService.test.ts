import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { forgetGuideReading } from '@/services/guideReadingStore';

import { fetchJSON } from '@/lib/http';
import { requestAppleAuthorizationCode, signOut } from '@/lib/auth';
import { forgetBadgeLedger } from '@/services/badgeLedgerStore';
import { forgetCaptureQuestion } from '@/services/captureQuestionStore';
import { forgetNotificationDreams } from '@/services/notificationDreamInbox';
import { clearRemoteDreamStorage, clearSavedTranscript } from '@/services/storageService';
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
  requestAppleAuthorizationCode: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('@/services/guideReadingStore', () => ({ forgetGuideReading: jest.fn() }));

jest.mock('@/services/badgeLedgerStore', () => ({ forgetBadgeLedger: jest.fn() }));

jest.mock('@/services/captureQuestionStore', () => ({ forgetCaptureQuestion: jest.fn() }));

jest.mock('@/services/notificationDreamInbox', () => ({
  forgetNotificationDreams: jest.fn(),
}));

jest.mock('@/services/storageService', () => ({
  clearRemoteDreamStorage: jest.fn(),
  clearSavedTranscript: jest.fn(),
}));

const mockFetchJSON = jest.mocked(fetchJSON);
const mockSignOut = jest.mocked(signOut);
const mockRequestAppleAuthorizationCode = jest.mocked(requestAppleAuthorizationCode);
const mockClearRemoteDreamStorage = jest.mocked(clearRemoteDreamStorage);
const mockClearSavedTranscript = jest.mocked(clearSavedTranscript);
const mockForgetGuideReading = jest.mocked(forgetGuideReading);
const mockForgetBadgeLedger = jest.mocked(forgetBadgeLedger);
const mockForgetNotificationDreams = jest.mocked(forgetNotificationDreams);
const mockForgetCaptureQuestion = jest.mocked(forgetCaptureQuestion);

describe('requestAccountDeletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchJSON.mockReset();
    mockRequestAppleAuthorizationCode.mockReset();
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
    expect(mockRequestAppleAuthorizationCode).not.toHaveBeenCalled();
  });

  // The server answers this for an Apple account whose sign-in token it never kept.
  const appleAuthorizationRequired = Object.assign(new Error('HTTP 409 Conflict'), {
    status: 409,
    body: { error: 'Apple authorization required', code: 'apple_authorization_required' },
  });

  it('asks Apple once more and sends that fresh authorization when the server kept no Apple token', async () => {
    mockFetchJSON.mockRejectedValueOnce(appleAuthorizationRequired).mockResolvedValueOnce({ deleted: true });
    mockRequestAppleAuthorizationCode.mockResolvedValue('fresh-code');

    await expect(requestAccountDeletion()).resolves.toEqual({ deleted: true });

    expect(mockRequestAppleAuthorizationCode).toHaveBeenCalledTimes(1);
    expect(mockFetchJSON).toHaveBeenCalledTimes(2);
    const [url, options] = mockFetchJSON.mock.calls[1];
    expect(url).toBe('https://example.functions.supabase.co/api/account');
    expect(options?.method).toBe('DELETE');
    expect(options?.retries).toBe(0);
    expect(options?.body).toEqual({ appleAuthorizationCode: 'fresh-code' });
  });

  it('stops when Apple gives no authorization code or the sheet is closed', async () => {
    mockFetchJSON.mockRejectedValue(appleAuthorizationRequired);
    mockRequestAppleAuthorizationCode.mockResolvedValueOnce(undefined);
    await expect(requestAccountDeletion()).rejects.toBe(appleAuthorizationRequired);

    const canceled = Object.assign(new Error('canceled'), { code: 'ERR_REQUEST_CANCELED' });
    mockRequestAppleAuthorizationCode.mockRejectedValueOnce(canceled);
    await expect(requestAccountDeletion()).rejects.toBe(canceled);
    expect(mockFetchJSON).toHaveBeenCalledTimes(2);
  });
});

describe('finalizeAccountDeletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clears the local dream cache and the waiting dictated dreams, then signs out', async () => {
    const calls: string[] = [];
    // The cache is keyed per account: an unscoped clear leaves the journal on the device.
    mockClearRemoteDreamStorage.mockImplementation(async (scope?: string | null) => {
      calls.push(`clear ${scope}`);
    });
    mockForgetNotificationDreams.mockImplementation(async (scope: string) => {
      calls.push(`forget ${scope}`);
    });
    mockForgetBadgeLedger.mockImplementation(async (id: string) => { calls.push(`badges ${id}`); });
    mockForgetGuideReading.mockImplementation(async (id: string) => { calls.push(`guides ${id}`); });
    mockClearSavedTranscript.mockImplementation(async (scope: string) => { calls.push(`draft ${scope}`); });
    mockForgetCaptureQuestion.mockImplementation(async (scope?: string) => { calls.push(`question ${scope}`); });
    mockSignOut.mockImplementation(async () => {
      calls.push('signOut');
    });

    await finalizeAccountDeletion('user-1');

    expect(calls).toEqual(['clear user:user-1', 'forget user:user-1', 'badges user-1', 'guides user-1', 'draft user:user-1', 'question user:user-1', 'signOut']);
  });

  it('still signs out when cache clearing fails', async () => {
    mockClearRemoteDreamStorage.mockRejectedValue(new Error('sqlite busy'));
    mockForgetBadgeLedger.mockRejectedValue(new Error('badge storage busy'));
    mockForgetGuideReading.mockRejectedValue(new Error('guide storage busy'));
    mockClearSavedTranscript.mockRejectedValue(new Error('draft storage busy'));
    mockForgetCaptureQuestion.mockRejectedValue(new Error('question storage busy'));
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
