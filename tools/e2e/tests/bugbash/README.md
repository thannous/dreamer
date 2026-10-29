# Bug bash repros

A pre-release bug bash (`npm run test:bugbash:prerelease`) explores Dreamer
web in mock mode. A confirmed bug is a test in this directory that fails on
the assertion that describes the expected behaviour, tagged `bugbash`.

`verify:pr` does not run these tests. `verify:release` runs
`npm run test:bugbash:repros` (`--tag bugbash`). After the fix, remove the
tag and keep the test with the other journeys. An empty directory is a pass.
