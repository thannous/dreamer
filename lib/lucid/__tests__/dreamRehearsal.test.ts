import type { LucidActiveDreamSign } from '@/lib/lucid/dreamSigns';
import {
  LUCID_DREAM_REHEARSAL_ACTION_IDS,
  LUCID_DREAM_REHEARSAL_HAPTIC_CUE_ID,
  LUCID_DREAM_REHEARSAL_MAX_EXCERPT_CHARS,
  LUCID_DREAM_REHEARSAL_SOUND_CUE_ID,
  LUCID_DREAM_REHEARSAL_TEXT_ALTERNATIVE_IDS,
  completeLucidDreamRehearsalSession,
  confirmLucidDreamRehearsalIntention,
  createLucidDreamRehearsalSession,
  createLucidDreamRehearsalSessionId,
  getLucidDreamRehearsalCausalFeedback,
  getLucidDreamRehearsalCurrentAction,
  getLucidDreamRehearsalProgress,
  getLucidDreamRehearsalRedundantCues,
  getLucidDreamRehearsalTextAlternativeIds,
  interruptLucidDreamRehearsalSession,
  parseLucidDreamRehearsalCompletion,
  parseLucidDreamRehearsalSession,
  projectLucidDreamRehearsalCompletion,
  recognizeLucidDreamRehearsalSign,
  resumeLucidDreamRehearsalSession,
  selectLucidDreamRehearsalScene,
  type LucidDreamRehearsalScene,
  type LucidDreamRehearsalSession,
  type LucidDreamRehearsalSourceProgram,
} from '@/lib/lucid/dreamRehearsal';

const NOW = 1_700_000_000_000;
const DREAM_ID = '1700000000000';
const OTHER_DREAM_ID = '1700000001000';
const SIGN_ID = 'sign:mirror';
const OTHER_SIGN_ID = 'sign:stairs';

const dreams = [
  {
    id: Number(DREAM_ID),
    title: '  The hallway  mirror  ',
    transcript: 'I looked into a hallway   mirror   and the room stretched.',
  },
  {
    id: Number(OTHER_DREAM_ID),
    title: 'Stairs',
    transcript: 'The stairs kept going.',
  },
] as const;

const confirmedSigns: readonly LucidActiveDreamSign[] = [
  {
    id: SIGN_ID,
    label: '  Hallway  mirror  ',
    category: 'object',
    distinctDreamCount: 2,
    sourceDreamIds: [DREAM_ID, '1699999999999'],
  },
  {
    id: OTHER_SIGN_ID,
    label: 'Infinite stairs',
    category: 'anomaly',
    distinctDreamCount: 2,
    sourceDreamIds: [OTHER_DREAM_ID],
  },
];

function readyScene(): LucidDreamRehearsalScene {
  const result = selectLucidDreamRehearsalScene(dreams, confirmedSigns, DREAM_ID, SIGN_ID);
  if (result.status !== 'ready') throw new Error('Expected a ready scene');
  return result.scene;
}

function start(
  presentation: 'motion' | 'static' = 'motion',
  sourceProgram: LucidDreamRehearsalSourceProgram = { kind: 'technique', technique: 'mild' },
  now = NOW,
  sessionId = 'rehearse_session_01'
): LucidDreamRehearsalSession {
  return createLucidDreamRehearsalSession({
    scene: readyScene(),
    sessionId,
    sourceProgram,
    presentation,
    now,
  });
}

function recognizeThenIntend(
  presentation: 'motion' | 'static' = 'motion'
): LucidDreamRehearsalSession {
  const recognized = recognizeLucidDreamRehearsalSign(start(presentation), SIGN_ID, NOW + 1);
  return confirmLucidDreamRehearsalIntention(recognized, NOW + 2);
}

