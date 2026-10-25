# Project scripts

Run `npm run scripts:list` for the current command catalog. Add `-- --json`
when another tool needs structured output. The [task index](../doc_web_interne/docs/README.md)
connects these commands to implementation paths and current runbooks.

## Command families

| Family | Primary commands | Side effects and prerequisites |
| --- | --- | --- |
| Development | `start`, `start:*`, `web`, `android`, `ios` | Runtime only. Environment profiles are loaded in memory and never copied to `.env.local`. |
| Local workspaces | `workspace` | Creates or reuses a named workspace under `~/Projects/.workspaces/<repo>/<task>`; release refuses WIP, changed commits and undeclared ignored files. Existing package-manager caches are inherited. |
| Quality | `lint`, `lint:scripts`, `typecheck:*`, `test:*`, `verify:pr`, `verify:release`, `verify:release:site` | Read-only except normal test caches, artifacts, and ignored `docs/` output. `verify:pr` (before every push) and `verify:release` (before a publish; `verify:release:site` leaves out the app checks when only noctalia.app ships) run the checks of `verify-local.config.mjs` on an isolated `git worktree` of the commit, with the main checkout's `node_modules` linked, and write the proof under `$(git rev-parse --git-common-dir)/verify-proofs/`; `node scripts/verify-local.mjs proof-block` prints the verified commit and result for the PR. The `.githooks/pre-push` hook only runs `scripts/verify-local.mjs hook` (forbidden files, secrets, size, proof display: a few seconds). `prepare` installs that hook by setting the local `core.hooksPath`. |
| Site | `docs:build`, `docs:check`, `docs:release-check`, `docs:deploy:*` | `docs:build` regenerates ignored local output. The Pages Git integration still rebuilds that output on `master` until dashboard production auto-deploy is turned off. `docs:deploy:*` publishes externally and needs an explicit production decision. See Publishing to production in `AGENTS.md`. |
| Content | `content:*`, `validate-seo`, `generate-sitemap` | Manifest commands without `:check` and sitemap generation write generated files. |
| SEO | `seo:gsc:export`, `seo:backlinks:check` | GSC export writes a dated external-data report; backlink check fetches the tracked public referring pages but never rewrites the CSV. |
| Web E2E | `test:e2e:web`, `test:e2e:web:report` | TesterArmy and its pinned Chromium; simulated services. See [the E2E guide](../e2e/README.md). |
| Backend E2E | `test:e2e:backend`, `start:backend-e2e` | Disposable local backend on the native Supabase runtime (no Docker) and browser artifacts; `test:e2e:backend -- --qualify-ti528` adds the six TI528 integration cases to the nine backend scenarios. Linux amd64/arm64 with glibc 2.35+ or macOS 14+ on Apple silicon (`node scripts/check-native-supabase-runtime.cjs`). See [backend qualification](../doc_web_interne/docs/e2e-backend-qualification.md). |
| TesterArmy E2E | `test:testerarmy*`, `agent-device:*` | TesterArmy on web, an owned emulator or a named iOS Simulator; native runs need an identified Release build (`build`) and an explicit `E2E_DEVICE`, and take the device lock. See [the TesterArmy guide](../tools/e2e/README.md). Maestro and its `test:e2e:*` Android commands were retired on 2026-10-14. |
| Mobile release | `release:*` | `prepare` writes manifests; `versions:sync` writes local mirrors; `build` starts a remote EAS build and requires explicit authorization. See [the release guide](../doc_web_interne/docs/MOBILE_VERSIONING.md). |
| Android release | `android:gates:*`, `android:release:local`, `build:apk:*` | May require ADB, a physical device, EAS credentials, or local build tooling. `android:gates:strict` requires a qualified TesterArmy run of the `production-apk` candidate under `tools/e2e/.e2e/dreamer-android/` (same commit as the release and its build, clean tree, intact manifest, candidate APK in `QA_ANDROID_RELEASE_APK`, stable and clean source snapshots). The real voice check is an optional manual test (owner decision 2026-10-17). |
| Subscriptions | `subscription:qa:*` | Some commands update local QA evidence; see the RevenueCat runbook before use. |
| Backend/security | `db:contract:*`, `security:audit:*` | Database checks require an explicit local or remote connection. |

