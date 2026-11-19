import { timingSafeEqual } from '../_shared/timingSafeEqual.ts';

export function verifyRevenueCatWebhookAuthorization(req: Request, secret: string): boolean {
  const expected = secret.trim();
  if (!expected) {
    throw new Error('Missing REVENUECAT_WEBHOOK_SECRET');
  }

  const provided = req.headers.get('authorization')?.trim();
  if (!provided) return false;

  return timingSafeEqual(provided, expected) || timingSafeEqual(provided, `Bearer ${expected}`);
}
