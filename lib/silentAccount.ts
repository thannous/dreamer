import type { User } from '@supabase/supabase-js';

/**
 * A silent account has no email and no name: the app makes it once a guest's purchase is
 * confirmed by the store, so that buying never asks for registration (App Review 5.1.1(v)).
 * It is a Supabase anonymous user. Adding an email, Apple or Google to it later keeps the
 * same account, its journal and its subscription.
 */
export function isSilentAccount(user: Pick<User, 'is_anonymous'> | null | undefined): boolean {
  return user?.is_anonymous === true;
}

/** An email entered on a silent account and not confirmed yet. */
export function getPendingAccountEmail(user: Pick<User, 'is_anonymous' | 'new_email'> | null | undefined): string | null {
  const pending = isSilentAccount(user) ? user?.new_email?.trim() : '';
  return pending || null;
}
