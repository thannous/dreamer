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

// Opaque process-local correlation only. Keys never reach logs or persisted state.
let traceSequence = 0;
const correlations = new Map<string, number>();
export function performanceTraceId(key?: string): number | undefined {
  if (!isPerformanceTracingEnabled()) return undefined;
  if (key && correlations.has(key)) return correlations.get(key);
  const id = ++traceSequence;
  if (key) {
    correlations.set(key, id);
    if (correlations.size > 128) correlations.delete(correlations.keys().next().value!);
  }
  return id;
}
