import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const envUrl = (process?.env as any)?.EXPO_PUBLIC_SUPABASE_URL as string | undefined;
const envAnon = (process?.env as any)?.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
const extra = (Constants?.expoConfig as any)?.extra ?? {};
const extraUrl = (extra?.supabaseUrl as string | undefined) ?? undefined;
const extraAnon = (extra?.supabaseAnonKey as string | undefined) ?? undefined;

const SUPABASE_URL = envUrl || extraUrl;
const SUPABASE_ANON_KEY = envAnon || extraAnon;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Auth will be disabled until configured.'
  );
}

export const supabase = createClient(
  SUPABASE_URL ?? 'http://localhost:54321',
  SUPABASE_ANON_KEY ?? 'anon-key-not-set'
);
