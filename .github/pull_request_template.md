## Summary

<!-- What changes and why. -->

## Local proof

<!--
Run `npm run verify:pr` on the PR head, then replace this section with the
output of `node scripts/verify-local.mjs proof-block`. If the base moves:
merge it into the branch, rerun `npm run verify:pr` and update this section.
-->
- Commands: `npm run verify:pr`
- Commit SHA: `…`
- Result: …
- Tree (`git rev-parse <sha>^{tree}`): `…`
- Specialised checks (database, browser, mobile, corpus): run: … / out of scope: …
- Integration: base unchanged / base moved, checks replayed: …

## Specialised checks

<!--
One line per specialised check this PR needs, owner machine first:
`<check>: owner-machine: <host> <note> on <SHA>`, where <SHA> is the PR head
SHA (never another commit, even with the same tree). External evidence only
for a workflow listed in the repo's External CI table, run on the head SHA. Otherwise: none / out of scope.
-->
- none / out of scope

## Review

<!-- Scale and rules: the repo's delivery rule (its path is linked from AGENTS.md, Livraison section), section 11. -->
- [ ] Every review thread is answered and resolved; nothing merges with an unanswered or unresolved thread.
- [ ] Scale (section 11 of the repo's delivery rule, `doc_web_interne/docs/regle-commune-livraison.md`): blocker fixed before merge; should-fix fixed in this PR or answered with a reason or a tracked follow-up; nit optional, may be declined with a short reply.

## External CI

<!--
none, or which workflow of the External CI table
(the repo's delivery rule, section 13) runs for this PR and why.
-->
- none