describe('Lucid dream rehearsal selection', () => {
  it('accepts the exact chosen dream and confirmed linked sign', () => {
    const result = selectLucidDreamRehearsalScene(dreams, confirmedSigns, DREAM_ID, SIGN_ID);
    expect(result).toEqual({
      status: 'ready',
      scene: {
        dreamId: DREAM_ID,
        title: 'The hallway mirror',
        excerpt: 'I looked into a hallway mirror and the room stretched.',
        excerptTruncated: false,
        signId: SIGN_ID,
        signLabel: 'Hallway mirror',
        category: 'object',
      },
    });
  });

  it('rejects a missing dream, a missing sign, and a sign linked to another dream', () => {
    expect(
      selectLucidDreamRehearsalScene(dreams, confirmedSigns, '1700000009999', SIGN_ID)
    ).toEqual({ status: 'rejected', reason: 'dream_not_found' });
    expect(
      selectLucidDreamRehearsalScene(dreams, confirmedSigns, DREAM_ID, 'sign:absent')
    ).toEqual({ status: 'rejected', reason: 'sign_not_found' });
    expect(
      selectLucidDreamRehearsalScene(dreams, confirmedSigns, DREAM_ID, OTHER_SIGN_ID)
    ).toEqual({ status: 'rejected', reason: 'sign_not_linked' });
  });

  it('clips transcript whitespace deterministically and flags truncation without inventing copy', () => {
    const longTranscript = `Mirror  ${'x'.repeat(LUCID_DREAM_REHEARSAL_MAX_EXCERPT_CHARS)}`;
    const result = selectLucidDreamRehearsalScene(
      [{ id: Number(DREAM_ID), title: '  Mirror  ', transcript: longTranscript }],
      confirmedSigns,
      DREAM_ID,
      SIGN_ID
    );
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Expected a ready scene');
    expect(result.scene.title).toBe('Mirror');
    expect(result.scene.excerpt.length).toBeLessThanOrEqual(LUCID_DREAM_REHEARSAL_MAX_EXCERPT_CHARS);
    expect(result.scene.excerptTruncated).toBe(true);
    expect(result.scene.excerpt.startsWith('Mirror x')).toBe(true);
    expect(result.scene.excerpt).not.toMatch(/because|felt|remembered|suddenly/i);
  });

  it('keeps an empty valid scene instead of inventing title or excerpt', () => {
    const result = selectLucidDreamRehearsalScene(
      [{ id: Number(DREAM_ID), title: '   ', transcript: '' }],
      confirmedSigns,
      DREAM_ID,
      SIGN_ID
    );
    expect(result).toEqual({
      status: 'ready',
      scene: {
        dreamId: DREAM_ID,
        title: '',
        excerpt: '',
        excerptTruncated: false,
        signId: SIGN_ID,
        signLabel: 'Hallway mirror',
        category: 'object',
      },
    });
  });
});