## Atlas pages: asset packs, handoffs, qualification receipts and review galleries

Four small commands of the site package (`apps/site`, not the root package, whose scripts feed the
app's runtime fingerprint) support the symbol atlas pages. Run them from the repository root; relative
paths are read from where the command is typed.

| Command | What it does | Writes |
| --- | --- | --- |
| `npm run atlas:pack --prefix apps/site -- --pack <pack.json> [--dry-run] [--merge-manifest]` | Validates one symbol's eight sources against `scripts/lib/atlas-pack-contract.mjs` (example: `scripts/atlas-pack.example.json`), then encodes the served AVIF and WebP sizes, named after their content. | Only under `docs-src/static/img/symbols/atlas-six-v2/<symbolId>/`, the per-symbol cache and receipt in `.cache/atlas-pack/` (ignored), and, with `--merge-manifest`, the symbol's entry in `docs-src/config/symbol-atlas-six-assets.json`. |
| `npm run atlas:handoff --prefix apps/site -- create --base <sha> --out <dir> [--run "<command>"]...` | Writes `handoff-<base>-<head>.patch` (`git format-patch --binary`) and its envelope: base, head, patch sha256, commits, every changed path with its blob before and after, and the commands run on the head with their real exit codes. | Two new files in `<dir>`. |
| `npm run atlas:handoff --prefix apps/site -- verify --envelope <file> [--allow-diverged] [--applied]` | Checks a patch before applying it with plain Git: bytes, paths and commits match the envelope; when this clone has the base (or the head), its tree holds every "before" (or "after") blob, and with both, base..head holds the listed commits and paths; the tree is clean; every path holds its "before" blob (or, with `--allow-diverged`, `git apply --3way --check` passes); prints the `git am` and `git reset --keep` commands. Without the base and head (a cloud head handed to a local clone) it says so: content checked per path, ancestry not proven. `--applied` checks the "after" blobs. | Nothing. |
| `npm run atlas:receipt --prefix apps/site -- --run <tools/e2e/.e2e/<target>/<run>> --out <dir> [--revision <sha>] [--require-clean]` | Transfers one TesterArmy run: refuses it unless the wrapper qualified it and launched the SDK (`end.json`), its files still match `files.json` (`verifyEvidenceFiles`), its evidence, qualification, wrapper and source snapshots (`source-start.json`, `source-end.json`) name the same revision and working tree, and nothing failed; copies its files once and writes a receipt that references them by sha256. A filtered run lists its exclusions. | Under the real path of `<dir>` only, which must not overlap the run; an existing copy must hold the same bytes. |
| `npm run atlas:gallery --prefix apps/site -- --pages <pages.json> --out <review.html> [--site-url http://localhost:8000] [--manifest <file>] [--title <text>]` | Builds one local review page for a batch: a choice per page (1 to 24, `[{ id, slug, name, mood }]`, example `scripts/atlas-review-pages.example.json`, each checked against the catalogue), each published language of the symbols (the catalogue's slug under the language's symbols path), the real site sizes 2560×1440 and 390×844 in a scaled iframe, the top, the side illustration (`#meaning`, unavailable on a phone) and the scenes (`#scenes`), and each page's roles from the manifest. The page fills its frame exactly at both sizes. | The one HTML file given, at its real path: never in `docs/` or `docs-src/`, even through a folder link, junction or alias, and never through a link or hard link. |

`npm run atlas:tools:test --prefix apps/site` runs their journeys on temporary fixtures, the rollout
report's included.

### Rollout of the 240 symbols

`npm run symbols:rollout --prefix apps/site -- --out <dir> [--manifest <assets.json>] [--evidence-root <dir>]`
writes `<dir>/symbol-rollout.json` and `<dir>/symbol-rollout.csv`, the same bytes for the same
inputs (the JSON lists the sha256 of every file it reads and of the engine). The registry
`docs-src/config/symbol-rollout.json` names every catalog id once with its lot (`null` until it
joins one) and holds the only records of what a person decided: QA and approval of one language on
`desktop` or on `mobile`, publication of one language (`all`), each with a verdict (`accepted` or
`changes`), a date, an evidence file with its sha256 and the `source` the report gave for that
symbol and language when it was qualified: the sha256 of its content (catalog and interpretation),
its atlas words (copy, scene mapping and pilot config), its paintings (manifest entry) and the engine
(the generator and the motion scripts). Everything else is read from the repository: the catalog of each published
language, the atlas words of `symbol-atlas-locales.json`, the published card each scene names, and
the eight paintings of the assets manifest (`complete`, `incomplete` with the missing roles,
`same-image-scenes`, or `manifest-unavailable` without it; the tiger keeps its own engine). A stage
reads `accepted` only when its latest record says so, its evidence file still has that sha256 and
the language's current source is the one recorded; an accepted record whose source has changed
since reads `stale` and stays as history, with the parts that changed among the reasons, until a new
QA records the new source. Otherwise a stage reads `not-recorded`, `changes-requested`,
`evidence-missing` or `evidence-mismatch`. A
screenshot or a build lying around never sets a stage. A symbol is `done` when every language has
its catalog, its words, its cards and its three accepted stages and its paintings are complete,
`in-progress` once it is in a lot or equipped, `remaining` otherwise; its reasons list what is
missing. It reads only; it does not replace the owner's spreadsheet.

Pack rules, checked before anything is written: the symbol exists in the catalogue (and, once
allowlisted, keeps its three scenes); exactly the eight roles `hero`, `portrait`, `plate`,
`scene-<id>` ×3, `layer`, `accent`; relative paths inside the input root, no links; each file's
sha256; an orientation range per role (sources keep their native proportions); a width at least
the largest fixed served size; real alpha for `plate`, `layer` and `accent` (2 % to 99.9 % fully
transparent pixels, at least 0.1 % translucent), none for the others. Served sizes: hero 400, 800,
1200 and native; portrait 480, 800 and native; plate 700 and native; scenes 320 and 640; layer and
accent 480 and 960; a size above the source is left out. The manifest delta keeps each source's
native size. A role whose source, recipe and encoder are unchanged is neither re-encoded nor
rewritten; files are never deleted, and outputs no longer referenced are listed as superseded.
`--merge-manifest` is refused for a symbol not allowlisted in `symbol-atlas-pilots.json`, since the
site build would refuse the manifest, and with an `--output-root` other than `docs-src/static`: the
manifest names site URLs, so it only describes files written where the site serves them.

Where they write: every destination (the images, `.cache/atlas-pack/`, the `--receipt` file, the
shared manifest, each copy of a run) is checked from its root down before the first write. Each
existing part must be a real folder of that name: a symbolic link, a Windows junction or an alias on
the way is refused. The pack's root is the repository. The receipt's root is the real path of
`--out`, resolved first so that a link to it cannot hide an overlap with the run.

Defects these journeys caught while being written: two imports within the same second gave the
same default receipt name, so the second was refused (the name now carries milliseconds and a
random suffix); a plain `git apply --check` accepts a patch over a file changed locally away from
its hunks, so the handoff compares each path's blob with the envelope instead; a `.cache` link
let the pack write its cache and receipt outside the repository, a staging `--output-root` let it
merge site URLs for files the site does not serve, an output folder reached through a link landed
inside the run it copied, an envelope announcing the wrong base passed while that base was
in the clone, and a folder alias to `docs/` let the review gallery write into the site (its check
was lexical). In a browser, the gallery's 2560 frame overflowed the stage by its two 24px paddings
less the 2px border it already deducted, so 46px of the page were cut off. Its fit now deducts both
paddings and the frame's borders.

## Local Android prerequisites

Use the Node/Deno versions from `mise.toml` and install dependencies in the actual
checkout. A local Android Release build also requires **JDK 17** and an Android
SDK including CMake (AGP defaults to 3.22.1). Long Windows paths need a Ninja
with long-path support: verify the actual `cmake/<version>/bin/ninja --version`,
not only the CMake version. The SDK's CMake 3.30.5 on this host still shipped
Ninja 1.10.2. Use an owned SDK/toolchain copy for experiments; do not replace a
shared installation. The benchmark records the actual toolchain used.
`JAVA_HOME` takes precedence over Java on PATH; the runner verifies that
executable before version synchronization, device access, prebuild or Gradle.
A missing, incompatible or unverifiable Java stops immediately with instructions
for setting `JAVA_HOME`. The runner does not install or switch JDKs automatically.

On macOS, select an already-installed JDK 17 with
`export JAVA_HOME="$(/usr/libexec/java_home -v 17)"`, then verify
`"$JAVA_HOME/bin/java" -version`. On other hosts, set `JAVA_HOME` to the installed
JDK 17 directory. `ANDROID_HOME` or `ANDROID_SDK_ROOT` locates the SDK; the shared
`android-tooling.js` resolver also checks standard host SDK locations for ADB.
Use `ADB_BIN` for an explicit executable.
Check `gh --version` before CLI-based PR operations, or use the connected GitHub
capability. Keep absolute tool paths in local configuration.

Inspect the canonical runner with:

```sh
mise exec -- npm run android:release:local -- --help
```

For local Android iteration, use `npm run android:iterate:local -- --abi x86_64`
in the app's isolated native checkout (select the actual target ABI). It still
runs Expo prebuild. SDK 58 recreates native folders by default; only a passed
matching context uses `--no-clean`. Its first or invalidated build keeps the clean Release flags;
only a previously successful identical native/profile/dependency/environment
context uses Gradle's build cache and daemon without `:app:clean`. The JS/assets
bundle task always reruns, so an asset-only edit cannot leave an old bundle
(React Native's declared file inputs cover JS/TS only). Native compilation can
still be reused. RN Gradle retains its native `--reset-cache` bundle option;
the [measured Metro transform reuse](../doc_web_interne/docs/qa/mobile-ci-android-metro-2026-10-18.md)
belongs to the web validation harness.
A failed/interrupted build,
changed context or corrupt state forces a clean build. The checkout lock refuses
concurrent native builds; verify that the recorded PID and its build descendants
have stopped before removing a stale lock.
The result ends in `-iteration.apk` and cannot qualify a TesterArmy Release
receipt. `android:release:local` keeps its clean/no-cache/no-daemon defaults.
Do not combine `--incremental` with `--reuse-native-project`. Installation is
still explicit and keeps the existing device, package, signing and data guards.

Requested native implementation/QA includes its necessary local build, compatible
installation on an owned disposable QA target and isolated Expo native generation.
Check SDK/profile inputs first; reuse a compatible existing `android/` through
`--reuse-native-project`, otherwise generate explicitly with `--no-install` in
the isolated worktree and retain its input identity. Do not ask again for that
same local scope or regenerate another task's checkout. Never run a build merely
to repair tool discovery. Personal data, destructive installs, new providers/budgets,
EAS and Store/publication remain separate boundaries. Distribution builds use
`release:build`; local debug-signed APKs do not qualify a Play update.

## Maintenance rules

For a shell-created task checkout, use the existing primary repository as the
source instead of making another clone in `/tmp` or Documents:

```sh
npm run workspace -- prepare --repo "$PWD" --task example-check --owner-pid $$ --regenerable node_modules
npm run workspace -- status --repo "$PWD" --task example-check
npm run workspace -- release --repo "$PWD" --task example-check --owner-pid $$
```

The owner PID must belong to the process coordinating the work for its entire
duration. A live different owner is refused; a dead owner can be reclaimed.
Preparing the same task and commit reuses its path. A conflicting commit or an
unmanaged destination never creates another numbered copy. Receipts sit beside
the checkout and record its device, inode and birth time. macOS numbers volumes
again at boot, so a new device number alone is not a replacement: the same inode
and birth time keep the workspace, and the receipt takes the new number. A receipt
written before birth times were recorded is accepted after a reboot only for the
same inode, already present when the receipt was last written. A directory
replaced at the same path (`WORKSPACE_DIRECTORY_REPLACED`) is refused rather than
adopted or removed. Release is idempotent and only removes an unchanged, clean checkout
whose ignored files are covered by the explicitly declared regenerable paths.
Other ignored data, including local credentials and unique evidence, blocks release
and stays intact. Keep source work and commits until delivered or independently
preserved; this command is not a WIP archive. `retain` records an explicit request
to keep a workspace for inspection and blocks accidental reuse until released.
App-managed worktrees keep their own archive lifecycle. The isolated `verify:pr`
and release engine already cleans its own copies and is unchanged.

`WORKSPACE_LOCK_OWNER_MISSING` means an interrupted writer left a lock without
its ownership receipt. The command preserves both lock and workspace. Inspect
the coordinating process and any writers before removing only that empty lock
directory; never remove the workspace or its receipt to bypass the refusal.

The helper inherits npm/pnpm's configured caches. It never creates a second
global cache or shares `node_modules` between native checkouts. The install
benchmark's intentionally cold caches are an isolated exception, cleaned with
its owned scratch; see [site measurements](site-performance/README.md).

`verify:pr` and release verification run the four independent root type/lint
checks together, under one machine lock where `flock` is available, and retain
one result per check. A failure waits for the siblings to finish, then blocks
the next stage. Other checks stay sequential. The generated shared route
declaration uses an atomic replacement so both typechecks can read it safely.
Only TypeScript's redundant `import/namespace` lint rule is disabled; JavaScript
imports and React Compiler rules keep their checks. Site-only changes continue
to reuse type/lint proofs whose inputs have not changed.

`npm run test:verify-local` runs the same common cases on every OS, including
Linux, macOS and Windows behavior through process/filesystem adapters. Common
tests never select or omit assertions from the host OS. On Linux the runner
also announces and runs the native process-group, `flock`, `setsid` and POSIX
permission qualification. These tools are prerequisites of that extra suite.
`npm run test:tooling:native` additionally exercises real publish signals and
descendant cleanup on Linux. Native evidence stays separate from the
portable contracts; simulated Windows cases do not qualify Windows ACLs.
On Windows, the CI contract suite needs Git Bash and a real Python 3 command
on PATH; the Microsoft Store `python3` alias is not an interpreter. The Python
tests resolve Bash to an absolute executable, avoiding Windows' WSL launcher.

For a short live site loop, see [`docs:dev -- --symbol=tiger --lang=fr`](../docs-src/README.md#iterate-quickly-on-one-generated-page).
Always run a full site build before trusting site-wide checks after a partial preview.

- Reusable build and check entrypoints stay in `scripts/` and are wired from
  `package.json`.
- Shared, testable helpers stay in `scripts/lib/`.
- `docs-src/` and shared `data/` are the editable site sources. No active tool
  may patch generated `docs/` HTML directly.
- `docs/` and `docs-src/static/version.txt` are build artifacts ignored by Git.
  Never force-add them; validate them locally with `docs:build` and `docs:check`.
- One-time migrations belong in `scripts/archive/` and must not have an npm
  command.
- New recurring generators use `build-*`, `generate-*`, `check-*`, or
  `audit-*`; avoid permanent `fix-*` commands.
- Active scripts must pass `npm run lint:scripts` with zero warnings.
- Use the Node version in `.nvmrc`. Cloudflare previews use the locally pinned
  Wrangler package; APK wrappers invoke the exact `eas-cli@25.1.1` version via
  `npx`, as recommended by Expo Doctor.
- Destructive or publishing commands need an explicit target and must never
  masquerade as a successful no-op help command.
