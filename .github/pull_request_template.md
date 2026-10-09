## Summary

<!-- What changes and why. Link the issue or decision. -->

## Local proof

Remote CI does not run on push or PR. State what you ran locally on the PR head.

- Command(s): `npm run verify:fast` (run by the pre-push hook) <!-- plus any surface check: docs:build/docs:check, Meditation, Edge, E2E -->
- Commit SHA: <!-- full SHA the commands ran on -->
- Result: <!-- passed / failed, duration, notable output or report path -->
- Not checked: <!-- native, device or other evidence still missing, or "nothing" -->

<!-- Optional: link a manual CircleCI pipeline (force_full_validation: true) when one was run. -->

## Before merge

- [ ] If `master` moved since the check, `master` was merged into this branch and the check re-ran on the new head (SHA above updated).
- [ ] Review comments are resolved or answered.
