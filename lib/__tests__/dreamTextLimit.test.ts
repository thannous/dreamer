import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DREAM_TRANSCRIPT_MAX_CHARS } from '@/constants/limits';
import { getDreamTextInputLimit, isDreamTextTooLong, shouldShowDreamLengthCounter } from '@/lib/dreamTextLimit';

describe('dream text limit', () => {
  it('matches the length the sync function accepts', () => {
    const migration = readFileSync(
      join(__dirname, '../../supabase/migrations/20261021171000_limit_dream_sync_size_and_rate.sql'),
      'utf8'
    );
    expect(migration).toContain(`max_transcript_chars constant integer := ${DREAM_TRANSCRIPT_MAX_CHARS};`);
  });

  it('stops new text at the maximum without ever cutting a longer text already there', () => {
    expect(getDreamTextInputLimit(0)).toBe(20000);
    expect(getDreamTextInputLimit(19999)).toBe(20000);
    expect(getDreamTextInputLimit(24000)).toBe(24000);
    expect(getDreamTextInputLimit(10, 30000)).toBe(30000);
  });

  it('refuses what the server would refuse, and lets a stored longer dream shrink', () => {
    expect(isDreamTextTooLong('r'.repeat(20000))).toBe(false);
    expect(isDreamTextTooLong('r'.repeat(20001))).toBe(true);
    expect(isDreamTextTooLong('r'.repeat(29000), 30000)).toBe(false);
    expect(isDreamTextTooLong('r'.repeat(30001), 30000)).toBe(true);
    // An emoji is two units here and one character in PostgreSQL: the app is never looser.
    expect(isDreamTextTooLong('🌙'.repeat(10001))).toBe(true);
  });

  it('shows the counter only from 18,000 characters on', () => {
    expect(shouldShowDreamLengthCounter(17999)).toBe(false);
    expect(shouldShowDreamLengthCounter(18000)).toBe(true);
  });
});
