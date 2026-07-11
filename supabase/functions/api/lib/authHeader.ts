type JwtPayload = {
  sub?: unknown;
};

export function extractBearerToken(authorization: string | null): string | null {
  const trimmed = authorization?.trim();
  if (!trimmed) return null;

  const match = /^Bearer\s+(.+)$/i.exec(trimmed);
  const token = match?.[1]?.trim();
  return token || null;
}

function decodeBase64Url(value: string): string | null {
  if (!value) return null;

  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return atob(padded);
  } catch {
    return null;
  }
}

function decodeJwtPayload(token: string): JwtPayload | null {
  const [, payload] = token.split('.');
  if (!payload) return null;

  const decoded = decodeBase64Url(payload);
  if (!decoded) return null;

  try {
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

export function resolveSupabaseUserBearer(authorization: string | null): string | null {
  const token = extractBearerToken(authorization);
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  const sub = typeof payload?.sub === 'string' ? payload.sub.trim() : '';
  return sub ? token : null;
}

export function buildSupabaseUserAuthHeaders(authorization: string | null): Record<string, string> {
  const token = resolveSupabaseUserBearer(authorization);
  return token ? { Authorization: `Bearer ${token}` } : {};
}
