export type NativeRecoveryLink =
  | { state: 'none' | 'invalid' }
  | { state: 'pending'; tokenHash: string };

const AUTH_PARAMETERS = [
  'token_hash', 'type', 'code', 'access_token', 'refresh_token',
  'provider_token', 'provider_refresh_token',
] as const;

/** A token hash proves a recovery request only after GoTrue verifies it. */
export function parseNativeRecoveryLink(
  params: Record<string, string | string[] | undefined>
): NativeRecoveryLink {
  if (!AUTH_PARAMETERS.some((key) => params[key] !== undefined)) return { state: 'none' };
  const tokenHash = params.token_hash;
  if (typeof tokenHash === 'string' && tokenHash.length > 0 &&
      params.type === 'recovery' &&
      AUTH_PARAMETERS.every((key) =>
        key === 'token_hash' || key === 'type' || params[key] === undefined)) {
    return { state: 'pending', tokenHash };
  }
  return { state: 'invalid' };
}
