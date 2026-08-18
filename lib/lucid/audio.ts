export const MAX_LUCID_NIGHT_VOLUME = 0.3;
export const MAX_LUCID_PREVIEW_VOLUME = 0.2;
export const MAX_LUCID_PREVIEW_DURATION_MS = 10_000;
export const MAX_LUCID_CUE_DURATION_MS = 8_000;
export const MIN_LUCID_FIRST_CUE_DELAY_MS = 90 * 60 * 1000;
export const MIN_LUCID_CUE_GAP_MS = 45 * 60 * 1000;
export const LUCID_QUIET_BEFORE_TIMER_END_MS = 30 * 60 * 1000;
export const MAX_LUCID_NIGHT_CUES = 4;
export const MIN_LUCID_TIMER_MINUTES = 120;
export const MAX_LUCID_TIMER_MINUTES = 600;

export const LUCID_NIGHT_SOUND_IDS = ['rain', 'ocean', 'brown-noise'] as const;
export type LucidNightSoundId = (typeof LUCID_NIGHT_SOUND_IDS)[number];

export const LUCID_NIGHT_VOLUME_BANDS = ['very_low', 'low', 'gentle'] as const;
export type LucidNightVolumeBand = (typeof LUCID_NIGHT_VOLUME_BANDS)[number];

export const LUCID_NIGHT_SOUND_FILES: Readonly<
  Record<LucidNightSoundId, Readonly<Record<LucidNightVolumeBand, string>>>
> = {
  rain: {
    very_low: 'lucid_cue_rain_very_low.wav',
    low: 'lucid_cue_rain_low.wav',
    gentle: 'lucid_cue_rain.wav',
  },
  ocean: {
    very_low: 'lucid_cue_ocean_very_low.wav',
    low: 'lucid_cue_ocean_low.wav',
    gentle: 'lucid_cue_ocean.wav',
  },
  'brown-noise': {
    very_low: 'lucid_cue_brown_noise_very_low.wav',
    low: 'lucid_cue_brown_noise_low.wav',
    gentle: 'lucid_cue_brown_noise.wav',
  },
};

export const LUCID_AUDIO_SAFETY_RULES = [
  'low_volume',
  'speaker_only',
  'stop_if_sleep_disrupted',
  'no_medical_claim',
] as const;

export type LucidAudioSafetyRule =
  (typeof LUCID_AUDIO_SAFETY_RULES)[number];

export type LucidAudioSafety = {
  acknowledged: boolean;
  playbackRoute: 'speaker' | 'headphones' | 'unknown';
  sleepIsFragile: boolean;
  hearingConcern: boolean;
};

export type LucidAudioBlockReason =
  | 'disabled'
  | 'safety_not_acknowledged'
  | 'unsafe_route'
  | 'fragile_sleep'
  | 'hearing_concern'
  | 'invalid_deadline'
  | 'invalid_timer'
  | 'invalid_volume'
  | 'invalid_duration'
  | 'no_safe_signals';

export type LucidAudioBlocked = {
  status: 'blocked';
  reason: LucidAudioBlockReason;
};

export type LucidPreviewPlan = {
  startsAt: number;
  stopAt: number;
  volume: number;
  volumeBand: LucidNightVolumeBand;
  soundId: LucidNightSoundId;
  soundFile: string;
  safetyRules: readonly LucidAudioSafetyRule[];
};

export type LucidPreviewPlanResult =
  | LucidAudioBlocked
  | { status: 'ready'; plan: LucidPreviewPlan };

export type LucidNightCueRejectionReason =
  | 'invalid_offset'
  | 'too_early'
  | 'too_late'
  | 'too_close'
  | 'limit_reached';

export type LucidNightCueRejection = {
  requestedIndex: number;
  reason: LucidNightCueRejectionReason;
};

export type LucidNightCue = {
  id: string;
  requestedIndex: number;
  startsAt: number;
  stopAt: number;
};

export type LucidNightSignalPlan = {
  sessionId: string;
  sessionStartAt: number;
  timerEndsAt: number;
  volume: number;
  volumeBand: LucidNightVolumeBand;
  soundId: LucidNightSoundId;
  soundFile: string;
  cues: readonly LucidNightCue[];
  rejectedCues: readonly LucidNightCueRejection[];
  safetyRules: readonly LucidAudioSafetyRule[];
};

export type LucidNightSignalPlanResult =
  | LucidAudioBlocked
  | { status: 'ready'; plan: LucidNightSignalPlan };

export type LucidPreviewRequest = {
  nowAt: number;
  requestedVolume: number;
  requestedDurationMs: number;
  soundId: LucidNightSoundId;
  safety: LucidAudioSafety;
};

