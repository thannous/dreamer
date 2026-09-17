import { createLucidGuidedRitualPlan } from '@/lib/lucid/guidedRitual';
import type { LucidSafetyMode, LucidSafetyPolicy } from '@/lib/lucid/safety';
import {
  completeLucidSsildSensoryLabSession,
  createLucidSsildSensoryLabPlan,
  createLucidSsildSensoryLabSession,
  createLucidSsildSensoryLabSessionId,
  exitLucidSsildSensoryLabSession,
  getLucidSsildSensoryLabCurrentPhase,
  getLucidSsildSensoryLabElapsedMs,
  getLucidSsildSensoryLabFeedback,
  getLucidSsildSensoryLabProgression,
  getLucidSsildSensoryLabRemainingMs,
  interruptLucidSsildSensoryLabSession,
  isLucidSsildSensoryLabSession,
  parseLucidSsildSensoryLabSession,
  pauseLucidSsildSensoryLabSession,
  resumeLucidSsildSensoryLabSession,
  startLucidSsildSensoryLabSession,
  tickLucidSsildSensoryLabSession,
} from '@/lib/lucid/ssildSensoryLab';

const NOW = 1_700_000_000_000;

function policy(
  mode: LucidSafetyMode,
  overrides: Partial<LucidSafetyPolicy> = {}
): LucidSafetyPolicy {
  return {
    mode,
    allowWbtb: mode === 'normal',
    allowNightSignals: mode === 'normal',
    nightSignalIntensity: mode === 'normal' ? 'normal' : 'blocked',
    emergencyStopAllowed: true,
    reasons: [],
    ...overrides,
  };
}

function readyPlan(
  mode: LucidSafetyMode,
  overrides: Partial<LucidSafetyPolicy> = {}
) {
  const plan = createLucidGuidedRitualPlan('ssild', policy(mode, overrides));
  expect(plan.status).toBe('ready');
  if (plan.status !== 'ready') throw new Error('Expected a ready SSILD plan');
  return plan;
}

function idle(now = NOW, sessionId = 'ssild_lab_session01') {
  return createLucidSsildSensoryLabSession({
    plan: readyPlan('normal'),
    sessionId,
    now,
  });
}

function start(now = NOW + 1, sessionId = 'ssild_lab_session01') {
  return startLucidSsildSensoryLabSession(idle(NOW, sessionId), now);
}

