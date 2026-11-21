/**
 * `POST /dev-local/guest-reset`, on the local development backend only.
 *
 * A guest device keeps its usage forever on the server (2 analyses, chat
 * messages, illustrations, the rolling AI windows). To test the guest journey
 * again, the development build's « Nouvel invité » button calls this route
 * with its own guest session; the server forgets that device only, through
 * public.dev_local_reset_guest (guest-reset.sql), which dev-local.mjs installs
 * on the local stack. The hosted API has neither the route nor the function.
 */
import { requireGuestSession } from '../../supabase/functions/api/lib/guards.ts';
import { jsonResponse } from '../../supabase/functions/api/lib/http.ts';

type Context = { req: Request; user: unknown | null };

export function createGuestResetHandler(resetGuest: (fingerprint: string) => Promise<unknown>) {
  return async (ctx: Context): Promise<Response> => {
    if (ctx.user) return jsonResponse({ error: 'Sign out first: only a guest device is reset' }, 400);
    const guest = await requireGuestSession(ctx.req, null, null);
    if (guest instanceof Response) return guest;
    if (!guest.fingerprint) return jsonResponse({ error: 'Invalid guest session' }, 401);
    const forgotten = await resetGuest(guest.fingerprint);
    console.log('[dev-local] guest device reset', forgotten);
    return jsonResponse({ reset: true, forgotten });
  };
}
