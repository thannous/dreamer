const mockClearAccountCreated = jest.fn();
const mockInvalidateGuestSession = jest.fn();
const mockResetAnalysisQuota = jest.fn();
const mockResetDreamQuota = jest.fn();
const mockClearTranscript = jest.fn();
const mockGetSavedDreams = jest.fn();
const mockSaveOnboardingSnapshot = jest.fn();

jest.mock('@/lib/deviceFingerprint', () => ({
  clearAccountCreatedOnDeviceForQa: () => mockClearAccountCreated(),
}));
jest.mock('@/lib/guestSession', () => ({
  invalidateGuestSession: () => mockInvalidateGuestSession(),
}));
jest.mock('@/lib/onboardingState', () => ({
  getDefaultOnboardingState: () => ({ status: 'not_started', schemaVersion: 1 }),
}));
jest.mock('@/services/quota/GuestAnalysisCounter', () => ({
  resetGuestAnalysisQuotaForQa: () => mockResetAnalysisQuota(),
}));
jest.mock('@/services/quota/GuestDreamCounter', () => ({
  resetGuestDreamRecordingCount: () => mockResetDreamQuota(),
}));
jest.mock('@/services/storageService', () => ({
  clearSavedTranscript: () => mockClearTranscript(),
  getSavedDreams: () => mockGetSavedDreams(),
  saveOnboardingStateSnapshot: (...args: unknown[]) => mockSaveOnboardingSnapshot(...args),
}));

const {
  GuestQaLocalStateError,
  prepareGuestQaLocalState,
} = require('@/lib/guestQaLocalState') as typeof import('@/lib/guestQaLocalState');

describe('guest QA local preparation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSavedDreams.mockResolvedValue([]);
    mockClearAccountCreated.mockResolvedValue(undefined);
    mockInvalidateGuestSession.mockResolvedValue(undefined);
    mockResetAnalysisQuota.mockResolvedValue(undefined);
    mockResetDreamQuota.mockResolvedValue(undefined);
    mockClearTranscript.mockResolvedValue(undefined);
    mockSaveOnboardingSnapshot.mockResolvedValue(undefined);
  });

  it('refuses to discard unsynchronized guest dreams', async () => {
    mockGetSavedDreams.mockResolvedValue([{ id: 1 }]);

    await expect(prepareGuestQaLocalState()).rejects.toEqual(
      expect.objectContaining<Partial<InstanceType<typeof GuestQaLocalStateError>>>({
        code: 'QA_LOCAL_DREAMS_PENDING',
        pendingDreamCount: 1,
      })
    );
    expect(mockClearAccountCreated).not.toHaveBeenCalled();
    expect(mockResetAnalysisQuota).not.toHaveBeenCalled();
  });

  it('resets only non-content guest state when local storage is safe', async () => {
    await prepareGuestQaLocalState();

    expect(mockClearAccountCreated).toHaveBeenCalledTimes(1);
    expect(mockInvalidateGuestSession).toHaveBeenCalledTimes(1);
    expect(mockResetAnalysisQuota).toHaveBeenCalledTimes(1);
    expect(mockResetDreamQuota).toHaveBeenCalledTimes(1);
    expect(mockClearTranscript).toHaveBeenCalledTimes(1);
    expect(mockSaveOnboardingSnapshot).toHaveBeenCalledWith(
      'guest',
      JSON.stringify({ status: 'not_started', schemaVersion: 1 })
    );
  });
});
