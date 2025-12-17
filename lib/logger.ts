/**
 * Centralized logging utility
 *
 * - debug/warn: Only active in __DEV__ mode
 * - error: Always active for production error tracking
 *
 * Usage:
 * ```typescript
 * import { logger } from '@/lib/logger';
 *
 * logger.debug('[Module]', 'Debug message', { data });
 * logger.warn('[Module]', 'Warning message');
 * logger.error('[Module]', 'Error occurred', error);
 * ```
 */

type LogLevel = 'debug' | 'warn' | 'error';

interface Logger {
  debug: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  /** Log with explicit level */
  log: (level: LogLevel, ...args: unknown[]) => void;
}

const noop = () => {};

const isDev = (): boolean => {
  // In React Native bundles, __DEV__ is replaced at build time.
  // In tests, __DEV__ is typically set on globalThis.
  return typeof __DEV__ !== 'undefined' ? __DEV__ : Boolean((globalThis as any).__DEV__);
};

// debug/warn: only active in dev
// error: always logged for production debugging
export const logger: Logger = {
  debug: (...args: unknown[]) => {
    if (!isDev()) return;
    console.log(...args);
  },
  warn: (...args: unknown[]) => {
    if (!isDev()) return;
    console.warn(...args);
  },
  error: (...args: unknown[]) => console.error(...args),
  log: (level: LogLevel, ...args: unknown[]) => {
    switch (level) {
      case 'debug':
        logger.debug(...args);
        break;
      case 'warn':
        logger.warn(...args);
        break;
      case 'error':
        logger.error(...args);
        break;
    }
  },
};

/**
 * Create a scoped logger with a prefix
 *
 * Usage:
 * ```typescript
 * const log = createScopedLogger('[Recording]');
 * log.debug('Starting recording');
 * ```
 */
export function createScopedLogger(prefix: string): Logger {
  return {
    debug: (...args: unknown[]) => logger.debug(prefix, ...args),
    warn: (...args: unknown[]) => logger.warn(prefix, ...args),
    error: (...args: unknown[]) => logger.error(prefix, ...args),
    log: (level: LogLevel, ...args: unknown[]) => logger.log(level, prefix, ...args),
  };
}
