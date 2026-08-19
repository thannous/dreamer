/**
 * Route landed on by the password-recovery email link. Kept dependency-free so
 * both the auth modules and the root layout can share it without import cycles.
 */
export const PASSWORD_RESET_ROUTE = '/auth/reset-password';

export function isPasswordResetPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.split('?')[0].split('#')[0].replace(/\/+$/, '');
  return path === PASSWORD_RESET_ROUTE;
}
