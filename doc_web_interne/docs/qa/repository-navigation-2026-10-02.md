# Repository navigation corrections

Scope: the seven findings from the local session audit. This work package updates
repository entry points, release/E2E guidance, command classification and the local
Android Java prerequisite. The integration owner is the current coding session.
Implementation, focused validation, commit and PR delivery are authorized; builds,
installations, store submissions and production publication are separate actions.
Existing iPhone OTA work in the primary checkout is outside this patch.

## Failure model before implementation

Application E2E does not execute the script catalog or the Android build launcher.
Two existing Node test suites cover these tooling gaps, with new cases written
before implementation:

- Web/backend journeys mislabeled as Android can send an agent to the wrong
  environment. Release preparation, remote builds and mirror writes mislabeled
  as read-only hide their actual effects.
- A Java 25/21/8 runtime can reach native compilation despite the known Java 17
  requirement. A valid Java on PATH must not mask an incompatible JAVA_HOME,
  since Gradle uses JAVA_HOME. Missing, failed, timed-out or unparseable Java
  must stop with an actionable message before version synchronization, device
  access, prebuild, APK removal or Gradle.

No app tests are added for documentation wording or source-file layout. A bounded
CLI refusal check will exercise the actual launcher after implementation, without
starting a native build. Its machine-readable report will record the revision,
command, environment, assertions and result in ignored local output.

## Validation

- Before implementation, the two focused Node suites failed on the new cases:
  11 failures and 35 existing passes. After correction, all 46 tests passed.
  Rerun: `mise exec -- npm run test:file -- scripts/list-scripts.test.js
  scripts/build-android-release-local.test.js --watchman=false`.
- All 59 relative links in the affected guides resolve; mapped implementation
  and CircleCI entry points exist. `git diff --check` passed.
- Focused Expo lint passed with zero warnings for both changed scripts and tests.
- Four actual CLI checks passed: Java 25 refusal, missing-Java refusal, help
  without Java, and package-script catalog output. The refusal checks use fake
  JDK/tool executables, assert no EAS/prebuild/ADB command starts and verify that
  release manifests stay byte-identical. This qualifies prerequisite handling,
  not compilation. Catalog output distinguishes web/backend/native E2E and
  release preparation/build/mirror effects.
- Private ignored artifacts: `test-results/navigation-cli/report.json`,
  `catalog.json` and `driver.cjs` in the isolated worktree. The report includes
  revision/dirty state, changed source-file hashes, Node/platform, synthetic
  fixtures, individual assertions, command and pass/fail. Rerun with
  `mise exec -- node test-results/navigation-cli/driver.cjs` there.

The final `test:prepush` and remote CI result will be recorded with the committed
revision before delivery. No native build or device qualification is claimed.

## Corrections and handoff

The root README/AGENTS now point to `doc_web_interne/docs/README.md`. That index
maps tasks to actual files, current guides, CI and bounded searches. It distinguishes
Lucid's companion router root, generated site output, historical QA and optional
host skills/configuration. Release/E2E guides link their canonical entry points;
old store facts are dated and checklist assertions require fresh qualification.
Java is checked before build preparation; the catalog exposes release effects.

The primary checkout's existing package/OTA files were not changed or included.
Publication, builds, store submissions and device operations remain separate.
Next action: final committed validation, then scoped PR delivery. A merge to
master requires production publication intent under AGENTS.md.
