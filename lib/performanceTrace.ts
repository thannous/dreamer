import { isPerformanceTracingEnabled } from '@/lib/env';
import { recordPerformanceEvent } from '@/lib/observe';

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
  const attributes: Record<string, number | boolean> = { elapsed_ms: now };
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
      attributes[key] = value;
    }
  }
  recordPerformanceEvent(name, attributes);
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

/** A frame opportunity after layout/reveal, not proof of viewport visibility or presented pixels. */
export function markPerformanceAfterFrames(
  name: string,
  details: PerformanceMarkDetails = {},
  delayMs = 0
): () => void {
  if (!isPerformanceTracingEnabled()) return () => {};
  let frame: number | undefined;
  const timer = setTimeout(() => {
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => markPerformance(name, details));
    });
  }, delayMs);
  return () => {
    clearTimeout(timer);
    if (frame !== undefined) cancelAnimationFrame(frame);
  };
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
