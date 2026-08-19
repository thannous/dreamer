import { SESSION_BY_ID } from '@/content/sessions';
import {
  canPlaySession,
  canUseBreathingPattern,
  canUseFadeTimer,
  FREE_PLAYS_PER_MONTH,
  playsThisMonth,
  remainingFreePlays,
} from '@/lib/entitlements';
import type { PracticeEntry } from '@/lib/types';

const free = SESSION_BY_ID['sleep-descent'];
const premium = SESSION_BY_ID['dream-threshold'];

const entry = (dateISO: string, sessionId?: string): PracticeEntry => ({
  dateISO,
  sessionId,
  seconds: 600,
});

describe('playsThisMonth', () => {
  it('counts only this calendar month', () => {
    const log = [
      entry('2026-08-01', 'sleep-descent'),
      entry('2026-08-19', 'sleep-descent'),
      entry('2026-07-31', 'sleep-descent'),
    ];
    expect(playsThisMonth(log, '2026-08-19')).toBe(2);
  });

  it('ignores breathing exercises', () => {
    // A breathing exercise must never eat into the listening quota.
    const log = [entry('2026-08-19'), entry('2026-08-19', 'sleep-descent')];
    expect(playsThisMonth(log, '2026-08-19')).toBe(1);
  });

  it('resets at the turn of the month', () => {
    const log = [entry('2026-07-15', 'sleep-descent'), entry('2026-07-16', 'sleep-descent')];
    expect(playsThisMonth(log, '2026-08-01')).toBe(0);
  });
});

describe('canPlaySession', () => {
  it('lets Plus play anything, however much was already played', () => {
    expect(canPlaySession(premium, 'plus', 999)).toEqual({ allowed: true });
  });

  it('blocks a premium session for a free listener', () => {
    expect(canPlaySession(premium, 'free', 0)).toEqual({
      allowed: false,
      reason: 'premium-session',
    });
  });

  it('allows a free session under the monthly quota', () => {
    expect(canPlaySession(free, 'free', FREE_PLAYS_PER_MONTH - 1)).toEqual({ allowed: true });
  });

  it('blocks once the monthly quota is spent', () => {
    expect(canPlaySession(free, 'free', FREE_PLAYS_PER_MONTH)).toEqual({
      allowed: false,
      reason: 'monthly-quota',
    });
  });

  it('reports the premium reason before the quota one', () => {
    // Telling someone their quota is spent, when the session was never free,
    // would send them back next month to hit the same wall.
    expect(canPlaySession(premium, 'free', FREE_PLAYS_PER_MONTH)).toEqual({
      allowed: false,
      reason: 'premium-session',
    });
  });
});

describe('canUseBreathingPattern', () => {
  it('keeps the coherent rhythm free', () => {
    // It is the rhythm the whole interface breathes at; charging for it would
    // be indefensible.
    expect(canUseBreathingPattern('coherent', 'free')).toEqual({ allowed: true });
  });

  it('keeps the two entry patterns free', () => {
    expect(canUseBreathingPattern('calm', 'free')).toEqual({ allowed: true });
    expect(canUseBreathingPattern('box', 'free')).toEqual({ allowed: true });
  });

  it('asks for Plus on 4-7-8', () => {
    expect(canUseBreathingPattern('four-seven-eight', 'free')).toEqual({
      allowed: false,
      reason: 'premium-pattern',
    });
  });

  it('opens everything for Plus', () => {
    expect(canUseBreathingPattern('four-seven-eight', 'plus')).toEqual({ allowed: true });
  });
});

describe('canUseFadeTimer', () => {
  it('allows no timer at all', () => {
    expect(canUseFadeTimer(null, 'free')).toEqual({ allowed: true });
  });

  it('allows the short timers', () => {
    expect(canUseFadeTimer(15, 'free')).toEqual({ allowed: true });
  });

  it('asks for Plus beyond fifteen minutes', () => {
    expect(canUseFadeTimer(30, 'free')).toEqual({ allowed: false, reason: 'premium-timer' });
  });
});

describe('remainingFreePlays', () => {
  it('counts down and stops at zero', () => {
    expect(remainingFreePlays('free', 0)).toBe(FREE_PLAYS_PER_MONTH);
    expect(remainingFreePlays('free', FREE_PLAYS_PER_MONTH + 5)).toBe(0);
  });

  it('is unbounded for Plus', () => {
    expect(remainingFreePlays('plus', 100)).toBe(Number.POSITIVE_INFINITY);
  });
});
