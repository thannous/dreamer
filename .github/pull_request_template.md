## Summary

<!-- What changes and why. Link the issue or decision. -->

## Local proof

<!-- Paste the output of `node scripts/verify-local.mjs proof-block` (run `npm run verify:pr` on the PR head first). Remote CI does not run on push or PR. -->

- Commands: `npm run verify:pr`
- Commit SHA: `…`
- Result: …
- Tree (`git rev-parse <sha>^{tree}`): `…`
- Specialised checks (database, browser, mobile, corpus): run: … / out of scope: …
- Integration: base unchanged / base moved, checks replayed: …

<!-- Not covered by verify:pr (native device, store build, real services): say what remains unchecked. Optional: link a manual CircleCI pipeline (force_full_validation: true) passed with --external. -->

## Before merge

- [ ] Not a draft; the `Commit SHA` above is the PR head.
- [ ] If `master` moved: `master` was merged into this branch, `npm run verify:pr` re-ran (only the checks whose inputs changed run again) and the Local proof above was updated.
- [ ] No open review thread; no conflict.
