import { clearUnsentDrafts, getUnsentDraft, setUnsentDraft } from '../unsentDrafts';

describe('unsent chat drafts', () => {
  beforeEach(() => clearUnsentDrafts());

  it('keeps each draft under its own account and dream', () => {
    setUnsentDraft('user-1:client:dream-a', 'Pourquoi cette porte bleue ?');
    setUnsentDraft('user-2:client:dream-a', 'Une autre question');
    expect(getUnsentDraft('user-1:client:dream-a')).toBe('Pourquoi cette porte bleue ?');
    expect(getUnsentDraft('user-2:client:dream-a')).toBe('Une autre question');
    expect(getUnsentDraft('user-1:client:dream-b')).toBe('');
  });

  it('forgets a draft emptied by the dreamer', () => {
    setUnsentDraft('guest:client:dream-a', 'brouillon');
    setUnsentDraft('guest:client:dream-a', '');
    expect(getUnsentDraft('guest:client:dream-a')).toBe('');
  });

  it('clears every draft at once', () => {
    setUnsentDraft('user-1:client:dream-a', 'brouillon');
    setUnsentDraft('guest:client:dream-b', 'autre');
    clearUnsentDrafts();
    expect(getUnsentDraft('user-1:client:dream-a')).toBe('');
    expect(getUnsentDraft('guest:client:dream-b')).toBe('');
  });
});
