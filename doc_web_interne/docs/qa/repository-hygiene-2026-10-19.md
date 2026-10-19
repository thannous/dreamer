# Repository hygiene implementation — 2026-10-19

Subsequent warning and dependency work: [warning remediation](warning-remediation-2026-10-19.md).
The snapshots below retain their original source and audit-count boundaries.

## Scope and source

Owner request: implement the five repository maintenance recommendations after the
[legacy audit](legacy-test-audit-2026-10-19.md). Branch: `codex/repository-hygiene`,
based on fetched `origin/master` at `967fe81f0a6012d5142483ae3ff17e19eba7133f`.
The dedicated audit checkout preserves the primary checkout's unrelated journal,
translation, artwork and local-setting work. All 13 original WIP files were
checked against their preserved synchronization results.

The verified cleanup is commit `f1b5b3020`; verification/tooling and policy are
commit `15b014ef5`. This document and the reorganized guides are the following
documentation commit. A subsequent, separate security correction updates two
development-only transitive packages after the push surfaced dependency alerts.
No production, Store, EAS or personal-device operation is part of this work. Validation of the final committed head is recorded separately
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


## Dependency security follow-up

Fresh read-only `npm audit --json --package-lock-only` checks on all three current
lockfiles found two critical package alerts in the root development toolchain.
The installed parent chains and official maintainer advisories were checked:

- `proxy-addr` **2.0.7 → 2.0.8**, through Expo MCP, the MCP SDK and Express.
  The patch fits Express's existing range. A harmless reproduction confirmed
  that a malformed IPv4-mapped IPv6 trust subnet accepted an untrusted address
  before the fix; the patched version refuses it and still accepts a valid
  trusted subnet. [Maintainer advisory](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h).
- `tar` **7.5.11 → 7.5.22**, through Vercel's Container and node-pre-gyp.
  Container pins the affected version, including its current upstream release,
  so the override targets only `@vercel/container@13.0.0`. The already-patched
  Fun copy and its redundant `yallist` entry deduplicate. The patch keeps the
  Node >=18 contract and the same dependency ranges.
  [Critical advisory](https://github.com/isaacs/node-tar/security/advisories/GHSA-23hp-3jrh-7fpw),
  [later fixed advisory](https://github.com/isaacs/node-tar/security/advisories/GHSA-r292-9mhp-454m).

Only these four development lock records change; all production records,
direct dependency versions, Expo/RN versions and publication guards remain.
A clean `npm ci` passes with the existing versioned patches. `npm ls` and parent
resolution checks confirm that all consumers use the patched versions, and
installed metadata matches lock versions, integrity and resolution. A real tar
create/extract round trip, the proxy counterexample and Vercel 62.2.0's version
command pass. Independent review has no findings. Unrelated optional bundled
WASM lock metadata retains its original representation.

Post-fix audit counts are package-level findings, including propagated alerts;
they are not counts of independently exploitable application vulnerabilities:

| Lockfile | Critical | High | Moderate | Low | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Root | 0 | 129 | 23 | 1 | 153 |
| Meditation | 0 | 39 | 11 | 0 | 50 |
| TesterArmy | 0 | 0 | 0 | 0 | 0 |

Root and Meditation audits still exit 1. Their remaining alerts require targeted
follow-up; this work does not claim complete security qualification. npm's
suggested Expo 58 → 44 downgrade is incompatible with the current SDK/RN
contract. Some chains also have no published fixed package, such as the current
`node-forge` alert. No `audit fix --force`, blanket script approval or alert
suppression was used. Raw audit reports, the four-record lock delta and smoke
receipt remain under ignored `test-results/repository-hygiene-20261019/`.
Final committed-head verification is recorded by the existing engine before the
updated branch is pushed.
