import {
  LUCID_STABILIZATION_LAB_MAX_DURATION_MS,
  LUCID_STABILIZATION_LAB_MAX_INSIGHT_SESSIONS,
  LUCID_STABILIZATION_LAB_MAX_REPEAT_COUNT,
  LUCID_STABILIZATION_LAB_STEP_IDS,
  LUCID_STABILIZATION_LAB_STEPS,
  LUCID_STABILIZATION_LAB_TOTAL_DURATION_MS,
  advanceLucidStabilizationLabSession,
  assertLucidStabilizationLabCatalog,
  completeLucidStabilizationLabSession,
  createLucidStabilizationLabSession,
  createLucidStabilizationLabSessionId,
  getLucidStabilizationLabCurrentStep,
  interruptLucidStabilizationLabSession,
  isLucidStabilizationLabSession,
  parseLucidStabilizationLabSession,
  pauseLucidStabilizationLabSession,
  projectLucidStabilizationLabInsights,
  repeatLucidStabilizationLabStep,
  resumeLucidStabilizationLabSession,
  startLucidStabilizationLabSession,
  type LucidStabilizationLabSession,
} from '@/lib/lucid/stabilizationLab';

const NOW = 1_700_000_000_000;

function idle(now = NOW, sessionId = 'stab_lab_session01'): LucidStabilizationLabSession {
  return createLucidStabilizationLabSession({ now, sessionId });
}

function start(sessionId = 'stab_lab_session01', now = NOW + 1): LucidStabilizationLabSession {
  return startLucidStabilizationLabSession(idle(NOW, sessionId), now);
}

function finishLastStep(session: LucidStabilizationLabSession, now: number): LucidStabilizationLabSession {
  let next = session;
  for (let index = 0; index < 4; index += 1) {
    next = advanceLucidStabilizationLabSession(next, now + index);
  }
  expect(next.stepIndex).toBe(4);
  expect(next.completedStepIds).toEqual([
    'hands',
    'surface',
    'three_details',
    'intention',
  ]);
  return advanceLucidStabilizationLabSession(next, now + 4);
}

describe('Lucid stabilization lab catalog', () => {
  it('exposes five ordered steps totaling at most 270 seconds', () => {
    expect(LUCID_STABILIZATION_LAB_STEP_IDS).toEqual([
      'hands',
      'surface',
      'three_details',
      'intention',
      'slow_before_control',
    ]);
    expect(LUCID_STABILIZATION_LAB_STEPS.map((step) => step.id)).toEqual([
      ...LUCID_STABILIZATION_LAB_STEP_IDS,
    ]);
    expect(LUCID_STABILIZATION_LAB_TOTAL_DURATION_MS).toBeGreaterThan(0);
    expect(LUCID_STABILIZATION_LAB_TOTAL_DURATION_MS).toBeLessThanOrEqual(
      LUCID_STABILIZATION_LAB_MAX_DURATION_MS
    );
    expect(LUCID_STABILIZATION_LAB_TOTAL_DURATION_MS).toBeLessThan(300_000);
    expect(() => assertLucidStabilizationLabCatalog()).not.toThrow();
  });

  it('creates a safe session id from injected now and entropy', () => {
    expect(createLucidStabilizationLabSessionId(NOW, 'abc 123')).toBe(
      `stab_${NOW.toString(36)}_abc123`
    );
    expect(() => createLucidStabilizationLabSessionId(-1, 'abc')).toThrow(
      'Invalid stabilization lab timestamp'
    );
    expect(() => createLucidStabilizationLabSession({ now: NOW, sessionId: '__proto__' })).toThrow(
      'Invalid stabilization lab session id'
    );
  });
});

