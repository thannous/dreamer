# Repository hygiene implementation — 2026-10-19

## Scope and source

Owner request: implement the five repository maintenance recommendations after the
[legacy audit](legacy-test-audit-2026-10-19.md). Branch: `codex/repository-hygiene`,
based on fetched `origin/master` at `967fe81f0a6012d5142483ae3ff17e19eba7133f`.
The dedicated audit checkout preserves the primary checkout's unrelated journal,
translation, artwork and local-setting work. All 13 original WIP files were
checked against their preserved synchronization results.

The verified cleanup is commit `f1b5b3020`; verification/tooling and policy are
commit `15b014ef5`. This document and the reorganized guides are the following
documentation commit. No production, Store, EAS or personal-device operation is
part of this work. Validation of the final committed head is recorded separately
by the existing verification engine; older audit runs are not relabelled as
fresh runs of that commit.

## Implemented recommendations

1. **Coherent commits.** The proved cleanup and the tooling changes are committed
   separately; documentation closes the work package. Run `npm run verify:pr` on
   the final head before any push. The engine and pre-push hook are unchanged.
2. **Local settings stay local.** `.claude/settings.local.json` is removed from
   Git tracking. The audit copy and the primary WIP copy were preserved byte for
   byte, with private backups and a preservation receipt under ignored
   `test-results/repository-hygiene-20261019/`. No settings content was added to a
   commit or printed as evidence. Keep the primary local copy safe when later
   integrating the branch; removing tracking is not deletion authorization.
3. **Source/artifact boundary.** [Repository layout](../repository-layout.md)
   assigns active source, original assets, generated output, private QA and
   redacted durable records to existing locations. Exact ignore rules now cover
   new root outputs/screenshots/temp runs. `repository:hygiene` checks Git-index
   paths without reading private payloads. Its 204 exact historical exceptions
   preserve existing useful records; they do not admit adjacent new files or
   private settings. It runs in both PR and release verification.
4. **Lint noise reduced and constrained.** Eight safe import/type cleanups reduce
   **121 warnings to 101** (98 distinct fingerprints), with identical emitted
   JavaScript for all eight files. No lint rule was disabled. The existing
   `npm run lint` still runs brand checks and the same ten source directories,
   through the installed ESLint API and the existing Expo flat configuration.
   New warnings and all errors fail. Fingerprints include file, rule, semantic
   message, offending-source hash and multiplicity; line-only movement is not a
   new warning. `npm run lint:warnings -- --prune` can only remove resolved
   allowances and refuses new warnings/errors. Resolved entries must leave the
   baseline, so a fixed warning does not create reusable allowance.
5. **Shorter operational documentation.** `AGENTS.md` shrinks from 48,262 to
   13,951 bytes (71.1%) and 417 to 216 lines. All 20 original anchors and active
   authority, safety, delivery, native and data obligations remain. Procedures
   are centralized in [repository operations](../repository-operations.md) and
   the task index. Historical results remain dated. External dashboard state is
   described conditionally and was not requalified by this documentation work.

The owner-requested hygiene and warning policies are declared delivery-control
files for review. They add protection without changing CI routing, release
thresholds, the verification engine or the hook.

## Verification and evidence boundaries

- New lint guard: three real ESLint CLI regressions pass: harmless line movement,
  new warnings despite a falling total, duplicate warnings, retained hard errors,
  pruning resolved warnings and refusing their reintroduction. A browser journey
  cannot exercise these pre-application compiler-policy failures.
- New index guard: four tests pass, including a real temporary Git index,
  preserved local settings after untracking, refused private output and allowed
  product assets/redacted durable QA. These tests require no private content.
- Guard integration: two suites / 12 cases pass for the warning CLI and the
  verification configuration, including the unconditional PR/release path gate.
- Current app types and focused strict helper lint pass. Independent reviews of
  both guards and the documentation comparison have no remaining findings.
- Documentation: 97 local links / 21 fragments and preserved 20 anchors pass;
  UTF-8, newline and diff checks pass. The ignored duty map records where the
  original instructions remain or moved.
- Existing runtime evidence remains at its recorded source and scope in the
  legacy audit. This follow-up changes no emitted application JavaScript and
  does not claim a new native build, device, Store or production qualification.

Exact current entry points:

```sh
mise exec -- npm run repository:hygiene
mise exec -- npm run test:repository-hygiene
mise exec -- npm run lint
mise exec -- npm run test:file -- scripts/check-lint-warnings.test.js scripts/verify-local-config.test.js --watchman=false
mise exec -- npm run verify:pr
mise exec -- node scripts/verify-local.mjs proof-block
```

The final verification receipt and primary-WIP preservation checks stay under
ignored `test-results/repository-hygiene-20261019/`. The Git proof lives in the
engine's existing common-repository proof store. A missing or failed proof is
never reported as passed.

An automatic approval review rejected a broad staging selection because it could
mix personal WIP. No rejected command executed. Explicit audited paths and a
fresh 13-file preservation check resolved that risk before commits were made.
