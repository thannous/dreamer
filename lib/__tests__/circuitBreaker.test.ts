import { describe, expect, it } from 'vitest';

import { createCircuitBreaker } from '../circuitBreaker';

describe('createCircuitBreaker', () => {
  it('blocks after max attempts within the window', () => {
    const breaker = createCircuitBreaker({ maxAttempts: 3, windowMs: 10_000 });

    breaker.record(0);
    breaker.record(1);
    breaker.record(2);

    expect(breaker.shouldBlock(3)).toBe(true);
    expect(breaker.count(3)).toBe(3);
  });

  it('unblocks once attempts fall outside the window', () => {
    const breaker = createCircuitBreaker({ maxAttempts: 3, windowMs: 10 });

    breaker.record(0);
    breaker.record(1);
    breaker.record(2);
    expect(breaker.shouldBlock(3)).toBe(true);

    // All three fall outside the 10ms window when now=20
    expect(breaker.shouldBlock(20)).toBe(false);
    expect(breaker.count(20)).toBe(0);
  });

  it('reset clears attempts', () => {
    const breaker = createCircuitBreaker({ maxAttempts: 1, windowMs: 10_000 });
    breaker.record(0);
    expect(breaker.shouldBlock(1)).toBe(true);
    breaker.reset();
    expect(breaker.shouldBlock(1)).toBe(false);
  });
});

