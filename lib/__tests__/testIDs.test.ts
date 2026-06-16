import { describe, expect, it } from '@jest/globals';

import { TID } from '../testIDs';

describe('TID', () => {
  it('returns static IDs', () => {
    expect(TID.Screen.Recording).toBe('screen.recording');
    expect(TID.Button.AuthSignIn).toBe('btn.auth.signIn');
    expect(TID.Button.AuthGoogle).toBe('btn.auth.google');
    expect(TID.Chat.Send).toBe('chat.button.send');
    expect(TID.Button.DreamProfileCta).toBe('btn.stats.dreamProfile.cta');
    expect(TID.Component.DreamProfileCard).toBe('component.stats.dreamProfile');
    expect(TID.Button.Exploration360Synthesis).toBe('btn.exploration360.synthesis');
    expect(TID.Button.EmptyStartRememberedDream).toBe('btn.empty.startRememberedDream');
    expect(TID.Component.Exploration360Panel).toBe('component.exploration360.panel');
  });

  it('builds dynamic IDs', () => {
    expect(TID.Button.MockProfile('guest')).toBe('btn.mockProfile.guest');
    expect(TID.Button.DreamCategory('lucid')).toBe('btn.dreamCategory.lucid');
    expect(TID.List.DreamItem(42)).toBe('dream.item.42');
    expect(TID.Button.InspirationQuickAction('a1')).toBe('btn.inspiration.quick.a1');
  });
});
