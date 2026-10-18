import { describe, expect, it } from '@jest/globals';

import { parseJournalFilterParams, toJournalFilterParams } from '../journalFilterLink';

describe('journal filter links', () => {
  it('carries a theme, type, dates and analysis state into the journal as local days', () => {
    const params = toJournalFilterParams(
      { theme: 'mystical', dreamType: 'Nightmare', from: '2026-09-30', to: '2026-10-29', analysis: 'unanalyzed' },
      'k1',
    );
    expect(params).toEqual({
      filter: 'k1', theme: 'mystical', type: 'Nightmare', from: '2026-09-30', to: '2026-10-29', analysis: 'unanalyzed',
    });

    const selection = parseJournalFilterParams(params);
    expect(selection).toMatchObject({ key: 'k1', theme: 'mystical', dreamType: 'Nightmare', analysis: 'unanalyzed' });
    expect(selection?.start?.getTime()).toBe(new Date(2026, 8, 30).getTime());
    expect(selection?.end?.getTime()).toBe(new Date(2026, 9, 29).getTime());
  });

  it('ignores params without a request and drops values it does not know', () => {
    expect(parseJournalFilterParams({ theme: 'mystical' })).toBeNull();
    expect(parseJournalFilterParams({
      filter: ['k2', 'k3'],
      theme: 'cosmic',
      type: 'Unknown',
      from: '2026-02-30',
      to: 'yesterday',
      analysis: 'all',
      symbol: 'water',
    })).toEqual({ key: 'k2', theme: null, dreamType: null, start: null, end: null, analysis: null, symbol: null });
  });
});
