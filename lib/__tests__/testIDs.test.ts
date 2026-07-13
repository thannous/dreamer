import { describe, expect, it } from '@jest/globals';

import { TID } from '../testIDs';

describe('TID', () => {
  it('returns static IDs', () => {
    expect(TID.Screen.Recording).toBe('screen.recording');
    expect(TID.Screen.Onboarding).toBe('screen.onboarding');
    expect(TID.Button.AuthSignIn).toBe('btn.auth.signIn');
    expect(TID.Button.AuthGoogle).toBe('btn.auth.google');
    expect(TID.Chat.Send).toBe('chat.button.send');
    expect(TID.Button.DreamProfileCta).toBe('btn.stats.dreamProfile.cta');
    expect(TID.Button.DreamProfileUpgradeCta).toBe('btn.stats.dreamProfile.upgradeCta');
    expect(TID.Button.InputModeDismiss).toBe('btn.recording.inputMode.dismiss');
    expect(TID.Component.DreamProfileCard).toBe('component.stats.dreamProfile');
    expect(TID.Component.DreamProfilePlusPreview).toBe('component.stats.dreamProfile.plusPreview');
    expect(TID.Button.Exploration360Synthesis).toBe('btn.exploration360.synthesis');
    expect(TID.Button.EmptyStartRememberedDream).toBe('btn.empty.startRememberedDream');
    expect(TID.Button.OnboardingIntroNext).toBe('btn.onboarding.intro.next');
    expect(TID.Button.OnboardingPrimary).toBe('btn.onboarding.primary');
    expect(TID.Component.Exploration360Panel).toBe('component.exploration360.panel');
    expect(TID.Component.RememberedDreamProfileChips).toBe('component.recording.rememberedProfileChips');
    expect(TID.Component.RecordingActivationInsight).toBe('component.recording.activationInsight');
    expect(TID.Text.RecordingActivationInsightSummary).toBe('text.recording.activationInsight.summary');
    expect(TID.Component.OnboardingIntro).toBe('component.onboarding.intro');
    expect(TID.Component.OnboardingIntroSignals).toBe('component.onboarding.introSignals');
  });

  it('builds dynamic IDs', () => {
    expect(TID.Button.MockProfile('guest')).toBe('btn.mockProfile.guest');
    expect(TID.Button.DreamCategory('lucid')).toBe('btn.dreamCategory.lucid');
    expect(TID.List.DreamItem(42)).toBe('dream.item.42');
    expect(TID.Button.InspirationQuickAction('a1')).toBe('btn.inspiration.quick.a1');
    expect(TID.Button.RememberedDreamKind('recurring')).toBe('btn.recording.remembered.kind.recurring');
    expect(TID.Button.RememberedDreamPeriod('childhood')).toBe('btn.recording.remembered.period.childhood');
    expect(TID.Button.RememberedDreamFragment('person')).toBe('btn.recording.remembered.fragment.person');
    expect(TID.Button.OnboardingPath('analyze')).toBe('btn.onboarding.path.analyze');
  });
});
