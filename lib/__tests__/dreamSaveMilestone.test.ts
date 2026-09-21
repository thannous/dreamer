import { nextDreamSaveMilestone, DREAM_RETURN_WINDOW_MS } from '@/lib/dreamSaveMilestone';
const first = Date.parse('2026-09-01T12:00:00Z');
const state = { firstSavedAt: first, returned: false };
describe('bounded first-dream return cohort', () => {
  it('enrolls only a first durable save', () => {
    expect(nextDreamSaveMilestone(null, true, first).milestone?.stage).toBe('first');
    expect(nextDreamSaveMilestone(null, false, first).milestone).toBeNull();
  });
  it('requires a later UTC date and includes the exact seven-day boundary', () => {
    expect(nextDreamSaveMilestone(state, false, first + 1000).milestone).toBeNull();
    expect(nextDreamSaveMilestone(state, false, first + 86400_000).milestone?.stage).toBe('return_7d');
    expect(nextDreamSaveMilestone(state, false, first + DREAM_RETURN_WINDOW_MS).milestone?.stage).toBe('return_7d');
    expect(nextDreamSaveMilestone(state, false, first + DREAM_RETURN_WINDOW_MS + 1).state).toBeNull();
  });
  it('rejects duplicate callbacks, backward clocks and previously returned cohorts', () => {
    expect(nextDreamSaveMilestone(state, true, first + 86400_000).milestone).toBeNull();
    expect(nextDreamSaveMilestone(state, false, first - 1).milestone).toBeNull();
    expect(nextDreamSaveMilestone({ ...state, returned: true }, false, first + 86400_000).milestone).toBeNull();
  });
});