describe('Lucid SSILD sensory lab plans', () => {
  it('derives a deterministic full 300s plan and keeps slow-cycle duration exact', () => {
    const source = readyPlan('normal');
    const plan = createLucidSsildSensoryLabPlan(source);
    expect(source.totalDurationSeconds).toBe(300);
    expect(plan).toMatchObject({
      mode: 'full',
      soundAllowed: true,
      totalDurationMs: 300_000,
    });
    expect(plan.phases.map((phase) => phase.id)).toEqual([
      'ssild_settle',
      'ssild_sight_direct',
      'ssild_sound_direct',
      'ssild_body_direct',
      'ssild_sight_slow',
      'ssild_sound_slow',
      'ssild_body_slow',
      'ssild_release',
    ]);
    expect(plan.phases.map((phase) => phase.focus)).toEqual([
      'settle',
      'sight',
      'sound',
      'body',
      'sight',
      'sound',
      'body',
      'release',
    ]);
    const slow = plan.phases.filter((phase) => phase.cycle === 'slow');
    expect(slow.map((phase) => phase.focus)).toEqual(['sight', 'sound', 'body']);
    expect(slow.reduce((sum, phase) => sum + phase.durationMs, 0)).toBe(60_000);
    expect(plan.phases.reduce((sum, phase) => sum + phase.durationMs, 0)).toBe(300_000);
  });

  it('derives a reduced 180s plan without recovery phases', () => {
    const source = readyPlan('reducedIntensity', {
      allowNightSignals: false,
      nightSignalIntensity: 'blocked',
      reasons: ['fragile_sleep'],
    });
    const plan = createLucidSsildSensoryLabPlan(source);
    expect(source.totalDurationSeconds).toBe(180);
    expect(plan).toMatchObject({
      mode: 'reduced',
      soundAllowed: false,
      totalDurationMs: 180_000,
    });
    expect(plan.phases.map((phase) => phase.id)).toEqual([
      'ssild_sight_direct',
      'ssild_sound_direct',
      'ssild_body_direct',
      'ssild_release',
    ]);
    expect(plan.phases.some((phase) => phase.sourcePhaseId === 'ssild_slow_cycle')).toBe(
      false
    );
  });

  it('refuses MILD, recovery replacement and incoherent SSILD phases', () => {
    const mild = createLucidGuidedRitualPlan('mild', policy('normal'));
    expect(mild.status).toBe('ready');
    if (mild.status !== 'ready') throw new Error('Expected a ready MILD plan');
    expect(() => createLucidSsildSensoryLabPlan(mild)).toThrow('SSILD');

    const recovery = createLucidGuidedRitualPlan(
      'ssild',
      policy('recovery', {
        allowWbtb: false,
        allowNightSignals: false,
        nightSignalIntensity: 'blocked',
        reasons: ['recent_sleep_degraded'],
      })
    );
    expect(recovery.status).toBe('ready');
    if (recovery.status !== 'ready') throw new Error('Expected a ready recovery plan');
    expect(recovery.mode).toBe('replacement');
    expect(() => createLucidSsildSensoryLabPlan(recovery)).toThrow('recovery');

    const ssild = readyPlan('normal');
    expect(() =>
      createLucidSsildSensoryLabPlan({
        ...ssild,
        phases: ssild.phases.slice(1),
      })
    ).toThrow('inconsistent');
  });

  it('dims audition, keeps body haptics subtle and silences audio when sound is blocked', () => {
    const audible = createLucidSsildSensoryLabPlan(readyPlan('normal'));
    const silent = createLucidSsildSensoryLabPlan(
      readyPlan('reducedIntensity', {
        allowNightSignals: false,
        nightSignalIntensity: 'blocked',
      })
    );
    const sound = audible.phases.find((phase) => phase.focus === 'sound');
    const body = audible.phases.find((phase) => phase.focus === 'body');
    expect(sound).toMatchObject({
      visual: 'dim',
      haptic: 'none',
      audio: 'cue',
      audioCueId: 'ssild_sound_direct',
      a11yStateId: 'ssild.ssild_sound_direct',
    });
    expect(body).toMatchObject({
      haptic: 'subtle',
      visual: 'neutral',
    });
    expect(silent.soundAllowed).toBe(false);
    expect(silent.phases.every((phase) => phase.audio === 'silent')).toBe(true);
    expect(silent.phases.every((phase) => phase.audioCueId === 'none')).toBe(true);
  });
});

