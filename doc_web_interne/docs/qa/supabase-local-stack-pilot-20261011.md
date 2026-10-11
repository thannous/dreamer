# Supabase local stack pilot — 2026-10-11

Scope: disposable local Noctalia databases and the five existing backend browser
journeys. No hosted Supabase project, publication, AI provider or payment was used.

## Candidate and environment

- Final tested commit: `6c7b9f58cf1038312a81f47963c756e6e0b6fe24`, clean working tree,
  including master `1f6ede3c648273d2a08bda20b67e88bca42acb1a`.
- Supabase CLI: `2.120.0`, pinned in the root package and lockfile.
- Runtime: experimental native stack on macOS `27.0.1`, Apple silicon `arm64`.
- Native Postgres artifact: `17.11.0.004-r1`; 71 tracked migrations replayed.
- Real local Auth, PostgREST and database; synthetic accounts and dreams.
- Expo web: loopback port 8085; Playwright Chromium, one worker, zero retries.

## Results

Two temporary project directories ran simultaneously with distinct stack IDs,
API ports (20710 / 25357) and database ports (32102 / 30469). In both directions,
the owning instance contained its synthetic dream and account, while the other
contained neither. This proves data/port separation for this pilot. Native
processes still share host resources; Docker remains recommended for concurrent
worktrees by the [runtime guide](https://supabase.com/docs/guides/local-development/docker-and-native-runtimes).

A representative Free journey passed first. The initial complete suite passed
5/5 on `f73d47bb1aaaa304afe2ebe086526c3e7434afe7` in 50.4 seconds. After integrating
master's asset/Metro changes, a fresh complete suite passed **5/5** on the final
tested commit, with zero skipped, unexpected or flaky results, in 49.9 seconds
of Playwright execution:

1. UI save, server persistence, fresh-browser read, cross-client edit and deletion.
2. Second-account/anonymous denial, ownership-transfer denial and rejection of client-forged Plus metadata.
3. Server-owned Free quota and sign-out without journal leakage.
4. Server-provisioned Plus quota and sign-out without journal leakage; no purchase.
5. Offline save, exactly one synchronized remote row after reconnection and read after restart.

Focused lint, application/test typechecks and the three local-target/scheduler
safety controls passed. Those negative controls cover hosted targets and
unattended HTTP scheduling, which E2E cannot safely exercise against production.

## Local-only fixtures and cleanup

The runner copies migrations into its owned temporary directory. Two historical
HTTP URLs in those copies become an unavailable loopback endpoint. Four migration
files that create scheduled work disable it before their transaction commits;
the runner verifies zero active cron jobs before creating accounts. No tracked
SQL migration or production configuration was changed.

The browser allows only the local app, Auth and Data API, blocking Edge Functions,
AI, analytics, OAuth and billing. Privileged keys remain in private temporary
files and never enter the Expo public profile or tracked artifacts.

All five stacks created here (two isolation stacks, sample and two full suites) were
destroyed by exact identity. The owned CLI home then reported an empty stack list;
no listeners remained on the app or initial isolation ports. Service archives
remain cached for reuse.

## Evidence and rerun

Canonical private evidence lives under ignored `test-results/`:

- `supabase-local-pilot/backend-results.json`: immutable final report with source, effective versions, fixture adjustments and per-test assertions.
- `e2e-backend-report/` and `e2e-backend/`: HTML report and UI videos; Auth traces disabled.
- `supabase-local-pilot/isolation.json`: bidirectional separation assertions and stack identities.
- `supabase-local-pilot/receipt.json`: compact receipt, report digest, cleanup and rerun command.
- `supabase-local-pilot/backend-final.log`: final full-suite run and cleanup diagnostics.
- `supabase-local-pilot/backend.log`: retained initial full-suite result.

```sh
mise exec -- npm run test:e2e:backend -- --runtime native
mise exec -- node --test scripts/lib/backend-e2e-local.test.cjs
```

The original Docker path was not freshly replayed because no daemon was running.
It remains the default and release verification is unchanged. This pilot does
not qualify mobile native storage, production behavior, AI jobs, scheduled
reconciliation, real purchases or Docker/native performance parity. Native is
opt-in; no global experimental Supabase setting was enabled.
