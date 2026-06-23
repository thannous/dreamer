function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function verifyRevenueCatWebhookAuthorization(req: Request, secret: string): boolean {
  const expected = secret.trim();
  if (!expected) {
    throw new Error('Missing REVENUECAT_WEBHOOK_SECRET');
  }

  const provided = req.headers.get('authorization')?.trim();
  if (!provided) return false;

  return timingSafeEqual(provided, expected) || timingSafeEqual(provided, `Bearer ${expected}`);
}