describe('Lucid dream rehearsal session', () => {
  it('creates a safe session id and starts on recognize_sign', () => {
    expect(createLucidDreamRehearsalSessionId(NOW, 'abc 123')).toBe(
      `rehearse_${NOW.toString(36)}_abc123`
    );
    expect(() => createLucidDreamRehearsalSessionId(-1, 'abc')).toThrow(
      'Invalid dream rehearsal timestamp'
    );
    expect(() =>
      createLucidDreamRehearsalSession({
        scene: readyScene(),
        sessionId: '__proto__',
        sourceProgram: { kind: 'atlas' },
        presentation: 'static',
        now: NOW,
      })
    ).toThrow('Invalid dream rehearsal session id');
    const session = start();
    expect(session).toMatchObject({
      version: 1,
      status: 'active',
      step: 'recognize_sign',
      dreamId: DREAM_ID,
      signId: SIGN_ID,
      recognizedAt: null,
      intentionConfirmedAt: null,
      completedAt: null,
    });
    expect(getLucidDreamRehearsalCurrentAction(session)).toBe('recognize_sign');
    expect(LUCID_DREAM_REHEARSAL_ACTION_IDS).toEqual([
      'recognize_sign',
      'set_lucid_intention',
    ]);
  });

  it('requires recognize then intention before completion and stays idempotent', () => {
    const session = start();
    expect(() => confirmLucidDreamRehearsalIntention(session, NOW + 1)).toThrow(
      'Dream rehearsal sign must be recognized before intention'
    );
    expect(() => completeLucidDreamRehearsalSession(session, NOW + 1)).toThrow(
      'Dream rehearsal cannot complete before both actions'
    );
    expect(() =>
      recognizeLucidDreamRehearsalSign(session, OTHER_SIGN_ID, NOW + 1)
    ).toThrow('Recognition must target the chosen sign');

    const recognized = recognizeLucidDreamRehearsalSign(session, SIGN_ID, NOW + 1);
    expect(recognized).toMatchObject({
      step: 'set_lucid_intention',
      recognizedAt: NOW + 1,
    });
    expect(recognizeLucidDreamRehearsalSign(recognized, SIGN_ID, NOW + 2)).toEqual(recognized);
    expect(() => completeLucidDreamRehearsalSession(recognized, NOW + 2)).toThrow(
      'Dream rehearsal cannot complete before both actions'
    );

    const intended = confirmLucidDreamRehearsalIntention(recognized, NOW + 2);
    expect(intended.intentionConfirmedAt).toBe(NOW + 2);
    expect(confirmLucidDreamRehearsalIntention(intended, NOW + 3)).toEqual(intended);
    const completed = completeLucidDreamRehearsalSession(intended, NOW + 3);
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).toBe(NOW + 3);
    expect(completeLucidDreamRehearsalSession(completed, NOW + 4)).toEqual(completed);
  });

  it('keeps sound and haptic cues redundant and static equivalent to motion', () => {
    const motion = start('motion');
    const staticSession = start('static', { kind: 'atlas' }, NOW, 'rehearse_session_st');
    expect(staticSession.presentation).toBe('static');
    expect(staticSession.sourceProgram).toEqual({ kind: 'atlas' });
    expect(getLucidDreamRehearsalCurrentAction(staticSession)).toBe(
      getLucidDreamRehearsalCurrentAction(motion)
    );
    expect(getLucidDreamRehearsalProgress(staticSession)).toEqual(
      getLucidDreamRehearsalProgress(motion)
    );
    expect(getLucidDreamRehearsalRedundantCues(motion)).toEqual({
      soundCueId: null,
      hapticCueId: null,
    });
    expect(getLucidDreamRehearsalRedundantCues(staticSession)).toEqual({
      soundCueId: null,
      hapticCueId: null,
    });
    expect(getLucidDreamRehearsalProgress(motion)).toEqual({
      currentAction: 'recognize_sign',
      completedActionCount: 0,
      totalActionCount: 2,
      recognized: false,
      intentionConfirmed: false,
      canComplete: false,
    });

    const motionDone = recognizeThenIntend('motion');
    const staticDone = recognizeThenIntend('static');
    expect(motionDone.step).toBe(staticDone.step);
    expect(getLucidDreamRehearsalProgress(motionDone)).toEqual(
      getLucidDreamRehearsalProgress(staticDone)
    );
    expect(getLucidDreamRehearsalCurrentAction(motionDone)).toBe(
      getLucidDreamRehearsalCurrentAction(staticDone)
    );
    expect(getLucidDreamRehearsalRedundantCues(motionDone)).toEqual({
      soundCueId: LUCID_DREAM_REHEARSAL_SOUND_CUE_ID,
      hapticCueId: LUCID_DREAM_REHEARSAL_HAPTIC_CUE_ID,
    });
    expect(getLucidDreamRehearsalTextAlternativeIds()).toEqual(
      LUCID_DREAM_REHEARSAL_TEXT_ALTERNATIVE_IDS
    );
    expect(getLucidDreamRehearsalCausalFeedback(motionDone)).toEqual([
      'lucid_dream_rehearsal_sign_recognized',
      'lucid_dream_rehearsal_intention_confirmed',
      'lucid_dream_rehearsal_ready_to_complete',
    ]);
  });

  it('interrupts and resumes without losing recognized state, with monotone timestamps', () => {
    const recognized = recognizeLucidDreamRehearsalSign(start(), SIGN_ID, NOW + 1);
    const interrupted = interruptLucidDreamRehearsalSession(recognized, NOW + 2);
    expect(interrupted).toMatchObject({
      status: 'interrupted',
      step: 'set_lucid_intention',
      recognizedAt: NOW + 1,
      intentionConfirmedAt: null,
    });
    expect(interruptLucidDreamRehearsalSession(interrupted, NOW + 3)).toEqual(interrupted);
    expect(() => confirmLucidDreamRehearsalIntention(interrupted, NOW + 4)).toThrow(
      'Only an active dream rehearsal can confirm intention'
    );
    expect(() => recognizeLucidDreamRehearsalSign(interrupted, SIGN_ID, NOW + 4)).toThrow(
      'Only an active dream rehearsal can recognize a sign'
    );
    const resumed = resumeLucidDreamRehearsalSession(interrupted, NOW + 4);
    expect(resumed).toMatchObject({
      status: 'active',
      recognizedAt: NOW + 1,
      step: 'set_lucid_intention',
      updatedAt: NOW + 4,
    });
    expect(resumeLucidDreamRehearsalSession(resumed, NOW + 5)).toEqual(resumed);
    expect(() => interruptLucidDreamRehearsalSession(resumed, NOW)).toThrow(
      'Dream rehearsal timestamp cannot regress'
    );
    const completed = completeLucidDreamRehearsalSession(
      confirmLucidDreamRehearsalIntention(resumed, NOW + 5),
      NOW + 6
    );
    expect(completed.startedAt).toBeLessThan(completed.recognizedAt!);
    expect(completed.recognizedAt!).toBeLessThan(completed.intentionConfirmedAt!);
    expect(completed.intentionConfirmedAt!).toBeLessThan(completed.completedAt!);
    expect(() => resumeLucidDreamRehearsalSession(completed, NOW + 7)).toThrow(
      'A completed dream rehearsal cannot resume'
    );
  });

  it('projects a minimal completion without transcript, label or free intention', () => {
    const completed = completeLucidDreamRehearsalSession(recognizeThenIntend(), NOW + 3);
    const record = projectLucidDreamRehearsalCompletion(completed);
    expect(record).toEqual({
      version: 1,
      sessionId: completed.sessionId,
      dreamId: DREAM_ID,
      signId: SIGN_ID,
      sourceProgram: { kind: 'technique', technique: 'mild' },
      completedAt: completed.completedAt,
    });
    expect(Object.keys(record!)).toEqual([
      'version',
      'sessionId',
      'dreamId',
      'signId',
      'sourceProgram',
      'completedAt',
    ]);
    expect(JSON.stringify(record)).not.toMatch(/transcript|excerpt|label|intention|premium/i);
    expect(parseLucidDreamRehearsalCompletion(record)).toEqual(record);
    expect(parseLucidDreamRehearsalCompletion({ ...record, extra: true })).toBeNull();
    expect(projectLucidDreamRehearsalCompletion(start())).toBeNull();
  });

  it('parses exact keys and rejects hostile ids, prototype pollution and incoherent timestamps', () => {
    const session = start();
    expect(parseLucidDreamRehearsalSession(session)).toEqual(session);
    expect(parseLucidDreamRehearsalSession({ ...session, extra: true })).toBeNull();
    expect(parseLucidDreamRehearsalSession({ ...session, sessionId: '__proto__' })).toBeNull();
    expect(parseLucidDreamRehearsalSession({ ...session, sessionId: 'constructor' })).toBeNull();
    expect(parseLucidDreamRehearsalSession({ ...session, dreamId: 'prototype' })).toBeNull();
    expect(parseLucidDreamRehearsalSession({ ...session, signId: 'mirror' })).toBeNull();
    expect(parseLucidDreamRehearsalSession({ ...session, status: 'paused' })).toBeNull();
    expect(parseLucidDreamRehearsalSession({ ...session, startedAt: Number.NaN })).toBeNull();
    expect(parseLucidDreamRehearsalSession({ ...session, updatedAt: Number.POSITIVE_INFINITY })).toBeNull();
    expect(
      parseLucidDreamRehearsalSession({
        ...session,
        status: 'completed',
        completedAt: null,
      })
    ).toBeNull();
    expect(
      parseLucidDreamRehearsalSession({
        ...session,
        step: 'set_lucid_intention',
      })
    ).toBeNull();
    expect(
      parseLucidDreamRehearsalSession({
        ...session,
        recognizedAt: NOW + 10,
      })
    ).toBeNull();
    const polluted = JSON.parse('{"version":1,"__proto__":{"admin":true}}');
    expect(parseLucidDreamRehearsalSession(polluted)).toBeNull();
    expect(Object.prototype).not.toHaveProperty('admin');
    expect(parseLucidDreamRehearsalSession(null)).toBeNull();
    expect(parseLucidDreamRehearsalCompletion({
      version: 1,
      sessionId: 'rehearse_session_01',
      dreamId: DREAM_ID,
      signId: SIGN_ID,
      sourceProgram: { kind: 'atlas', extra: true },
      completedAt: NOW,
    })).toBeNull();
  });

  it('never mentions premium or invents dream content', () => {
    const source = [
      start,
      recognizeThenIntend,
      getLucidDreamRehearsalTextAlternativeIds,
      getLucidDreamRehearsalCausalFeedback,
    ]
      .map((value) => String(value))
      .join('\n');
    expect(source).not.toMatch(/premium|plus|paywall/i);
    const empty = selectLucidDreamRehearsalScene(
      [{ id: Number(DREAM_ID), title: '', transcript: '' }],
      confirmedSigns,
      DREAM_ID,
      SIGN_ID
    );
    expect(empty.status).toBe('ready');
    if (empty.status !== 'ready') throw new Error('Expected a ready scene');
    expect(empty.scene.title).toBe('');
    expect(empty.scene.excerpt).toBe('');
  });
});
