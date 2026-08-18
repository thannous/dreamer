import {
  createLucidNightSignalPlan,
  createLucidPreviewPlan,
  getLucidNightVolumeBand,
  MAX_LUCID_CUE_DURATION_MS,
  MAX_LUCID_NIGHT_VOLUME,
  MAX_LUCID_PREVIEW_DURATION_MS,
  MAX_LUCID_PREVIEW_VOLUME,
  resolveLucidNightSignalState,
  type LucidAudioSafety,
} from '@/lib/lucid/audio';

const MINUTE = 60 * 1000;
const START = 1_700_000_000_000;
const safeAudio: LucidAudioSafety = {
  acknowledged: true,
  playbackRoute: 'speaker',
  sleepIsFragile: false,
  hearingConcern: false,
};

describe('lucid audio safety plans', () => {
  it('maps every bounded volume to a native amplitude band', () => {
    expect(getLucidNightVolumeBand(0.1)).toBe('very_low');
    expect(getLucidNightVolumeBand(0.15)).toBe('very_low');
    expect(getLucidNightVolumeBand(0.2)).toBe('low');
    expect(getLucidNightVolumeBand(0.25)).toBe('low');
    expect(getLucidNightVolumeBand(0.3)).toBe('gentle');
  });

  it('caps preview volume and duration and emits an absolute stop deadline', () => {
    expect(
      createLucidPreviewPlan({
        nowAt: START,
        requestedVolume: 1,
        requestedDurationMs: 60_000,
        soundId: 'rain',
        safety: safeAudio,
      })
    ).toEqual({
      status: 'ready',
      plan: {
        startsAt: START,
        stopAt: START + MAX_LUCID_PREVIEW_DURATION_MS,
        volume: MAX_LUCID_PREVIEW_VOLUME,
        volumeBand: 'low',
        soundId: 'rain',
        soundFile: 'lucid_cue_rain_low.wav',
        safetyRules: [
          'low_volume',
          'speaker_only',
          'stop_if_sleep_disrupted',
          'no_medical_claim',
        ],
      },
    });
  });

  it.each([
    [{ ...safeAudio, acknowledged: false }, 'safety_not_acknowledged'],
    [{ ...safeAudio, playbackRoute: 'headphones' as const }, 'unsafe_route'],
    [{ ...safeAudio, playbackRoute: 'unknown' as const }, 'unsafe_route'],
    [{ ...safeAudio, sleepIsFragile: true }, 'fragile_sleep'],
    [{ ...safeAudio, hearingConcern: true }, 'hearing_concern'],
  ])('blocks unsafe preview conditions', (safety, reason) => {
    expect(
      createLucidPreviewPlan({
        nowAt: START,
        requestedVolume: 0.1,
        requestedDurationMs: 2_000,
        soundId: 'rain',
        safety,
      })
    ).toEqual({ status: 'blocked', reason });
  });

  it('builds a bounded night plan and explains rejected cue requests', () => {
    const result = createLucidNightSignalPlan({
      enabled: true,
      sessionStartAt: START,
      timerMinutes: 360,
      cueOffsetsMinutes: [45, 90, 120, 130, 180, 225, 270, 315, 330],
      requestedVolume: 0.9,
      requestedCueDurationMs: 20_000,
      soundId: 'ocean',
      safety: safeAudio,
    });

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Expected a safe plan.');
    expect(result.plan.timerEndsAt).toBe(START + 360 * MINUTE);
    expect(result.plan.sessionId).toBe(`lucid-night-${START}`);
    expect(result.plan.volume).toBe(MAX_LUCID_NIGHT_VOLUME);
    expect(result.plan.volumeBand).toBe('gentle');
    expect(result.plan.soundId).toBe('ocean');
    expect(result.plan.soundFile).toBe('lucid_cue_ocean.wav');
    expect(result.plan.cues).toHaveLength(4);
    expect(result.plan.cues.map((cue) => cue.startsAt)).toEqual([
      START + 90 * MINUTE,
      START + 180 * MINUTE,
      START + 225 * MINUTE,
      START + 270 * MINUTE,
    ]);
    expect(
      result.plan.cues.every(
        (cue) => cue.stopAt - cue.startsAt === MAX_LUCID_CUE_DURATION_MS
      )
    ).toBe(true);
    expect(result.plan.rejectedCues).toEqual([
      { requestedIndex: 0, reason: 'too_early' },
      { requestedIndex: 2, reason: 'too_close' },
      { requestedIndex: 3, reason: 'too_close' },
      { requestedIndex: 7, reason: 'limit_reached' },
      { requestedIndex: 8, reason: 'too_late' },
    ]);
  });

  it('blocks disabled, invalid, and empty-safe-window plans', () => {
    const request = {
      enabled: true,
      sessionStartAt: START,
      timerMinutes: 360,
      cueOffsetsMinutes: [90],
      requestedVolume: 0.1,
      soundId: 'rain' as const,
      safety: safeAudio,
    };

    expect(createLucidNightSignalPlan({ ...request, enabled: false })).toEqual({
      status: 'blocked',
      reason: 'disabled',
    });
    expect(createLucidNightSignalPlan({ ...request, timerMinutes: 60 })).toEqual({
      status: 'blocked',
      reason: 'invalid_timer',
    });
    expect(
      createLucidNightSignalPlan({ ...request, cueOffsetsMinutes: [15, 30] })
    ).toEqual({ status: 'blocked', reason: 'no_safe_signals' });
  });

  it('never replays an expired cue and respects completed cue ids', () => {
    const result = createLucidNightSignalPlan({
      enabled: true,
      sessionStartAt: START,
      timerMinutes: 360,
      cueOffsetsMinutes: [90, 180],
      requestedVolume: 0.1,
      soundId: 'brown-noise',
      safety: safeAudio,
    });
    if (result.status !== 'ready') throw new Error('Expected a safe plan.');
    const [firstCue, secondCue] = result.plan.cues;

    expect(resolveLucidNightSignalState(result.plan, START + 100 * MINUTE)).toEqual({
      status: 'waiting',
      nextAt: secondCue.startsAt,
      expiredCueIds: [firstCue.id],
    });
    expect(resolveLucidNightSignalState(result.plan, secondCue.startsAt)).toEqual({
      status: 'due',
      cue: secondCue,
      expiredCueIds: [firstCue.id],
    });
    expect(
      resolveLucidNightSignalState(result.plan, START + 100 * MINUTE, [
        secondCue.id,
      ])
    ).toEqual({
      status: 'complete',
      reason: 'all_cues_handled',
      expiredCueIds: [firstCue.id],
    });
    expect(
      resolveLucidNightSignalState(result.plan, result.plan.timerEndsAt)
    ).toEqual({
      status: 'complete',
      reason: 'timer_elapsed',
      expiredCueIds: [firstCue.id, secondCue.id],
    });
  });
});
