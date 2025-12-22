import { corsHeaders } from './constants.ts';
import { verifyGuestToken } from './guestToken.ts';

type GuestSessionResult = { fingerprint: string | null };

const unauthorized = (message: string) =>
  new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

export const requireUser = (user: unknown | null): Response | null => {
  if (!user) {
    return unauthorized('Authentication required');
  }
  return null;
};

export const requireGuestSession = async (
  req: Request,
  body: { fingerprint?: string | null } | null,
  user: unknown | null
): Promise<Response | GuestSessionResult> => {
  if (user) {
    return { fingerprint: null };
  }

  const headerFingerprint = req.headers.get('x-guest-fingerprint')?.trim() ?? '';
  const bodyFingerprint = body?.fingerprint?.trim() ?? '';
  const fingerprint = headerFingerprint || bodyFingerprint;

  if (!fingerprint) {
    return unauthorized('Missing guest fingerprint');
  }

  if (headerFingerprint && bodyFingerprint && headerFingerprint !== bodyFingerprint) {
    return unauthorized('Fingerprint mismatch');
  }

  const token = req.headers.get('x-guest-token')?.trim() ?? '';
  const platform = req.headers.get('x-guest-platform')?.trim() ?? undefined;
  const verified = await verifyGuestToken(token, fingerprint, platform);
  if (!verified.ok) {
    return unauthorized(`Invalid guest session (${verified.reason ?? 'unknown'})`);
  }

  return { fingerprint };
};