describe('Lucid stabilization lab session', () => {
  it('completes a nominal path in under five minutes with one current step', () => {
    let session = start();
    expect(getLucidStabilizationLabCurrentStep(session).id).toBe('hands');
    session = finishLastStep(session, NOW + 2);
    expect(session.status).toBe('active');
    expect(session.stepIndex).toBe(4);
    expect(session.completedStepIds).toEqual([...LUCID_STABILIZATION_LAB_STEP_IDS]);
    expect(getLucidStabilizationLabCurrentStep(session).id).toBe('slow_before_control');
    const completed = completeLucidStabilizationLabSession(session, NOW + 10);
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).toBe(NOW + 10);
    expect(completed.updatedAt - completed.startedAt!).toBeLessThan(300_000);
    expect(completeLucidStabilizationLabSession(completed, NOW + 11)).toEqual(completed);
  });

  it('repeats, pauses, resumes and interrupts without moving the cursor or losing progress', () => {
    const started = start();
    const repeated = repeatLucidStabilizationLabStep(started, NOW + 2);
    expect(repeated.stepIndex).toBe(0);
    expect(repeated.completedStepIds).toEqual([]);
    expect(repeated.repeatCounts.hands).toBe(1);
    const advanced = advanceLucidStabilizationLabSession(repeated, NOW + 3);
    expect(advanced.stepIndex).toBe(1);
    expect(advanced.completedStepIds).toEqual(['hands']);
    expect(advanced.repeatCounts.hands).toBe(1);
    const paused = pauseLucidStabilizationLabSession(advanced, NOW + 4);
    expect(paused.status).toBe('paused');
    expect(paused.stepIndex).toBe(1);
    expect(paused.completedStepIds).toEqual(['hands']);
    expect(pauseLucidStabilizationLabSession(paused, NOW + 5)).toEqual(paused);
    const resumed = resumeLucidStabilizationLabSession(paused, NOW + 6);
    expect(resumed.status).toBe('active');
    expect(resumed.stepIndex).toBe(1);
    const interrupted = interruptLucidStabilizationLabSession(resumed, NOW + 7);
    expect(interrupted.status).toBe('interrupted');
    expect(interrupted.stepIndex).toBe(1);
    expect(interrupted.repeatCounts.hands).toBe(1);
    expect(interruptLucidStabilizationLabSession(interrupted, NOW + 8)).toEqual(interrupted);
    const afterInterrupt = resumeLucidStabilizationLabSession(interrupted, NOW + 9);
    expect(afterInterrupt).toMatchObject({
      status: 'active',
      stepIndex: 1,
      completedStepIds: ['hands'],
      repeatCounts: expect.objectContaining({ hands: 1, surface: 0 }),
    });
  });

  it('rejects illegal transitions, duplicate advances and regressive timestamps', () => {
    const session = idle();
    expect(() => advanceLucidStabilizationLabSession(session, NOW + 1)).toThrow(
      'Only an active stabilization lab session can advance'
    );
    expect(() => completeLucidStabilizationLabSession(session, NOW + 1)).toThrow(
      'Stabilization lab must finish its last step before completion'
    );
    const started = start();
    expect(startLucidStabilizationLabSession(started, NOW + 2)).toMatchObject({
      status: 'active',
      startedAt: NOW + 1,
    });
    expect(() => advanceLucidStabilizationLabSession(started, NOW - 1)).toThrow(
      'Stabilization lab timestamp cannot regress'
    );
    expect(() => completeLucidStabilizationLabSession(started, NOW + 2)).toThrow(
      'Stabilization lab must finish its last step before completion'
    );
    const last = finishLastStep(started, NOW + 2);
    expect(() => advanceLucidStabilizationLabSession(last, NOW + 20)).toThrow(
      'Stabilization lab is ready to complete'
    );
    const completed = completeLucidStabilizationLabSession(last, NOW + 21);
    expect(() => pauseLucidStabilizationLabSession(completed, NOW + 22)).toThrow(
      'Only an active stabilization lab session can pause'
    );
    expect(() => interruptLucidStabilizationLabSession(completed, NOW + 22)).toThrow(
      'Stabilization lab session cannot be interrupted'
    );
    expect(() => resumeLucidStabilizationLabSession(idle(), NOW + 2)).toThrow(
      'Only a paused or interrupted stabilization lab session can resume'
    );
  });

  it('parses exact keys and rejects hostile ids, caps and prototype pollution', () => {
    const started = start();
    expect(isLucidStabilizationLabSession(started)).toBe(true);
    expect(parseLucidStabilizationLabSession(started)).toEqual(started);
    expect(parseLucidStabilizationLabSession({ ...started, extra: true })).toBeNull();
    expect(parseLucidStabilizationLabSession({ ...started, sessionId: '__proto__' })).toBeNull();
    expect(parseLucidStabilizationLabSession({ ...started, sessionId: ' constructor ' })).toBeNull();
    expect(
      parseLucidStabilizationLabSession({
        ...started,
        repeatCounts: { ...started.repeatCounts, hands: LUCID_STABILIZATION_LAB_MAX_REPEAT_COUNT + 1 },
      })
    ).toBeNull();
    expect(
      parseLucidStabilizationLabSession({
        ...idle(),
        repeatCounts: { ...idle().repeatCounts, hands: 1 },
      })
    ).toBeNull();
    expect(
      parseLucidStabilizationLabSession({
        ...started,
        repeatCounts: { ...started.repeatCounts, surface: 1 },
      })
    ).toBeNull();
    expect(
      parseLucidStabilizationLabSession({
        ...started,
        completedStepIds: ['hands'],
      })
    ).toBeNull();
    const last = finishLastStep(started, NOW + 2);
    expect(parseLucidStabilizationLabSession(last)?.completedStepIds).toEqual([
      ...LUCID_STABILIZATION_LAB_STEP_IDS,
    ]);
    const polluted = JSON.parse('{"version":1,"__proto__":{"admin":true}}');
    expect(parseLucidStabilizationLabSession(polluted)).toBeNull();
    expect(Object.prototype).not.toHaveProperty('admin');
    expect(parseLucidStabilizationLabSession('{"not":"an-object"}')).toBeNull();
    expect(parseLucidStabilizationLabSession(null)).toBeNull();
  });

  it('projects training insights without inventing dream or result fields', () => {
    let first = repeatLucidStabilizationLabStep(start('stab_one'), NOW + 2);
    first = finishLastStep(first, NOW + 3);
    first = completeLucidStabilizationLabSession(first, NOW + 10);
    const second = interruptLucidStabilizationLabSession(
      advanceLucidStabilizationLabSession(start('stab_two', NOW + 20), NOW + 21),
      NOW + 22
    );
    const insights = projectLucidStabilizationLabInsights([
      idle(),
      first,
      second,
      { dreamId: 'dream-1', result: 'lucid', premium: true },
    ]);
    expect(insights).toEqual({
      completionCount: 1,
      practiceCount: 2,
      repeatCount: 1,
      lastPracticedAt: second.updatedAt,
      recentCompletedAt: first.completedAt,
    });
    const serialized = JSON.stringify(insights);
    expect(serialized).not.toMatch(/dream|premium|result/i);
    expect(Object.keys(insights)).toEqual([
      'completionCount',
      'practiceCount',
      'repeatCount',
      'lastPracticedAt',
      'recentCompletedAt',
    ]);
    expect(LUCID_STABILIZATION_LAB_MAX_INSIGHT_SESSIONS).toBeGreaterThan(0);
  });
});
