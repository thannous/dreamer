import type { JournalLayoutPreference, LanguagePreference, RecordingDraftScope, ThemePreference } from '@/lib/types';

export const storageKeys = {
  dreams: 'gemini_dream_journal_dreams',
  remoteDreamsCache: 'gemini_dream_journal_remote_dreams_cache',
  dreamMutations: 'gemini_dream_journal_pending_mutations',
  imageJobs: 'gemini_dream_journal_pending_image_jobs',
  notificationSettings: 'gemini_dream_journal_notification_settings',
  themePreference: 'gemini_dream_journal_theme_preference',
  languagePreference: 'gemini_dream_journal_language_preference',
  journalLayoutPreference: 'gemini_dream_journal_layout_preference',
  recordingInputModePreference: 'gemini_dream_journal_recording_input_mode_preference',
  reminderPromptDismissed: 'gemini_dream_journal_reminder_prompt_dismissed',
  staleAnalysisBannerDismissed: 'gemini_dream_journal_stale_analysis_banner_dismissed',
  recordingVoiceHintCompleted: 'gemini_dream_journal_recording_voice_hint_completed_v1',
  ritualPreference: 'gemini_dream_journal_ritual_preference',
  ritualProgress: 'gemini_dream_journal_ritual_progress',
  firstLaunchCompleted: 'gemini_dream_journal_first_launch_completed',
  lastSeenReleaseNotesVersion: 'gemini_dream_journal_last_seen_release_notes_version',
  onboardingState: 'gemini_dream_journal_onboarding_state_v2',
  onboardingGuestClaimedBy: 'gemini_dream_journal_onboarding_guest_claimed_by_v2',
  pendingRecordingNotification: 'gemini_dream_journal_pending_recording_notification_v1',
  dreamsMigrationSyncedPrefix: 'gemini_dream_journal_dreams_migration_synced_',
  guestDreamMigrationOwner: 'gemini_dream_journal_guest_migration_owner_v1',
  authReturn: 'gemini_dream_journal_auth_return_v1',
};

export const scopedStorageKey = (baseKey: string, userScope?: string | null): string =>
  userScope ? `${baseKey}:${userScope}` : baseKey;

// Unscoped drafts predate account ownership and must remain unclaimed.
export const recordingDraftKey = (scope: RecordingDraftScope): string =>
  `gemini_dream_journal_recording_transcript:${scope}`;

export const GUEST_RECORDING_DRAFT_KEY = recordingDraftKey('guest');

export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'dynamic';
export const DEFAULT_LANGUAGE_PREFERENCE: LanguagePreference = 'auto';
export const DEFAULT_JOURNAL_LAYOUT_PREFERENCE: JournalLayoutPreference = 'cards';

export function isJournalLayoutPreference(value: unknown): value is JournalLayoutPreference {
  return value === 'cards' || value === 'compact';
}