describe('Lucid SSILD sensory lab engine', () => {
  it('creates a safe session id and starts idle sessions without leaking user text', () => {
    expect(createLucidSsildSensoryLabSessionId(NOW, 'abc 123')).toBe(
      `ssild_${NOW.toString(36)}_abc123`
    );
    expect(() => createLucidSsildSensoryLabSessionId(-1, 'abc')).toThrow(
      'Invalid SSILD sensory lab timestamp'
    );
    expect(() =>
      createLucidSsildSensoryLabSession({
        plan: readyPlan('normal'),
        sessionId: '__proto__',
        now: NOW,
      })
    ).toThrow('Invalid SSILD sensory lab session id');
    const session = idle();
    expect(session).toMatchObject({
      version: 1,
      status: 'idle',
      planMode: 'full',
      soundAllowed: true,
      phaseIndex: 0,
      elapsedInPhaseMs: 0,
      accumulatedElapsedMs: 0,
      interruptionReason: 'none',
    });
    expect(JSON.stringify(session)).not.toMatch(/premium|dream|secret/i);
  });

  it('ticks exact boundaries, multi-phase jumps and completes at totalDurationMs without drift', () => {
    const started = start();
    const plan = createLucidSsildSensoryLabPlan(readyPlan('normal'));
    const settleEnd = started.startedAt! + plan.phases[0].durationMs;
    const atBoundary = tickLucidSsildSensoryLabSession(started, settleEnd);
    expect(atBoundary.session).toMatchObject({
      status: 'running',
      phaseIndex: 1,
      elapsedInPhaseMs: 0,
      accumulatedElapsedMs: plan.phases[0].durationMs,
    });
    expect(atBoundary.feedback).toMatchObject({
      phaseChanged: true,
      enteredFocus: 'sight',
      previousPhaseIndex: 0,
      phaseIndex: 1,
      a11yStateId: 'ssild.ssild_sight_direct',
    });

    const jumpAt = started.startedAt! + 215_000;
    const jumped = tickLucidSsildSensoryLabSession(started, jumpAt);
    expect(jumped.session.accumulatedElapsedMs).toBe(215_000);
    expect(jumped.session.phaseIndex).toBe(4);
    expect(jumped.session.elapsedInPhaseMs).toBe(5_000);
    expect(getLucidSsildSensoryLabCurrentPhase(jumped.session)).toMatchObject({
      id: 'ssild_sight_slow',
      cycle: 'slow',
      focus: 'sight',
    });

    const completed = tickLucidSsildSensoryLabSession(
      started,
      started.startedAt! + plan.totalDurationMs
    );
    expect(completed.session).toMatchObject({
      status: 'completed',
      accumulatedElapsedMs: 300_000,
      elapsedInPhaseMs: 30_000,
      phaseIndex: 7,
      lastResumedAt: null,
      completedAt: started.startedAt! + 300_000,
    });
    expect(completed.session.accumulatedElapsedMs).toBe(plan.totalDurationMs);
    expect(getLucidSsildSensoryLabRemainingMs(completed.session)).toBe(0);
    expect(getLucidSsildSensoryLabProgression(completed.session)).toBe(1);
  });

  it('excludes a long pause from elapsed time and resumes the same phase', () => {
    const started = start();
    const pauseAt = started.startedAt! + 11_000;
    const paused = pauseLucidSsildSensoryLabSession(started, pauseAt);
    expect(paused).toMatchObject({
      status: 'paused',
      phaseIndex: 0,
      elapsedInPhaseMs: 11_000,
      accumulatedElapsedMs: 11_000,
      lastResumedAt: null,
      pausedAt: pauseAt,
    });
    expect(pauseLucidSsildSensoryLabSession(paused, pauseAt + 80_000)).toEqual(paused);

    const resumeAt = pauseAt + 80_000;
    const resumed = resumeLucidSsildSensoryLabSession(paused, resumeAt);
    expect(resumed).toMatchObject({
      status: 'running',
      phaseIndex: 0,
      elapsedInPhaseMs: 11_000,
      accumulatedElapsedMs: 11_000,
      lastResumedAt: resumeAt,
      pausedAt: null,
    });
    const afterResume = tickLucidSsildSensoryLabSession(resumed, resumeAt + 1_000);
    expect(afterResume.session).toMatchObject({
      status: 'running',
      phaseIndex: 0,
      elapsedInPhaseMs: 12_000,
      accumulatedElapsedMs: 12_000,
    });
  });

  it('keeps audio interruption and immediate exit persistable without auto-completing', () => {
    const started = start();
    const interruptAt = started.startedAt! + 39_000;
    const interrupted = interruptLucidSsildSensoryLabSession(
      started,
      interruptAt,
      'audio_route'
    );
    expect(interrupted).toMatchObject({
      status: 'interrupted',
      interruptionReason: 'audio_route',
      accumulatedElapsedMs: 39_000,
      completedAt: null,
    });
    expect(interruptLucidSsildSensoryLabSession(interrupted, interruptAt + 1_000)).toEqual(
      interrupted
    );
    expect(() => completeLucidSsildSensoryLabSession(interrupted, interruptAt + 1_000)).toThrow(
      'cannot complete'
    );

    const resumed = resumeLucidSsildSensoryLabSession(interrupted, interruptAt + 10_000);
    expect(resumed).toMatchObject({
      status: 'running',
      phaseIndex: interrupted.phaseIndex,
      elapsedInPhaseMs: interrupted.elapsedInPhaseMs,
      accumulatedElapsedMs: interrupted.accumulatedElapsedMs,
      interruptionReason: 'none',
    });

    const exited = exitLucidSsildSensoryLabSession(resumed, interruptAt + 11_000);
    expect(exited).toMatchObject({
      status: 'interrupted',
      interruptionReason: 'user_exit',
      completedAt: null,
    });
    expect(parseLucidSsildSensoryLabSession(exited)).toEqual(exited);
    expect(exited.status).not.toBe('completed');
  });

  it('rejects illegal transitions and regressive or non-integer clocks', () => {
    const session = idle();
    expect(() => tickLucidSsildSensoryLabSession(session, NOW + 1)).toThrow('running');
    expect(() => completeLucidSsildSensoryLabSession(session, NOW + 1)).toThrow(
      'cannot complete'
    );
    const started = start();
    expect(startLucidSsildSensoryLabSession(started, NOW + 2)).toMatchObject({
      status: 'running',
      startedAt: NOW + 1,
    });
    expect(() => tickLucidSsildSensoryLabSession(started, NOW)).toThrow('regress');
    expect(() => tickLucidSsildSensoryLabSession(started, Number.NaN)).toThrow(
      'timestamp'
    );
    expect(() => completeLucidSsildSensoryLabSession(started, NOW + 2)).toThrow(
      'full duration'
    );
    const completed = tickLucidSsildSensoryLabSession(started, NOW + 1 + 300_000).session;
    expect(() => pauseLucidSsildSensoryLabSession(completed, NOW + 400_000)).toThrow(
      'pause'
    );
    expect(() => interruptLucidSsildSensoryLabSession(completed, NOW + 400_000)).toThrow(
      'interrupted'
    );
    expect(() => resumeLucidSsildSensoryLabSession(idle(), NOW + 2)).toThrow('resume');
  });
});

