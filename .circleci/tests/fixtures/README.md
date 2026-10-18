These frozen fixtures preserve the contracts of the portfolio retired after
PR #418 (master 3e93154369b180ada25f08e528a7131e4b62444d). CircleCI reads only
`.circleci/config.yml`; neither fixture is submitted for continuation.

`scripts/verify-local-config.test.js` checks that the former validation commands
remain in the local release portfolio. The existing classifier, fallback and
preparation tests keep their original routing cases against these fixtures.
The active benchmark gate is tested separately, on every OS, by
`.circleci/tests/benchmark.test.mjs`.

Current validation commands and inputs live in `verify-local.config.mjs`.
