import { clearAccountCreatedOnDeviceForQa } from '@/lib/deviceFingerprint';
import { getDefaultOnboardingState } from '@/lib/onboardingState';
import { invalidateGuestSession } from '@/lib/guestSession';
import { resetGuestAnalysisQuotaForQa } from '@/services/quota/GuestAnalysisCounter';
import { resetGuestDreamRecordingCount } from '@/services/quota/GuestDreamCounter';
import {
  clearSavedTranscript,
  getSavedDreams,
  saveOnboardingStateSnapshot,
} from '@/services/storageService';

export class GuestQaLocalStateError extends Error {
  readonly code = 'QA_LOCAL_DREAMS_PENDING';

  constructor(readonly pendingDreamCount: number) {
    super('Local guest dreams must be synchronized before starting QA.');
    this.name = 'GuestQaLocalStateError';
  }
}

export async function assertGuestQaLocalStateReady(): Promise<void> {
  const localDreams = await getSavedDreams();
  if (localDreams.length > 0) {
    throw new GuestQaLocalStateError(localDreams.length);
  }
}

export async function prepareGuestQaLocalState(): Promise<void> {
  await assertGuestQaLocalStateReady();
  await Promise.all([
    clearAccountCreatedOnDeviceForQa(),
    resetGuestAnalysisQuotaForQa(),
    resetGuestDreamRecordingCount(),
    clearSavedTranscript(),
    saveOnboardingStateSnapshot('guest', JSON.stringify(getDefaultOnboardingState())),
    invalidateGuestSession(),
  ]);
}
