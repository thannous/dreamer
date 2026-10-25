import { CLAUDE_MODELS, TEXT_PROVIDER_CIRCUIT } from './models.ts';

/** Same refundable/retryable provider code as an ordinary availability failure. */
export class ProviderCircuitOpenError extends Error {
  readonly code = 'ANALYSIS_PROVIDER_UNAVAILABLE';
  readonly status = 503;
  constructor(readonly retryAfterSeconds: number) {
    super('Text AI unavailable, please retry');
  }
}

type CircuitOptions = { failureThreshold: number; failureWindowMs: number; cooldownMs: number };

/** Isolate-local, content-free health state; stale in-flight requests cannot close a newer trip. */
export class ProviderCircuit {
  private failures = 0;
  private windowStart: number | null = null;
  private openUntil: number | null = null;
  private probeInFlight = false;
  private probeDeadline = 0;
  private epoch = 0;

  constructor(private options: CircuitOptions = TEXT_PROVIDER_CIRCUIT, private now = Date.now) {}

  reset(): void {
    this.failures = 0;
    this.windowStart = null;
    this.openUntil = null;
    this.probeInFlight = false;
    this.probeDeadline = 0;
    this.epoch++;
  }

  enter(timeoutMs: number = CLAUDE_MODELS.analysis.timeoutMs) {
    const time = this.now();
    const probe = this.openUntil !== null;
    if (probe && (time < this.openUntil! || this.probeInFlight)) {
      const retryAt = this.probeInFlight ? this.probeDeadline : this.openUntil!;
      throw new ProviderCircuitOpenError(Math.min(30, Math.max(1, Math.ceil((retryAt - time) / 1000))));
    }
    if (probe) {
      this.probeInFlight = true;
      this.probeDeadline = time + timeoutMs;
    }
    const epoch = this.epoch;
    let settled = false;
    const settle = (availabilityFailure: boolean) => {
      if (settled) return;
      settled = true;
      if (epoch !== this.epoch) return;
      if (!availabilityFailure) {
        if (probe) this.reset();
        else { this.failures = 0; this.windowStart = null; }
        return;
      }
      const time = this.now();
      if (this.windowStart === null || time - this.windowStart > this.options.failureWindowMs) {
        this.windowStart = time;
        this.failures = 0;
      }
      this.failures++;
      if (probe || this.failures >= this.options.failureThreshold) {
        this.openUntil = time + this.options.cooldownMs;
        this.probeInFlight = false;
        this.epoch++;
      }
    };
    return {
      success: () => settle(false),
      failure: (availabilityFailure: boolean) => settle(availabilityFailure),
      cancel: () => {
        if (settled) return;
        settled = true;
        if (epoch === this.epoch && probe) this.probeInFlight = false;
      },
    };
  }

  async run<T>(request: () => PromiseLike<T>, isAvailabilityFailure: (error: unknown) => boolean, timeoutMs: number = CLAUDE_MODELS.analysis.timeoutMs): Promise<T> {
    const permit = this.enter(timeoutMs);
    try {
      const result = await request();
      permit.success();
      return result;
    } catch (error) {
      permit.failure(isAvailabilityFailure(error));
      throw error;
    }
  }
}
