import type { LucidExperienceLevel, LucidGoal } from '@/lib/lucid/model';

export const LUCID_LOCALES = ['en', 'fr', 'es', 'de', 'it'] as const;

export type LucidLocale = (typeof LUCID_LOCALES)[number];

export const LUCID_PROGRAM_IDS = ['mild', 'ssild', 'wbtb'] as const;

export type LucidProgramId = (typeof LUCID_PROGRAM_IDS)[number];

export type LucidEvidenceTopic =
  | 'definition'
  | 'induction'
  | 'mild'
  | 'ssild'
  | 'wbtb'
  | 'reality-testing'
  | 'rem-sleep'
  | 'sleep-duration'
  | 'safety';

export type LucidEvidenceReference = Readonly<{
  id: string;
  kind: 'original-research' | 'systematic-review' | 'consensus-statement';
  title: string;
  authors: string;
  year: number;
  publication: string;
  identifier: Readonly<{
    type: 'doi' | 'pmid';
    value: string;
  }>;
  url: string;
  topics: readonly LucidEvidenceTopic[];
  note: string;
}>;

export type LucidChoiceCopy = Readonly<{
  id: string;
  title: string;
  description: string;
}>;

export type LucidOnboardingChoiceCopy<TId extends string> = Readonly<{
  id: TId;
  title: string;
  description: string;
}>;

export type LucidProgramSession = Readonly<{
  id: string;
  session: number;
  title: string;
  objective: string;
  durationMinutes: number;
  steps: readonly string[];
  caution: string;
  reflectionPrompt: string;
}>;

export type LucidProgramContent = Readonly<{
  id: LucidProgramId;
  title: string;
  expandedName: string;
  summary: string;
  evidenceNote: string;
  evidenceReferenceIds: readonly string[];
  prerequisites: readonly string[];
  stopRules: readonly string[];
  sessions: readonly LucidProgramSession[];
}>;

export type LucidTrainerContent = Readonly<{
  locale: LucidLocale;
  chrome: Readonly<{
    appName: string;
    tagline: string;
    tabs: Readonly<{
      today: string;
      journal: string;
      programs: string;
      night: string;
      progress: string;
      settings: string;
    }>;
    common: Readonly<{
      continue: string;
      back: string;
      save: string;
      cancel: string;
      done: string;
      retry: string;
      skipTonight: string;
      optional: string;
      offlineReady: string;
      loading: string;
      error: string;
    }>;
  }>;
  onboarding: Readonly<{
    title: string;
    intro: string;
    wellbeingNotice: string;
    goalTitle: string;
    goals: readonly LucidOnboardingChoiceCopy<LucidGoal>[];
    experienceTitle: string;
    experienceLevels: readonly LucidOnboardingChoiceCopy<LucidExperienceLevel>[];
    reminderTitle: string;
    reminderExplanation: string;
    sleepScheduleTitle: string;
    sleepScheduleExplanation: string;
    permissionsTitle: string;
    notificationPermission: string;
    audioPermission: string;
    accessibilityTitle: string;
    accessibilityBody: string;
    consentTitle: string;
    consentItems: readonly string[];
    finishAction: string;
  }>;
  programs: Readonly<Record<LucidProgramId, LucidProgramContent>>;
  realityChecks: Readonly<{
    title: string;
    intro: string;
    qualityPrinciples: readonly string[];
    exercises: readonly LucidChoiceCopy[];
    contextTitle: string;
    contextExamples: readonly string[];
    reminderSafety: string;
    completionPrompt: string;
  }>;
  nightSignals: Readonly<{
    title: string;
    intro: string;
    optionalLabel: string;
    setupSteps: readonly string[];
    safeguards: readonly string[];
    previewAction: string;
    timerLabel: string;
    volumeLabel: string;
    stopAction: string;
  }>;
  morningReview: Readonly<{
    title: string;
    intro: string;
    fields: Readonly<{
      technique: string;
      preparation: string;
      dreamRecall: string;
      lucidity: string;
      sleepQuality: string;
      personalFactors: string;
      notes: string;
    }>;
    noRecallAction: string;
    saveOfflineNote: string;
    neutralOutcome: string;
  }>;
  weeklyReview: Readonly<{
    title: string;
    intro: string;
    metrics: readonly string[];
    adaptationRules: readonly string[];
    coachingNote: string;
  }>;
  science: Readonly<{
    title: string;
    definition: string;
    evidenceSummary: string;
    uncertainty: string;
    sleepPriority: string;
    boundaries: readonly string[];
    supportAdvice: string;
    referencesTitle: string;
  }>;
  privacy: Readonly<{
    title: string;
    localFirst: string;
    optionalSync: string;
    minimalTransfer: string;
    analytics: string;
    sensitiveData: string;
    exportDelete: string;
    consentControl: string;
  }>;
  settings: Readonly<{
    title: string;
    reminders: string;
    sleepWindow: string;
    nightSignals: string;
    permissions: string;
    accessibility: string;
    language: string;
    appearance: string;
    privacy: string;
    dataManagement: string;
    subscription: string;
    noctaliaConnection: string;
    scienceAndLimits: string;
    help: string;
    about: string;
  }>;
}>;
