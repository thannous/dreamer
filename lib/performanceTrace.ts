import { isPerformanceTracingEnabled } from '@/lib/env';

type PerformanceMarkDetails = Record<
  string,
  boolean | number | string | null | undefined
>;

const PREFIX = '[NoctaliaPerf]';

export function markPerformance(
  name: string,
  details: PerformanceMarkDetails = {}
): void {
  if (!isPerformanceTracingEnabled()) return;

  const now = globalThis.performance?.now?.() ?? Date.now();
  try {
    globalThis.performance?.mark?.(`noctalia.${name}`);
  } catch {
    // The logcat marker below remains available on runtimes without User Timing.
  }

  const fields = Object.entries(details)
    .filter((entry): entry is [string, boolean | number | string | null] =>
      entry[1] !== undefined
    )
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');
  console.info(
    `${PREFIX} name=${name} elapsed_ms=${now.toFixed(1)}${fields ? ` ${fields}` : ''}`
  );
}
