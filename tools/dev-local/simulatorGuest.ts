/**
 * Guest sessions for the iOS Simulator, on the local development backend only.
 *
 * The Simulator has no App Attest, so a development build there sends
 * `{ platform: 'ios', localSimulator: true }` without a proof (lib/guestSession.ts).
 * This never-deployed server answers it with the same signed iOS guest token a
 * verified Dreamer build gets, so every later guest route, quota and limit runs
 * as on an iPhone. The hosted `/guest/session` ignores the field and still
 * refuses an iOS session without a proof.
 */
import { jsonResponse } from '../../supabase/functions/api/lib/http.ts';
import { createGuestToken } from '../../supabase/functions/api/lib/guestToken.ts';

// The hosted route's own shape for an iOS fingerprint (a SHA-256 in hex).
const IOS_FINGERPRINT = /^[0-9a-f]{64}$/;

type GuestSessionHandler = (req: Request) => Promise<Response>;

export function withSimulatorGuestSessions(appId: string, next: GuestSessionHandler): GuestSessionHandler {
  return async (req) => {
    const body = await req.clone().json().catch(() => null) as Record<string, unknown> | null;
    if (body?.platform !== 'ios' || body.localSimulator !== true) return next(req);
    // A Simulator request carries no proof at all; one that does goes through App Attest.
    if (body.keyId != null || body.challengeId != null ||
        body.attestationObject != null || body.assertionObject != null) {
      return jsonResponse({ error: 'Invalid Simulator guest request' }, 400);
    }
    const fingerprint = typeof body.fingerprint === 'string' ? body.fingerprint : '';
    if (!IOS_FINGERPRINT.test(fingerprint)) return jsonResponse({ error: 'Invalid Simulator guest request' }, 400);
    console.log('[dev-local] iOS Simulator guest session (no App Attest on the Simulator)');
    return jsonResponse(await createGuestToken(fingerprint, 'ios', { appId }));
  };
}
