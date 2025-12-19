import { afterEach, describe, expect, it, vi } from 'vitest';

import { createScopedLogger, logger } from '../logger';

describe('logger', () => {
  const originalDev = (globalThis as any).__DEV__;

  afterEach(() => {
    (globalThis as any).__DEV__ = originalDev;
    vi.restoreAllMocks();
  });

  it('logs debug and warn when __DEV__ is true', () => {
    (globalThis as any).__DEV__ = true;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.debug('debug');
    logger.warn('warn');
    logger.error('error');
    logger.log('debug', 'debug-log');
    logger.log('warn', 'warn-log');
    logger.log('error', 'error-log');

    expect(logSpy).toHaveBeenCalledWith('debug');
    expect(warnSpy).toHaveBeenCalledWith('warn');
    expect(errorSpy).toHaveBeenCalledWith('error');
    expect(logSpy).toHaveBeenCalledWith('debug-log');
    expect(warnSpy).toHaveBeenCalledWith('warn-log');
    expect(errorSpy).toHaveBeenCalledWith('error-log');
  });

  it('suppresses debug and warn when __DEV__ is false', () => {
    (globalThis as any).__DEV__ = false;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.debug('debug');
    logger.warn('warn');
    logger.error('error');

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith('error');
  });

  it('creates a scoped logger that prefixes messages', () => {
    (globalThis as any).__DEV__ = true;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const scoped = createScopedLogger('[Test]');
    scoped.debug('hello');
    scoped.warn('warn');
    scoped.error('boom');
    scoped.log('debug', 'debug-log');

    expect(logSpy).toHaveBeenCalledWith('[Test]', 'hello');
    expect(warnSpy).toHaveBeenCalledWith('[Test]', 'warn');
    expect(errorSpy).toHaveBeenCalledWith('[Test]', 'boom');
    expect(logSpy).toHaveBeenCalledWith('[Test]', 'debug-log');
  });
});
