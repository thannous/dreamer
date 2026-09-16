import { supabase } from '@/lib/supabase';
import { isMockModeEnabled } from '@/lib/env';

export type HdImageQuota = { used: number; limit: number; remaining: number; resetsAt: string };
export async function getHdImageQuota(): Promise<HdImageQuota> {
  if (isMockModeEnabled()) {
    const now = new Date();
    return { used: 0, limit: 15, remaining: 15, resetsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString() };
  }
  const { data, error } = await supabase.rpc('get_hd_image_quota');
  if (error || !data || !Number.isInteger(data.remaining) || ![0, 15].includes(data.limit) || data.remaining < 0 || data.remaining > data.limit || !Number.isFinite(Date.parse(data.resetsAt))) {
    throw new Error('HD illustration quota unavailable');
  }
  return data as HdImageQuota;
}
