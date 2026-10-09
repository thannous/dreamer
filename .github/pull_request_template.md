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
`<check>: owner-machine: <host> <note> on <SHA>`. External CI evidence only
for a workflow listed in External CI. Otherwise: none / out of scope.
-->
- none / out of scope

## Review

<!-- Scale and rules: doc_web_interne/docs/regle-commune-livraison.md, section 11. -->
- [ ] Every review thread has an answer; nothing merges with an unanswered thread.
- [ ] Scale ([doc_web_interne/docs/regle-commune-livraison.md](https://github.com/thannous/dreamer/blob/master/doc_web_interne/docs/regle-commune-livraison.md#11-échelle-de-relecture)): blocker fixed before merge; should-fix fixed in this PR or answered with a reason or a tracked follow-up; nit optional, may be declined with a short reply.

## External CI

<!--
none, or which workflow of the External CI table
(doc_web_interne/docs/regle-commune-livraison.md, section 13) runs for this PR and why.
-->
- none