export type LucidNightSignalRequest = {
  enabled: boolean;
  sessionStartAt: number;
  timerMinutes: number;
  cueOffsetsMinutes: readonly number[];
  requestedVolume: number;
  requestedCueDurationMs?: number;
  soundId: LucidNightSoundId;
  safety: LucidAudioSafety;
};

export type LucidNightSignalState =
  | {
      status: 'due';
      cue: LucidNightCue;
      expiredCueIds: readonly string[];
    }
  | {
      status: 'waiting';
      nextAt: number;
      expiredCueIds: readonly string[];
    }
  | {
      status: 'complete';
      reason: 'timer_elapsed' | 'all_cues_handled';
      expiredCueIds: readonly string[];
    };

function getSafetyBlockReason(
  safety: LucidAudioSafety
): LucidAudioBlockReason | null {
  if (!safety.acknowledged) return 'safety_not_acknowledged';
  if (safety.playbackRoute !== 'speaker') return 'unsafe_route';
  if (safety.sleepIsFragile) return 'fragile_sleep';
  if (safety.hearingConcern) return 'hearing_concern';
  return null;
}

function isFiniteDeadline(value: number): boolean {
  return Number.isFinite(value) && Number.isSafeInteger(value) && value >= 0;
}

function clampPositive(value: number, maximum: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.min(value, maximum);
}

export function isLucidNightSoundId(value: unknown): value is LucidNightSoundId {
  return LUCID_NIGHT_SOUND_IDS.includes(value as LucidNightSoundId);
}

export function getLucidNightVolumeBand(volume: number): LucidNightVolumeBand {
  if (volume <= 0.15) return 'very_low';
  if (volume <= 0.25) return 'low';
  return 'gentle';
}

export function getLucidNightSoundFile(
  soundId: LucidNightSoundId,
  volume: number
): string {
  return LUCID_NIGHT_SOUND_FILES[soundId][getLucidNightVolumeBand(volume)];
}

export function createLucidPreviewPlan(
  request: LucidPreviewRequest
): LucidPreviewPlanResult {
  const safetyBlock = getSafetyBlockReason(request.safety);
  if (safetyBlock) return { status: 'blocked', reason: safetyBlock };
  if (!isFiniteDeadline(request.nowAt)) {
    return { status: 'blocked', reason: 'invalid_deadline' };
  }
  const volume = clampPositive(request.requestedVolume, MAX_LUCID_PREVIEW_VOLUME);
  if (volume === null) return { status: 'blocked', reason: 'invalid_volume' };
  const duration = clampPositive(
    request.requestedDurationMs,
    MAX_LUCID_PREVIEW_DURATION_MS
  );
  if (duration === null) return { status: 'blocked', reason: 'invalid_duration' };
  if (!isLucidNightSoundId(request.soundId)) {
    return { status: 'blocked', reason: 'no_safe_signals' };
  }
  const volumeBand = getLucidNightVolumeBand(volume);

  const stopAt = request.nowAt + duration;
  if (!isFiniteDeadline(stopAt)) {
    return { status: 'blocked', reason: 'invalid_deadline' };
  }
  return {
    status: 'ready',
    plan: {
      startsAt: request.nowAt,
      stopAt,
      volume,
      volumeBand,
      soundId: request.soundId,
      soundFile: LUCID_NIGHT_SOUND_FILES[request.soundId][volumeBand],
      safetyRules: LUCID_AUDIO_SAFETY_RULES,
    },
  };
}

function rejectCue(
  rejectedCues: LucidNightCueRejection[],
  requestedIndex: number,
  reason: LucidNightCueRejectionReason
): void {
  rejectedCues.push({ requestedIndex, reason });
}

