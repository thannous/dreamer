---
name: app-release-readiness
description: "Audit mobile release readiness for a named build and channel. Separate local, store, device and publication evidence; audit requests are read-only."
---

# App Release Readiness

Produce an evidence-backed release decision. Keep technical readiness, store configuration, distribution, device validation, and publication state separate.

## Establish scope and authority

Identify the app, platform, store, version, build, release channel, intended publication state, and current authorization boundary. If any of these are not stated, derive them from the repository and connected dashboards when safe.

- Treat `check`, `audit`, and `review` requests as read-only.
- Edit local release inputs only when the user asks to prepare or fix them.
- Require explicit authorization before deploying a public site, creating or uploading a paid build, changing live store or monetization configuration, inviting testers, or publishing a release.
- Never submit to App Review or roll out to production unless that exact action is authorized.
- Never perform a real purchase or restore flow unless explicitly authorized. Prefer sandbox, test-store, or mock-store evidence.

Before changing files, read the repository guide, inspect `git status --short`, and preserve unrelated work. Use the repository's package scripts and established release tooling.

## Use current, authoritative evidence

Memory and prior reports can orient the investigation but cannot prove current readiness. Refresh the cheapest authoritative source for each gate:

- tracked release configuration and current commit for local facts;
- store dashboards for metadata, compliance, selected builds, and submission state;
- monetization dashboards for products, entitlements, offerings, and credentials;
- build-provider jobs and store processing pages for distribution state;
- timestamped screenshots, recordings, UI dumps, or logs for device QA.

For every claim, record the source, timestamp, target version/build, and whether it is observed or validated. Omit secrets, authentication codes, personal account details, and raw user content.

Use these result states:

- `READY`: current evidence satisfies the gate for the named release candidate.
- `BLOCKED`: a concrete unmet requirement prevents the intended next release action.
- `WAITING`: an external process is running and no user action is currently required.
- `INDETERMINATE`: access or coverage is insufficient; do not infer success.
- `NOT APPLICABLE`: the gate genuinely does not apply to this release.

## Audit the five release gates

Read [release-gates.md](references/release-gates.md) when a platform-specific checklist or provider-to-provider reconciliation is needed.

### 1. Store metadata and compliance

Check listing completeness per required locale, screenshots and device-family coverage, privacy/data disclosures, age/content ratings, accessibility declarations, content rights, review contact and notes, trader or regional compliance, agreements, banking, tax, and any app-access instructions.

Distinguish `draft`, `saved`, `published`, `accepted`, and `submitted`. Dashboard access or an existing app version is not readiness proof.

### 2. Monetization setup

Reconcile the same product identifiers across the store, monetization provider, app configuration, entitlements, offerings, paywall, and test environment. Check sale availability, pricing, localization, review metadata, credential validity, and sandbox/test behavior.

Provider ownership or a visible entitlement does not prove that the store app, products, keys, and release build are correctly linked.

### 3. Build and distribution status

Verify bundle/application ID, version, build number, capabilities, signing path, runtime configuration, and release-mode backend/store settings. Then identify the exact stage reached:

`configured locally -> build started -> artifact produced -> uploaded -> processed -> selected for version/track -> available to testers -> submitted -> released`

Report only the highest stage supported by direct evidence. Local tests, a green build, or a started upload do not prove store availability.

### 4. Real-device QA evidence

Name the physical device, OS version, app version/build, backend/store mode, commit or artifact, test date, and evidence location. Validate the smallest critical release journey: launch, onboarding/authentication, primary value path, paywall or entitlement display, deep links/notifications when relevant, accessibility/reflow, offline/error handling, and upgrade/restore behavior when safely authorized.

Simulator or emulator evidence is useful but must not be labeled real-device proof. Evidence from another build does not clear the current release candidate.

### 5. Publication blockers

Convert every unresolved item into a blocker with:

- affected gate and exact release action it blocks;
- current evidence and missing proof;
- owner: repository, store account, build provider, monetization provider, human QA, or external review;
- smallest safe next action;
- whether the agent may execute it under current authorization.

Order blockers by critical path. Do not hide external waits such as store processing, compliance review, or account verification behind a general “ready” label.

## Remediate and re-check

When changes are authorized, fix only the smallest scoped release blockers. Validate locally in proportion to risk, then refresh the relevant external source. Keep these proofs separate:

1. local configuration and tests;
2. remote build or CI result;
3. store/monetization dashboard state;
4. real-device behavior;
5. submission or publication state.

If an external action fails, preserve the successful earlier proof and report the failed stage precisely. Do not retry a paid build, submission, rollout, or production mutation indefinitely; stop after the relevant provider error is understood or one safe corrected retry has failed.

## Deliver the readiness report

Lead with one decision for the requested target: `READY TO SUBMIT`, `NOT READY`, `WAITING`, or `INDETERMINATE`. Keep submission state separate, such as `not submitted`, `in review`, or `released`.

Include:

1. target app, platform, version, build, channel, and evidence timestamp;
2. one row per release gate with state, strongest evidence, blocker, and next action;
3. critical-path blockers in execution order;
4. actions completed in this run, separated into local, remote, device, and publication proof;
5. the single next action that most reduces release risk or waiting time.

Use a compact table or small flow diagram only when it makes the proof layers or critical path easier to understand.

The audit is complete when its coverage, available evidence, unknowns, and next actions are reported. A completed audit may conclude `NOT READY`, `WAITING`, or `INDETERMINATE`. Claim `READY TO SUBMIT` only when every applicable gate has current evidence, every unresolved item is explicitly classified, the selected release build is traceable through distribution, and real-device evidence matches that release candidate. A release can be technically ready while still not submitted or published.
