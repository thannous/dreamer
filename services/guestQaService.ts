import * as Crypto from 'expo-crypto';

import { getApiBaseUrl } from '@/lib/config';
import { getDeviceFingerprint } from '@/lib/deviceFingerprint';
import { NETWORK_REQUEST_POLICIES } from '@/lib/networkPolicy';

export type GuestQaStatus = {
  active: boolean;
  deviceMatches: boolean;
  passportId?: string;
  validUntil?: string;
  resetsUsed: number;
  resetLimit: number;
  paidCallsUsed: number;
  paidCallLimit: number;
};

export type GuestQaEnrollment = {
  allowed: true;
  duplicate: boolean;
  passportId: string;
  validUntil: string;
  resetsUsed?: number;
  resetLimit: number;
  paidCallsUsed: number;
  paidCallLimit: number;
};

const command = async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
  const { fetchJSONWithSession } = await import('@/lib/apiSession');
  return fetchJSONWithSession<T>(`${getApiBaseUrl()}${path}`, {
    method: 'POST',
    body,
    ...NETWORK_REQUEST_POLICIES.guestQaCommand,
  });
};

export async function getGuestQaStatus(): Promise<GuestQaStatus> {
  const fingerprint = await getDeviceFingerprint();
  return command<GuestQaStatus>('/qa/guest-device/status', { fingerprint });
}

export async function enrollGuestQaDevice(): Promise<GuestQaEnrollment> {
  const fingerprint = await getDeviceFingerprint();
  return command<GuestQaEnrollment>('/qa/guest-device/enroll', {
    fingerprint,
    requestId: Crypto.randomUUID(),
  });
}

export async function revokeGuestQaDevice(): Promise<{ revoked: boolean }> {
  const fingerprint = await getDeviceFingerprint();
  return command<{ revoked: boolean }>('/qa/guest-device/revoke', { fingerprint });
}
