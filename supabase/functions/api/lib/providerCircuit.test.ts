import { deepStrictEqual as equal, rejects, throws } from 'node:assert';
import { ProviderCircuit, ProviderCircuitOpenError } from './providerCircuit.ts';

Deno.test('availability breaker trips on consecutive failures in a short window and fast-fails without a call', async () => {
  let now = 0;
  const circuit = new ProviderCircuit({ failureThreshold: 3, failureWindowMs: 1000, cooldownMs: 500 }, () => now);
  let calls = 0;
  const fail = () => { calls++; return Promise.reject(new Error('unavailable')); };
  const transient = () => true;
  await rejects(circuit.run(fail, transient));
  await circuit.run(() => Promise.resolve('ok'), transient); // resets consecutiveness
  await rejects(circuit.run(fail, transient));
  now = 1001; // previous failure leaves the window
  await rejects(circuit.run(fail, transient));
  await rejects(circuit.run(fail, transient));
  await rejects(circuit.run(fail, transient));
  equal(calls, 5);
  await rejects(circuit.run(fail, transient), ProviderCircuitOpenError);
  equal(calls, 5);
  now += 500;
  const probe = circuit.enter();
  throws(() => circuit.enter(), ProviderCircuitOpenError); // single probe
  probe.success();
  await circuit.run(() => Promise.resolve('ok'), transient);
});

Deno.test('failed probes restart cooldown, stale successes cannot close it, and cancelled probes release their slot', () => {
  let now = 0;
  const circuit = new ProviderCircuit({ failureThreshold: 1, failureWindowMs: 1000, cooldownMs: 500 }, () => now);
  const stale = circuit.enter();
  circuit.enter().failure(true);
  stale.success();
  throws(() => circuit.enter(), ProviderCircuitOpenError);
  now = 500;
  circuit.enter().failure(true);
  now = 999;
  throws(() => circuit.enter(), ProviderCircuitOpenError);
  now = 1000;
  circuit.enter().cancel();
  circuit.enter().success();
  circuit.enter().success();
});

Deno.test('responses unrelated to availability do not trip the breaker', async () => {
  const circuit = new ProviderCircuit({ failureThreshold: 1, failureWindowMs: 1000, cooldownMs: 500 });
  for (let i = 0; i < 5; i++) await rejects(circuit.run(() => Promise.reject(new Error('invalid output')), () => false));
  equal(await circuit.run(() => Promise.resolve('healthy'), () => true), 'healthy');
});

Deno.test('concurrent requests failing after an ordinary success still count consecutively', () => {
  const circuit = new ProviderCircuit({ failureThreshold: 5, failureWindowMs: 30000, cooldownMs: 10000 });
  const inFlight = Array.from({ length: 6 }, () => circuit.enter());
  inFlight[0].success();
  for (const permit of inFlight.slice(1)) permit.failure(true);
  throws(() => circuit.enter(), ProviderCircuitOpenError);
});

Deno.test('an in-flight probe advertises its remaining timeout capped at thirty seconds', () => {
  let now = 0;
  const circuit = new ProviderCircuit({ failureThreshold: 1, failureWindowMs: 30000, cooldownMs: 10000 }, () => now);
  circuit.enter().failure(true);
  now = 10000;
  const probe = circuit.enter(35000);
  throws(() => circuit.enter(), (error: unknown) => error instanceof ProviderCircuitOpenError && error.retryAfterSeconds === 30);
  now += 30000;
  throws(() => circuit.enter(), (error: unknown) => error instanceof ProviderCircuitOpenError && error.retryAfterSeconds === 5);
  probe.success();
  circuit.enter().success();
});