export function createLucidNightSignalPlan(
  request: LucidNightSignalRequest
): LucidNightSignalPlanResult {
  if (!request.enabled) return { status: 'blocked', reason: 'disabled' };
  const safetyBlock = getSafetyBlockReason(request.safety);
  if (safetyBlock) return { status: 'blocked', reason: safetyBlock };
  if (!isFiniteDeadline(request.sessionStartAt)) {
    return { status: 'blocked', reason: 'invalid_deadline' };
  }
  if (
    !Number.isInteger(request.timerMinutes) ||
    request.timerMinutes < MIN_LUCID_TIMER_MINUTES ||
    request.timerMinutes > MAX_LUCID_TIMER_MINUTES
  ) {
    return { status: 'blocked', reason: 'invalid_timer' };
  }

  const volume = clampPositive(request.requestedVolume, MAX_LUCID_NIGHT_VOLUME);
  if (volume === null) return { status: 'blocked', reason: 'invalid_volume' };
  const cueDuration = clampPositive(
    request.requestedCueDurationMs ?? MAX_LUCID_CUE_DURATION_MS,
    MAX_LUCID_CUE_DURATION_MS
  );
  if (cueDuration === null) return { status: 'blocked', reason: 'invalid_duration' };
  if (!isLucidNightSoundId(request.soundId)) {
    return { status: 'blocked', reason: 'no_safe_signals' };
  }
  const volumeBand = getLucidNightVolumeBand(volume);

  const timerEndsAt = request.sessionStartAt + request.timerMinutes * 60 * 1000;
  if (!isFiniteDeadline(timerEndsAt)) {
    return { status: 'blocked', reason: 'invalid_deadline' };
  }

  const requestedCues = request.cueOffsetsMinutes
    .map((offsetMinutes, requestedIndex) => ({ offsetMinutes, requestedIndex }))
    .sort((left, right) => {
      if (!Number.isFinite(left.offsetMinutes)) return 1;
      if (!Number.isFinite(right.offsetMinutes)) return -1;
      return left.offsetMinutes - right.offsetMinutes || left.requestedIndex - right.requestedIndex;
    });
  const cues: LucidNightCue[] = [];
  const rejectedCues: LucidNightCueRejection[] = [];
  let previousStartAt: number | null = null;
  const sessionId = `lucid-night-${request.sessionStartAt}`;

  for (const requestedCue of requestedCues) {
    if (
      !Number.isFinite(requestedCue.offsetMinutes) ||
      requestedCue.offsetMinutes < 0
    ) {
      rejectCue(rejectedCues, requestedCue.requestedIndex, 'invalid_offset');
      continue;
    }
    const startsAt =
      request.sessionStartAt + requestedCue.offsetMinutes * 60 * 1000;
    const stopAt = startsAt + cueDuration;
    if (!isFiniteDeadline(startsAt) || !isFiniteDeadline(stopAt)) {
      rejectCue(rejectedCues, requestedCue.requestedIndex, 'invalid_offset');
      continue;
    }
    if (startsAt - request.sessionStartAt < MIN_LUCID_FIRST_CUE_DELAY_MS) {
      rejectCue(rejectedCues, requestedCue.requestedIndex, 'too_early');
      continue;
    }
    if (stopAt > timerEndsAt - LUCID_QUIET_BEFORE_TIMER_END_MS) {
      rejectCue(rejectedCues, requestedCue.requestedIndex, 'too_late');
      continue;
    }
    if (previousStartAt !== null && startsAt - previousStartAt < MIN_LUCID_CUE_GAP_MS) {
      rejectCue(rejectedCues, requestedCue.requestedIndex, 'too_close');
      continue;
    }
    if (cues.length >= MAX_LUCID_NIGHT_CUES) {
      rejectCue(rejectedCues, requestedCue.requestedIndex, 'limit_reached');
      continue;
    }

    cues.push({
      id: `${sessionId}:cue:${requestedCue.requestedIndex + 1}`,
      requestedIndex: requestedCue.requestedIndex,
      startsAt,
      stopAt,
    });
    previousStartAt = startsAt;
  }

  rejectedCues.sort((left, right) => left.requestedIndex - right.requestedIndex);
  if (cues.length === 0) {
    return { status: 'blocked', reason: 'no_safe_signals' };
  }
  return {
    status: 'ready',
    plan: {
      sessionId,
      sessionStartAt: request.sessionStartAt,
      timerEndsAt,
      volume,
      volumeBand,
      soundId: request.soundId,
      soundFile: LUCID_NIGHT_SOUND_FILES[request.soundId][volumeBand],
      cues,
      rejectedCues,
      safetyRules: LUCID_AUDIO_SAFETY_RULES,
    },
  };
}

export function resolveLucidNightSignalState(
  plan: LucidNightSignalPlan,
  nowAt: number,
  completedCueIds: readonly string[] = []
): LucidNightSignalState {
  const completed = new Set(completedCueIds);
  const expiredCueIds: string[] = [];

  for (const cue of plan.cues) {
    if (completed.has(cue.id)) continue;
    if (nowAt >= cue.stopAt) {
      expiredCueIds.push(cue.id);
      continue;
    }
    if (nowAt >= cue.startsAt) {
      return { status: 'due', cue, expiredCueIds };
    }
    return { status: 'waiting', nextAt: cue.startsAt, expiredCueIds };
  }

  return {
    status: 'complete',
    reason: nowAt >= plan.timerEndsAt ? 'timer_elapsed' : 'all_cues_handled',
    expiredCueIds,
  };
}
