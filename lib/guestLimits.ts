import { GUEST_DREAM_LIMIT } from '@/constants/limits';

export function getGuestDreamRecordingLimit(): number {
  return Math.max(GUEST_DREAM_LIMIT, 0);
}

export function isGuestDreamLimitReached(dreamCount: number): boolean {
  return dreamCount >= getGuestDreamRecordingLimit();
}
