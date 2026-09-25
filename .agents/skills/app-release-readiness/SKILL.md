---
name: app-release-readiness
description: Audit a named mobile build for a target release step. Reconcile store, monetization, distribution, and real-device evidence.
---

# App Release Readiness

Determine whether the named release candidate can take the requested next step.
Keep technical readiness, distribution, submission, and publication distinct.

## Establish the target

Identify app, platform, application ID, version/build, channel, and intended next
action from the request and available project facts. Ask only for a missing choice
that changes the audit. Scope may be a complete submission audit or one release gate.

Read-only audit requests authorize inspection and a report. A preparation or fix
request also authorizes scoped local edits and proportional checks. Reuse any
explicit authorization already given; do not add repeated confirmation rounds.

Follow repository safeguards for production deploys, paid builds, store writes,
tester invitations, submissions, real purchases or restores, and device changes. An audit is not
authorization for these actions. Prepare the concrete result before asking for
any still-missing authorization. Never uninstall or clear user data to validate
a release.

## Check applicable gates

Read only the relevant sections of [references/release-gates.md](references/release-gates.md)
for provider checklists and evidence details.

| Gate | Evidence needed |
|---|---|
| Store metadata and compliance | Current listing, required locale/device coverage, declarations, account eligibility, and review information |
| Monetization | Matching store/provider/app product IDs, entitlements, offerings, environment, and safe purchase-flow evidence when applicable |
| Build and distribution | Exact candidate identity, runtime/signing configuration, current build result, and the distribution stage actually reached |
| Real-device QA | Named device, installed candidate, mode, date, and affected critical journeys; emulator evidence remains separate |
| Remaining blockers | The requirement, affected next action, owner, missing proof, and smallest useful next step |

Use current repository, provider, store, and device evidence for the corresponding
gate. Prior reports can guide lookup but do not prove current state. Reuse evidence
only when its candidate, inputs, scope, and freshness remain applicable; recheck
changed surfaces rather than rerunning unrelated suites.

For each gate use `READY`, `BLOCKED`, `WAITING`, `INDETERMINATE`, or
`NOT APPLICABLE`, with a reason. Use BLOCKED for a concrete unmet requirement, WAITING for a running
external process, and INDETERMINATE for insufficient evidence. Missing access is uncertainty, not a passed check
or an invented defect. An optional improvement does not become a release blocker
without a requirement or demonstrated risk.

Verify current platform requirements in official provider documentation or the
authenticated console when they affect the verdict; the reference is an audit
aid, not a permanent statement of store policy. Redact secrets and account details.

## Remediate and finish within scope

For an authorized fix, correct the smallest relevant blocker, check the changed
surface, and refresh its evidence. Continue independent local work if an external
gate is waiting or inaccessible. An ambiguous paid or publication action must not
be retried blindly: inspect provider state before deciding whether a retry is safe.
Stop after an understood provider blocker or one safely corrected retry fails;
do not duplicate a paid build, submission, or rollout whose outcome is uncertain.

Lead the report with `READY FOR <named next action>`, `NOT READY`, `WAITING`,
or `INDETERMINATE`. For submission use `READY TO SUBMIT`; state separately
whether submission has occurred. Include:

- candidate, platform, channel, scope, and evidence timestamp;
- one row per audited gate with evidence, state, and next action;
- blockers in execution order and actions actually completed;
- the single next action that most reduces uncertainty or release risk.

For a partial audit, label omitted gates unassessed and limit the verdict to that
scope. Claim full submission readiness only when every applicable gate has current
evidence, the selected build is traceable, and real-device evidence matches that
candidate. A completed audit may conclude not ready or indeterminate.
