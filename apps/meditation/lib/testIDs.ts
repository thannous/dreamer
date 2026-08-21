/**
 * Stable anchors for the Maestro flows.
 *
 * Targeting visible text would mean rewriting every flow six times — the app
 * ships in six languages, and the copy is the part most likely to change.
 * A `testID` exists here only because automation needs it; nothing else.
 */
export const TID = {
  Screen: {
    Welcome: 'screen.welcome',
    OnboardingGoals: 'screen.onboarding.goals',
    OnboardingExperience: 'screen.onboarding.experience',
    OnboardingIntention: 'screen.onboarding.intention',
    OnboardingReminder: 'screen.onboarding.reminder',
    Home: 'screen.home',
    Search: 'screen.search',
    Breathe: 'screen.breathe',
    Profile: 'screen.profile',
    SessionDetail: 'screen.session',
    Player: 'screen.player',
    PlayerUnavailable: 'screen.player.unavailable',
    BreatheExercise: 'screen.breathe.exercise',
    Paywall: 'screen.paywall',
    Settings: 'screen.settings',
    Language: 'screen.settings.language',
    SessionComplete: 'screen.sessionComplete',
  },
  Button: {
    WelcomeStart: 'btn.welcome.start',
    OnboardingContinue: 'btn.onboarding.continue',
    SessionBack: 'btn.session.back',
    SessionPlay: 'btn.session.play',
    SessionFavorite: 'btn.session.favorite',
    PlayerToggle: 'btn.player.toggle',
    PlayerForward: 'btn.player.forward',
    PlayerBack: 'btn.player.back',
    PlayerClose: 'btn.player.close',
    /** The full-screen catcher that brings withdrawn chrome back. */
    RevealControls: 'btn.player.reveal',
    BreatheStart: 'btn.breathe.start',
    BreatheClose: 'btn.breathe.close',
    PaywallClose: 'btn.paywall.close',
    PaywallBuy: 'btn.paywall.buy',
    PaywallRestore: 'btn.paywall.restore',
    SettingsTheme: 'btn.settings.theme',
    SettingsLanguage: 'btn.settings.language',
    ProfileSettings: 'btn.profile.settings',
  },
  Option: {
    GoalSleep: 'option.onboarding.goal.sleep',
    ExperienceBeginner: 'option.onboarding.experience.beginner',
    IntentionFive: 'option.onboarding.intention.5',
    SearchSleepDescent: 'option.session.sleep-descent',
    CategoryDreamPrep: 'option.category.dream-prep',
    SessionDreamThreshold: 'option.session.dream-threshold',
    BreatheCalm: 'option.breathe.calm',
  },
  Text: {
    /** Carries the current phase name — what the breathing flow asserts on. */
    BreathePhase: 'text.breathe.phase',
    PlayerPosition: 'text.player.position',
    ProfileStreak: 'text.profile.streak',
  },
  Tab: {
    Home: 'tab.home',
    Breathe: 'tab.breathe',
    Search: 'tab.search',
    Profile: 'tab.profile',
  },
} as const;
