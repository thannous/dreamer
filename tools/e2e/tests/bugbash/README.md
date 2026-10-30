# Bug bash repros

A pre-release bug bash (`npm run test:bugbash:prerelease`) explores Dreamer
web in mock mode. A confirmed bug is a test in this directory that fails on
the assertion that describes the expected behaviour, tagged `bugbash`.

`verify:pr` does not run these tests. `verify:release` runs
`npm run test:bugbash:repros` (`--tag bugbash`). After the fix, remove the
tag and keep the test with the other journeys. An empty repro directory means no
repros were selected; it does not prove an exploration or triage took place.

The launcher has eight charters, including a `fuzzer` input matrix, interrupted
draft recovery and conversation continuity. Each declares a synthetic session
prepared through exact UI steps. Run `npm run test:bugbash:prerelease -- --plan`
to inspect them, or `--charter saisies-limites` for one bounded pilot.
These sessions are guests: empty, with a seeded journal, or with an interrupted
draft. Mock account identity lives only in memory and cannot be restored by a
browser storage snapshot. Signed-in Plus discovery remains covered by the persona
journey that selects its profile in the same live browser context.

Each campaign keeps a unique `.e2e/bugbash/<id>/receipt.json`, source identity,
effective SDK/model, session, exit status and links to the original SDK evidence.
Exit 0 means the completed exploration reported no observations; 1 means triage
is required; 2 means incomplete execution (including missing evidence, failed
steps, a budget limit or changed sources). Findings remain unconfirmed.

Keep the raw receipt intact. Save `triage.json` beside it, keyed by each finding's
`id`, with `status` (`rejected`, `warning`, `confirmed`, `unresolved`), `reason`,
`reproTest`, `reproReport` and `reproResult`. Check the original trace and screen;
reject fixture/intended-behavior/environment issues with a concrete reason.
A confirmed bug needs a tagged repro that actually failed with `ASSERTION_FAILED`,
not a selector error or the explorer's own judgment. Keep unresolved observations
explicit; a campaign exit code alone never establishes release readiness.
