# Warning remediation — 2026-10-19

## Scope and candidate

The owner authorized implementation of the prioritized warning follow-up:
quotas/expiry, chat lifecycle, render-time refs, effects, then import/style debt
and compatible dependency fixes. The existing PR #443 branch
`codex/repository-hygiene` continues from `1f508d7f8c6b44123b2c94de270f4126eb45a1d8`,
based on `origin/master` at `967fe81f0a6012d5142483ae3ff17e19eba7133f`.
The runtime/test corrections are commit `60688221a`; compatible lock changes are
`f7ba01ef8`. This documentation follows them. The existing engine records the
final committed-head proof separately, avoiding a self-referential evidence SHA.

The isolated audit checkout was clean before this follow-up. All 13 original
primary-checkout WIP files still match their preservation receipt. Personal
settings, credentials, original assets and personal-device data were not changed.
This work includes no merge, production, Store, EAS or real purchase operation.

## Confirmed defects and retained contracts

| Defect reproduced before correction | Result and meaningful counterexample |
| --- | --- |
| A cached RevenueCat object kept Plus beyond expiry + 24h because time was read only while memoizing that object. | Subscribe to this entitlement's clock boundary and app resume. Keep the strict `now > expiry + 24h` rule, `willRenew === false`, optimistic paid metadata and the existing subscription authority. Same-object expiry, app resume, renewal and replacement/cleanup cases are covered. |
| A delayed free-quota response could overwrite current paid access. | Attach async results to their request identity/generation and derive unlimited paid status; an old response cannot replace current entitlement or another owner's quota. |
| Changing the committed expiry callback could remove its timer while refresh identity stayed unchanged. | Update the callback after commit and retain the timer registration when callback presence stays the same. Existing expiry + 1min and five-minute retry behavior remain. |
| The chat reserved a category as sent when scheduling its 500ms timer. Cleanup cancelled the timer but retained the reservation, losing the question after hydration/quota changes. | Reserve only when dispatch starts, use current payload/callback dependencies and preserve cancellation, scope/category isolation and the send lock. Three controlled scheduling cases failed before the correction and pass after it; duplicate dispatch remains refused. |
| Replacing a streaming reply channel left the previous channel's fragment visible until the new one emitted. | Read the existing channel with `useSyncExternalStore`; replacement, late emissions and empty channels retain current-conversation state. Message arrivals retain handwriting/scroll behavior without rerendering the screen for every fragment. |
| A cleared provider purchase error remained visible in the paywall's copied local state. | Derive its visibility from the provider error, retaining its clear/retry/activation contract. The error-to-null transition passes without a dismiss click. |
| An interrupted React render could expose a speculative subscription callback. | Listener wrappers belong to committed effects, with exact cleanup and shared SDK registration until the last subscriber leaves. Suspension and duplicate-subscriber cases protect that boundary. |

The expiry timer already existed; this work does not claim otherwise. The
expiry bug concerns the additional 24h allowance with a cached/unavailable
refresh. The missing `tier` dependency in the chat was corrected, without
claiming a separately reproduced stale-tier failure: indirect dependencies
already changed with that tier.

The time/refresh, 500ms hydration, speculative-render and channel-replacement
interleavings cannot safely or deterministically be driven by the existing UI.
Their isolation regressions exercise observable rights, sent callbacks and
rendered messages, not implementation shape. Normal navigation, billing recovery,
chat/category continuity and search remain qualified through affected TesterArmy
journeys. The new category journey uses only supported UI links and never claims
that an immediate negative assertion observes a future 500ms interval.

## Updated E2E expectations

The first integrated Dreamer selection passed three journeys and failed four.
Three billing setups expected `5 / 3`; `QuotaStatusCard` already capped visible
usage before this work (`1f508d7f8`, introduced by `b43a6dfcf` for the explicit
iPhone requirement recorded in `qa/iphone-dogfood-fixes-20261018.md`). Eight stale
expectations now require `3 / 3`. Raw usage remains five, zero remaining rights
is asserted, and Free blocking, Plus unlimited access, cancel/error/retry,
restore and account isolation remain exercised. No quota code was changed to
satisfy an old display expectation.

The new category journey also needed to scroll through the illustrated cover
before the contextual action dock mounts. Its failure screenshot and trace
show the cover, and the existing detail implementation gates that dock on
reading visibility. The test now exposes the transcript through the real UI
before opening categories; all exact sent-question, reply and resume assertions
remain. Network errors in those failed reports were the analytics scripts
intentionally blocked by the existing harness, also present in passing journeys;
no new application-error exclusion was added.

## Lint and test configuration

ESLint falls from **101 warnings to 22**, with zero new warnings or errors.
The warning baseline only loses resolved fingerprints through its existing
`--prune` command. No new ESLint rule is disabled; obsolete suppressions are
removed. New warnings, errors and reused resolved allowances still fail.

Safe cleanup includes all 49 `import/first` occurrences, array type notation,
unused imports and two compile-time type assertions preserved as explicit
exports. Jest mock behavior and assertions remain. Journal viewability config
and callbacks remain stable; detail memo dependencies and named recursive retry
retain their behavior. The dictionary clears unavailable letter selection before
commit, without resurrecting the old letter when a search is cleared; the
existing French search/letter journey exercises that counterexample.

The Expo preset contributed global `passWithNoTests` inside a Jest child project,
where Jest ignored it and emitted a configuration warning. The child now copies
the preset and omits that invalid property. Roots, selection, transforms, ignores
and coverage are unchanged; no global allowance was enabled. A real 25-test
selection passes without the warning, and an explicitly requested missing test
still fails with exit 1.

The remaining **19 effect warnings and 3 ref warnings** are visible in the
baseline, rather than suppressed:

