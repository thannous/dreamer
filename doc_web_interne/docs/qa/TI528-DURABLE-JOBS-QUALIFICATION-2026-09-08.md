# TI-528 — durable jobs and quota qualification

Source baseline: `d2bc` (worktree baseline; see delivery commit for final tree).
Runner: `TI528_LOCAL_STATUS=<private local status> npm run db:qualify:local`.
The wrapper rejects any API except `http://127.0.0.1:55321` and PostgreSQL except
`127.0.0.1:55322/postgres` before creating clients or connecting.
No production service, provider, mobile client secret, or schema change is involved.

## Observed on the disposable database

- The existing 55 structural contracts pass independently from behavioral tests.
- Journal, admission windows and durable jobs: four real suites / six tests pass.
- Seven parallel guest analysis claims and seven guest chat claims each admit exactly
  three operations; five replays of an admitted request report no new charge.
- Six concurrent image admissions with one request produce exactly one durable job;
  changing its payload returns `AI_IDEMPOTENCY_KEY_REUSED`.
- Requeueing a failed job preserves its two spent attempts and quota-claimed flag.
- Five conditional worker-style starts spend its last attempt exactly once. This
  executes the actual Data API compare-and-set predicate, not the worker itself.
- With one running image job and an actor ceiling of three, six distinct submissions
  admit two and reject four with `AI_ACTOR_CONCURRENCY_LIMIT`.
- Monthly authenticated analysis admission reads the real free-tier limit, races
  limit + 2 distinct dreams, admits exactly the limit and rejects two. Replaying one
  admitted job keeps the same job and does not add a quota event.
- A service-role request associating user B with user A's dream is refused.
- Anonymous and authenticated clients cannot admit jobs, claim guest quotas, read job
  results, or delete job rows. Even the job owner's direct Data API access is denied:
  the queue is service-owned, not a client-readable RLS surface.
- A service-role lease sweep expires one historical fixture, redacts its input,
  preserves attempt count, and returns zero on repetition. The fixture is uncommitted,
  the sweep uses a 1990 clock, and an assertion rejects pre-existing eligible rows.
  The entire lease transaction is rolled back, preserving all pre-existing jobs.
- User-editable `appId`/`app_id` metadata does not change account-owned Journal access;
  a second account still cannot read the first account's dream. This characterizes
  the current account boundary and **does not establish a trusted app boundary**.

Synthetic users and fingerprint rows are unique per run and cleaned explicitly.
Existing Journal qualification users A/B and their datasets are not deleted.
TypeScript test checking, focused lint and whitespace checking pass.

## Additional lease qualification

- Five simultaneous authenticated chat starts on the same request admit exactly
  one attempt. A synthetic stale timestamp allows attempt two; attempt one's late
  completion reports `CHAT_TURN_LEASE_LOST` and late failure cannot overwrite it.
- Four completions of attempt two produce exactly one stored model message and one
  user message. Replaying begin returns the completed result. Another account cannot
  begin or complete the owner's turn; anonymous admission is denied.
- Two concurrent service-role sweepers skip an explicitly locked guest image job
  and expire the other exactly once. Its image count moves from one to zero. After
  releasing the first row's lock, its claim is also refunded exactly once. Repeated
  sweeps return zero and never decrement counts below zero.
- Future-dated jobs prevent the scheduled cron from racing these fixtures. Before
  using the global sweep with a future clock, the test asserts that no unrelated
  active jobs exist. All inserted guest rows and jobs are removed by their unique IDs.

## Limits that must remain visible

These tests do not execute an AI worker or provider, prove exactly-once upstream
billing, or exercise all exhausted-attempt worker branches. The sweeper test proves
row locking and refunds with two controlled jobs; it is not a load or fairness test.
They do not qualify HTTP job polling/result authorization routes end to end, product
identity, OAuth client binding, revocation or cross-app import/deletion. TI-560 remains
a separate required architecture and security boundary.

The existing window suite tests global rate concurrency. This new job suite tests
actor backlog concurrency; it does not claim global durable backlog saturation proof.
No CI structural check alone closes these remaining behavioral scopes.
