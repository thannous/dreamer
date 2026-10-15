# RevenueCat payment journey fixes

Owner: Codex, branch `codex/fix-payment-journeys`. Scope: the three priority
findings in the 2026-10-15 payment audit. Implementation, local checks and PR
delivery are authorized. Merge and publication are separate stages.

After a store-recognized purchase or restore, every paywall entry now waits for
active Plus access confirmed by the server before announcing success. A failed
convergence keeps an activation message and an explicit retry that refreshes
access without repeating the store operation. The pending heading does not
claim that Plus is already active; restoration is disabled during this recovery.

An empty restore now reports that no active subscription was found and keeps the
account free. The message is informational rather than a success. Both new
messages are translated into the six existing languages.

The startup decision now honors a pending paywall return after authentication
and onboarding have settled. It ranks below an explicit return to a requested
dream, and above the generic recording destination. This prevents an account
scope reload from overwriting the offer destination. Closing the offer still
clears the return intent and permits normal navigation.

## Local evidence

Browser: Chromium through TesterArmy `e2e` 0.21.0 and `@e2e-dev/web` 0.15.0,
Node 24.19.0, en-US, one worker, no model or replay. External service requests
are blocked by the existing fixture. Store receipts, accounts and backend
convergence are simulated; no real purchase or production account was used.

| Control | Result |
| --- | --- |
| Five focused regressions before the fixes | 5 failed: empty restore, purchase activation, restore activation, existing-account return, new-account return |
| Final local TesterArmy selection | 16 passed, no selected skips; final exit 0, source stable, no secondary errors |
| App and root test TypeScript | Passed |
| TesterArmy TypeScript | Passed |
| Focused existing paywall controls | 33 passed |
| Existing subscription hook and onboarding controls | 60 passed |
| Focused lint | No errors; existing hook/import warnings remain |

Canonical initial fix run (e2e 0.21.0):
`tools/e2e/.e2e/dreamer-web/1792098117771-34418-cfe7308c-2af0-4cbd-a498-5d45d74b4b0c/`.
Use its `report.json`, `qualification.json`, `end.json` and per-test `trace.md`.
The tests were executed on the stable working tree based on `577b76ef5`, before
the delivery commit; the final PR records its own committed-head verification.
Application files did not change after this run. The screenshots captured
during entrances are retained as diagnostic frames, not layout qualification;
critical outcomes are established by the exact assertions and report.

The final selection covers monthly and annual purchases; cancellation and error
recovery; restoration with and without a receipt; cancellation until expiry;
expiry without journal loss; account isolation; delayed purchase and restore
activation; return after sign-in for new and existing accounts; onboarding entry;
offer dismissal without journal loss; exhausted-quota dismissal; and sign-out.

The delayed-activation fixture fails the operation's convergence and automatic
refresh once each, then allows the explicit retry. The actual hook error path
runs. Counters assert one purchase or one restore in total after recovery. This
proves the UI and retry behavior with simulated dependencies, not store payment
or server persistence. Background refreshes do not consume this fixture.

The old empty-restore assertions accepted a success toast while checking that
the account remained free. They now require an informational empty result;
the expiry and cross-account counterexamples retain their quota assertions.
The existing paywall isolation fixture now returns realistic typed operation
results. No new isolation suite replaces the TesterArmy journeys.

The first committed-head verification found two failures in the existing QA lab
isolation fixture because its mocked module did not export the new diagnostics.
That mock was aligned with the module; both focused controls then passed. This
test-only follow-up does not change the application or the TesterArmy scenarios.

One intermediate run passed the payment cases but found an incorrect final test
expectation: clicking Today opens Home, not Capture. The test now verifies Home
and the absence of a reopened offer. The final 16-case run passed after that
test correction. An archived audit script was renamed to `.ts.txt` locally so
that the app compiler would not treat the historical reproduction as source.

Rerun locally from the repository root:

```sh
E2E_WEB_PORT=4518 mise exec -- node tools/e2e/run.mjs dreamer web run --grep 'mock.*purchase|mock receipt|cancelled renewal|restore activates|restore with no|mock restore|guest returns to the Plus offer|guest can start a first dream|free user can open the Plus offer and return|exhausted free account can keep a dream|Plus user signs out and returns'
```

The initial red run is retained at
`tools/e2e/.e2e/dreamer-web/1792097796250-31700-653561ab-7271-45a9-99b8-32b5bb19b2bb/`.
Audit results remain historical evidence; the fixes do not rewrite those results.

## PR review and e2e 0.21.1 follow-up, 2026-10-16

PR #371 was mergeable on `69389f7`, with no review threads or requested changes;
the automated code review reported no findings on that head. Its local PR proof
passed, and the fetched base remained `577b76ef5`.

The [official 0.21.1 release](https://github.com/tester-army/e2e/releases/tag/e2e%400.21.1)
fixes runner diagnostics, broken pipes and hosted-session deadlines, and adds the
programmatic runner API and optional keyboard observations. Only `e2e` changed:
web 0.15.0, mobile 0.12.1, agent-device 0.21.25 and Playwright 1.64.0 remain pinned.
Both engine peer ranges and Node 24.19.0 accept the new version. The package,
lockfile and qualification version pin now agree on 0.21.1.

The same rerun command above freshly passed all 16 selected scenarios on
`d27ecab7804cc099fa43c8dde5d3c4dda10a29b2` with e2e 0.21.1. Canonical output:
`tools/e2e/.e2e/dreamer-web/1792104012511-57560-bd5b1131-9a6c-4ad5-9d4b-cccdff610c4a/`.
Run `01a141b9-2181-71a7-90b6-e775c557b6d9` reports 16 executed/passed, zero
selected skips, failures, flaky tests or model tokens, and 16 trace pages.
The wrapper reports exit 0, stable source/output inputs and no secondary errors.
The checkout remains dirty with preserved personal settings and local artifacts;
this is not a clean-checkout claim. Collection, E2E TypeScript and all 31 runner
guard controls also passed. This report-only follow-up changes no executable input;
the final PR head records its own local `verify:pr` result before push and merge.

Native Release binaries, real Store transactions, RevenueCat dashboard transfer
settings and production backend convergence remain unqualified. The changes do
not modify SDK configuration, the backend, deployment gates or CI routing.
