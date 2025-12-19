import { describe, expect, it } from 'vitest';

import { TID } from '../testIDs';

describe('TID', () => {
  it('returns static IDs', () => {
    expect(TID.Screen.Recording).toBe('screen.recording');
    expect(TID.Button.AuthSignIn).toBe('btn.auth.signIn');
    expect(TID.Chat.Send).toBe('chat.button.send');
  });

  it('builds dynamic IDs', () => {
    expect(TID.Button.MockProfile('guest')).toBe('btn.mockProfile.guest');
    expect(TID.Button.DreamCategory('lucid')).toBe('btn.dreamCategory.lucid');
    expect(TID.List.DreamItem(42)).toBe('dream.item.42');
    expect(TID.Button.InspirationQuickAction('a1')).toBe('btn.inspiration.quick.a1');
  });
});
