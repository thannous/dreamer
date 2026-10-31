# User journeys with TesterArmy

All active E2E commands use TesterArmy: Dreamer, Lucid, Meditation, the marketing
site, the disposable local backend and the optional persistent test branch.
The former Playwright test runners and duplicated suites were retired on
2026-10-21. Public Playwright browser APIs and matchers remain available through
the TesterArmy web engine for geometry, clocks and exact assertions.

## Run the complete web campaign

```sh
mise exec -- npm ci
mise exec -- npm run test:testerarmy:setup
mise exec -- npm ci --prefix apps/meditation
mise exec -- npm run test:testerarmy:browsers
# Only when no saved ChatGPT login exists:
mise exec -- npm run test:testerarmy:login
mise exec -- npm run test:testerarmy:all
```

The complete command builds the site, runs Dreamer with English/French/German
and feature sheets enabled plus English with sheets disabled, verifies their
coverage union, runs Lucid, Meditation and the site, executes the four Dreamer
personas through the saved ChatGPT Pro login, and qualifies the real local backend.
Act defaults to `gpt-6.1-terra` and assert to `gpt-6.1-sol`
(`tools/e2e/persona-models.mjs`). `E2E_PERSONA_MODEL` overrides act.
There is no API-key or paid-gateway fallback.

Deterministic steps use exact locators without model calls. Persona goals use
`agent.act()` for one user outcome, followed by exact assertions. Their replay
cache and retries are off; qualification requires actual calls to the declared
model. Missing login, failed assertions, missing evidence or changing source fail
the campaign. Authentication stays outside Git.

One compact `tools/e2e/.e2e/full/<campaign>/report.json` references each immutable
child report, command and environment. A failed step keeps the full result red;
the runner continues independent steps so their evidence is still available.

## Focused commands

| Scope | Command | What it exercises |
| --- | --- | --- |
| Dreamer web | `test:e2e:web -- run` (alias of `test:testerarmy`) | Real UI, mocked auth/AI/billing, persistent local preferences and drafts. |
| Dreamer report | `test:e2e:web:report` | Integrity-checks and prints the latest completed TesterArmy report. |
| Lucid | `test:testerarmy:lucid -- run` | Onboarding, sleep safeguards, morning capture, signs/Atlas, exercises, recovery and local progress. |
| Meditation | `test:testerarmy:meditation -- run` | Onboarding, navigation, favourites, playback/resume/completion, history and streak after restart. |
| Marketing site | `test:testerarmy:site -- run` | Generated multilingual pages and interactions; run `docs:build` first. |
| Real local backend | `test:e2e:backend` | Owned disposable Supabase Auth/Postgres/PostgREST: durability, account isolation, offline recovery, server quotas, theme compatibility and Apple-token privacy. |
| Optional hosted test branch | `test:e2e:branch` | Saved free/premium sessions; production and unlisted targets fail before network access. |
| Native Release | `test:testerarmy:mobile -- <dreamer\|lucid\|meditation> <android\|ios> run` | One identified Release and one owned emulator/Simulator: automatically leased with Simlock when `E2E_DEVICE` is unset, or explicitly selected. |

Use `--grep` or `--tag` to select a focused journey, for example:

```sh
mise exec -- npm run test:e2e:web -- run --tag consent
E2E_WORKERS=1 mise exec -- npm run test:testerarmy:meditation -- run --tag persistence
```

The native device/build contract, pinned SDK versions and all individual commands
are in the [TesterArmy guide](../tools/e2e/README.md) and
[native matrix](../tools/e2e/NATIVE-MATRIX.md). Keep specialized security,
concurrency, backend and native isolation controls that cover failures a UI
journey cannot safely reproduce.

## Evidence boundaries

Mock UI passes prove the exercised interface and its local state transitions.
The owned backend separately proves real local persistence/Auth/RLS; it blocks
external AI, OAuth, analytics and billing. See the
[backend qualification](../doc_web_interne/docs/e2e-backend-qualification.md).
Backend traces are SDK Markdown steps, without HTTP token payload recording.

The persistent Supabase branch is optional and excluded from the complete command:
its committed allowlist is empty, so it remains refused until an owned test branch
exists. No account is created to bypass that guard. Native Release runs require
their own compiled candidate and device evidence and are not represented as web
passes. Real microphone/OS permissions, background audio, Store purchase/restore,
production services and deployment remain separate qualification boundaries.

Migration equivalences and current coverage are recorded in the
[work package](../doc_web_interne/docs/qa/full-testerarmy-20261021.md).