| Surface | Count | Reason retained |
| --- | ---: | --- |
| Root startup | 5 | External startup/navigation readiness and its observable state. |
| Journal navigation | 1 | Consume an external filter command once, preserving subsequent manual filters. |
| Chat | 2 | Restore this conversation and synchronize external quota state; deriving continuously would overwrite pending messages. |
| Recording | 1 | Consume the external capture/recording intent. |
| Email authentication | 2 | Clear obsolete verification/session state, including delayed signup responses after the email changed. |
| Lucid root | 3 | External navigation/auth initialization and readiness. The web URL snapshot is initialized during state creation; native URL cancellation remains. |
| Onboarding | 1 | Hydrate persisted onboarding state. |
| Journal jobs, storage and remote traversal | 3 | Publish asynchronous jobs/loading/errors and reset account-owned traversal before appending another owner's rows. |
| Subscription internal state | 1 | Synchronize the subscription's external state. |
| Lucid import ownership refs | 3 | Invalidate the previous owner synchronously even when the next render suspends; moving this behind an effect would reopen the stale runtime. |

These remaining patterns were examined independently. They remain explicit
maintenance debt; the lint signal alone is not a reproduced functional defect.
No timer/microtask or weaker ownership guard was introduced to disguise them.

## Compatible dependency corrections

Direct dependency contracts and Expo/RN versions are unchanged. Two clean
`npm ci` installations pass in the audit worktree only. The root lock changes
11 records and Meditation changes nine, all within the existing ranges:

- MCP SDK 1.27.1 → 1.32.1 (root development toolchain).
- xmldom 0.8.13 → 0.8.15 (root plist/build tooling).
- js-yaml 3.15.1 → 3.15.2 and 4.3.1 → 4.3.2 where present.
- source-map-js 1.2.1 → 1.2.2.
- Browserslist and its compatible browser-data dependencies.

[The MCP advisory](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6qxp-vccf-f47h)
has specific OAuth-client exposure conditions; the installed Expo transport is a
reverse WebSocket tunnel. No credential exposure or native-app exploit is claimed.
[The xmldom advisory](https://github.com/xmldom/xmldom/security/advisories/GHSA-w2rr-34g9-rvrj)
also requires consumer-side strict serialization for its protected path. Package
upgrades are not proof that every hypothetical serialization call is safe.
Bounded API smokes and their exact commands are stored in the ignored receipt.

Read-only audits were compared with identical manifests, original/current locks,
Node 24.19.0, npm 11.17.0 and one new temporary cache. Reversed-order and repeated
warm runs demonstrate that raw package counts depend on cached propagated
metadata; the previous Meditation total of 50 is not reproduced in that context.

| Audit | Comparable warm package totals before → after | High before → after | Own advisory/range entries before → after | New own entries |
| --- | ---: | ---: | ---: | ---: |
| Root | 153 → 163 | 129 → 125 | 94 → 78 | 0 |
| Meditation | 83 → 97 | 72 → 70 | 15 → 12 | 0 |

Both audits still exit 1; neither is zero-vulnerability qualification. They have
zero critical findings in this comparison. The newly counted parent packages
propagate existing argparse/sprintf-js findings through YAML/Istanbul/Jest; their
lock records are unchanged. This comparison verifies lock metadata, not a fresh
hash of all installed package bytes. No changed version begins matching a new
known own advisory. Full comparison inputs/results are retained under
`test-results/warning-remediation-20261019/audit-comparison-fresh-cache/`.

Unresolved alerts include `node-forge`, `image-size`, `braces` and other
transitive chains. Some lack a published compatible correction; automatic
suggestions include incompatible major changes or Expo/Jest downgrades. None
was forced, and no alert or install-script approval was suppressed.

## Validation and remaining boundaries

Independent reviews cover UI, quota/timer/chat, paywall/listener/Lucid, imports,
compiler assertions, dictionary reset and the Jest config delta. Local targeted
red/green logs identify the reproduced defects; types and focused checks pass.
The final committed-head engine proof and E2E artifacts/receipts remain in the
existing ignored stores. The report does not label earlier runs as a fresh final
execution. A new engine proof is required before the branch is pushed.

Useful reruns (the campaign receipt records the exact selections used):

```sh
mise exec -- npm run lint
mise exec -- npm run typecheck:app
mise exec -- npm run typecheck:tests
mise exec -- npm run test:file -- hooks/__tests__/useQuota.test.tsx hooks/__tests__/useSubscriptionExpiryTimer.test.tsx hooks/__tests__/useChatCategoryPrompt.test.tsx hooks/useSubscriptionCustomerInfoListener.test.tsx components/chat/__tests__/MessagesListStreaming.test.tsx tests/app-routes/paywallScreen.test.tsx --watchman=false
mise exec -- npm run test:testerarmy -- run --grep "plus opens a symbols question once"
E2E_WEB_LOCALE=fr-FR mise exec -- npm run test:testerarmy -- run --grep "search matches accents and excerpts"
mise exec -- npm run verify:pr
mise exec -- node scripts/verify-local.mjs proof-block
```

The standalone historical `supabase/functions/api/evaluation/ti559/evaluate-models.ts`
check still fails TS2367 on its unchanged prompt-version pin
`analysis-2026-09-09.1` versus current `analysis-2026-10-18.poetic6`. That guard is
preserved rather than widened or updated to silence drift. The standalone
account/chat-latency checks and account tests pass. Canonical Edge verification
passes (261 tests) as part of the 17-check committed-head engine run on
`93b98b0c6`; the historical evaluation is outside that current Edge contract.
No provider evaluation was executed.
No new native binary, device, Store, live-backend or production qualification is
claimed by the browser/mock and isolated evidence in this work package.