describe('Lucid SSILD sensory lab persistence and helpers', () => {
  it('parses exact keys and rejects hostile ids, NaN and impossible clocks', () => {
    const started = start();
    expect(isLucidSsildSensoryLabSession(started)).toBe(true);
    expect(parseLucidSsildSensoryLabSession(started)).toEqual(started);
    expect(parseLucidSsildSensoryLabSession({ ...started, extra: true })).toBeNull();
    expect(parseLucidSsildSensoryLabSession({ ...started, sessionId: '__proto__' })).toBeNull();
    expect(
      parseLucidSsildSensoryLabSession({ ...started, sessionId: ' constructor ' })
    ).toBeNull();
    expect(parseLucidSsildSensoryLabSession({ ...started, phaseIndex: 99 })).toBeNull();
    expect(
      parseLucidSsildSensoryLabSession({ ...started, elapsedInPhaseMs: 12 })
    ).toBeNull();
    expect(
      parseLucidSsildSensoryLabSession({ ...started, accumulatedElapsedMs: Number.NaN })
    ).toBeNull();
    expect(
      parseLucidSsildSensoryLabSession({
        ...started,
        status: 'completed',
        completedAt: null,
      })
    ).toBeNull();
    expect(
      parseLucidSsildSensoryLabSession({
        ...started,
        lastResumedAt: NOW + 9_000_000_000_000_000,
      })
    ).toBeNull();
    expect(
      parseLucidSsildSensoryLabSession({
        ...started,
        completedAt: NOW + 50,
        updatedAt: NOW + 2,
      })
    ).toBeNull();
    const polluted = JSON.parse('{"version":1,"__proto__":{"admin":true}}');
    expect(parseLucidSsildSensoryLabSession(polluted)).toBeNull();
    expect(Object.prototype).not.toHaveProperty('admin');
    expect(parseLucidSsildSensoryLabSession('{"not":"an-object"}')).toBeNull();
    expect(parseLucidSsildSensoryLabSession(null)).toBeNull();
  });

  it('keeps progression and remaining bounded and reports causal phase feedback', () => {
    const started = start();
    expect(getLucidSsildSensoryLabProgression(started)).toBe(0);
    expect(getLucidSsildSensoryLabRemainingMs(started)).toBe(300_000);
    const later = tickLucidSsildSensoryLabSession(started, started.startedAt! + 90_000).session;
    expect(getLucidSsildSensoryLabElapsedMs(later)).toBe(90_000);
    expect(getLucidSsildSensoryLabProgression(later)).toBe(90_000 / 300_000);
    expect(getLucidSsildSensoryLabRemainingMs(later)).toBe(210_000);
    const completed = tickLucidSsildSensoryLabSession(started, started.startedAt! + 400_000).session;
    expect(getLucidSsildSensoryLabProgression(completed)).toBe(1);
    expect(getLucidSsildSensoryLabRemainingMs(completed)).toBe(0);
    expect(getLucidSsildSensoryLabElapsedMs(completed)).toBe(300_000);
    const feedback = getLucidSsildSensoryLabFeedback(started, later);
    expect(feedback).toMatchObject({
      phaseChanged: true,
      enteredFocus: 'sound',
      previousPhaseIndex: 0,
      phaseIndex: 2,
      a11yStateId: 'ssild.ssild_sound_direct',
    });
  });

  it('returns immutable clones from parse and current-phase helpers', () => {
    const started = start();
    const parsed = parseLucidSsildSensoryLabSession(started);
    expect(parsed).toEqual(started);
    if (!parsed) throw new Error('Expected a parsed session');
    (parsed as { status: string }).status = 'completed';
    expect(started.status).toBe('running');
    const phase = getLucidSsildSensoryLabCurrentPhase(started);
    (phase as { focus: string }).focus = 'release';
    expect(getLucidSsildSensoryLabCurrentPhase(started).focus).toBe('settle');
  });
});
