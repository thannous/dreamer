import { withAbortTimeout } from '@/lib/networkPolicy';
import { supabase } from '@/lib/supabase';
import { parseGuideReading, type GuideReadingEntries, type GuideReadingEntry } from '@/lib/guideReading';
import type { DreamGuideId } from '@/lib/dreamGuideTypes';

type Row = { guide_id: DreamGuideId; section: number; updated_at_ms: number; completed_at_ms: number | null };
function fromRows(rows: Row[]): GuideReadingEntries {
  return parseGuideReading(Object.fromEntries(rows.map(row => [row.guide_id, {
    section: row.section, updatedAt: row.updated_at_ms, ...(row.completed_at_ms ? { completedAt: row.completed_at_ms } : {}),
  }])));
}
export async function readRemoteGuideReading(userId: string): Promise<GuideReadingEntries> {
  const { data, error } = await withAbortTimeout(10_000, signal => supabase.from('guide_reading_progress')
    .select('guide_id, section, updated_at_ms, completed_at_ms').eq('user_id', userId)
    .abortSignal(signal));
  if (error) throw error;
  return fromRows((data ?? []) as Row[]);
}
export async function writeRemoteGuideReading(userId: string, id: DreamGuideId, entry: GuideReadingEntry): Promise<GuideReadingEntries> {
  const { data, error } = await withAbortTimeout(10_000, signal => supabase.rpc('merge_guide_reading_progress', {
    p_user_id: userId, p_guide_id: id, p_section: entry.section,
    p_updated_at_ms: entry.updatedAt, p_completed_at_ms: entry.completedAt ?? null,
  }).abortSignal(signal));
  if (error) throw error;
  return fromRows((data ?? []) as Row[]);
}
