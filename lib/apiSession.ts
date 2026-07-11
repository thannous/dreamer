import { getAccessToken } from '@/lib/auth';
import {
  GuestSessionError,
  GuestSessionErrorCode,
  isGuestSessionError,
} from '@/lib/errors';
import { getGuestHeaders, invalidateGuestSession } from '@/lib/guestSession';
import { fetchJSON, type HttpOptions } from '@/lib/http';

/**
 * Call an application API route as the current Supabase user, or with a
 * short-lived verified guest session when no user is signed in.
 */
export async function fetchJSONWithSession<T>(
  url: string,
  options: HttpOptions & { signal?: AbortSignal },
  retryGuestSession = true
): Promise<T> {
  const accessToken = await getAccessToken();
  if (accessToken) {
    return fetchJSON<T>(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...options.headers,
      },
    });
  }

  const requestWithHeaders = (headers: Record<string, string>) =>
    fetchJSON<T>(url, { ...options, headers: { ...headers, ...options.headers } });

  const headers = await getGuestHeaders({ requireSession: true });
  try {
    return await requestWithHeaders(headers);
  } catch (error) {
    if (retryGuestSession && error instanceof Error && isGuestSessionError(error)) {
      await invalidateGuestSession();
      const freshHeaders = await getGuestHeaders({ requireSession: true });
      try {
        return await requestWithHeaders(freshHeaders);
      } catch (retryError) {
        if (retryError instanceof Error && isGuestSessionError(retryError)) {
          throw new GuestSessionError(
            GuestSessionErrorCode.EXPIRED,
            'guest_session_expired'
          );
        }
        throw retryError;
      }
    }
    throw error;
  }
}
