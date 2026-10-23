# Repository layout and artifact hygiene

[AGENTS.md](../../AGENTS.md) defines authority and safety. The
[task index](README.md) locates current implementations and procedures. This map
uses existing directories; it does not move historical evidence or grant permission
to delete personal data, generated work or old reports.

## Active applications and shared source

| Area | Source of truth |
| --- | --- |
| Dreamer | `app/` Expo Router screens; `components/`, `hooks/`, `context/`, `lib/`, `services/` and `constants/` hold shared implementation. |
| Lucid | Root package and its own `routes/lucid/` Router root (`routes/lucid/lucid/`); [scope and wellbeing safeguards](../../specs/noctalia-lucid-trainer.md). Dreamer's ritual opens this app. |
| Meditation | Separate `apps/meditation/` package and lockfile; read its [local AGENTS.md](../../apps/meditation/AGENTS.md). |
| Backend | `supabase/functions/`, `supabase/lib/`, tracked migrations and database contract; [architecture index](architecture/README.md). |
| Site | Editable `docs-src/`, canonical `data/` catalogs and generator code in `scripts/`; [source guide](../../docs-src/README.md). |
| Tests/tooling | `tests/`, colocated `__tests__/`, `tools/e2e/`, root scripts and app-local tests; use their existing package commands. |

Product assets under `assets/`, app-local assets and `docs-src/static/` are source
inputs when the app/configuration or site generator consumes them. A PNG, audio
file or generated-looking filename does not establish obsolescence. Prove its
consumer graph, including routes, platform variants, dynamic imports and build
configuration, before removing it. Canonical symbol catalogs live in `data/`;
the site build copies them into `docs/data/`. Edit the catalog source.

## Generated and local output

`docs/` is ignored generated site output. Rebuild it from `docs-src/`; never hand-edit
or commit it. Other local build outputs include `dist/`, `web-build/`, Expo/native
build state, caches, coverage and tool output. Use the existing ignored location
and runner lifecycle rather than a new tracked scratch directory.

`ios/` and `android/` are local generated native projects in the managed workflow.
Requested native work may generate them only in its owned isolated worktree after
SDK/profile checks; preserve the primary checkout and other tasks' projects.
A generated directory can still contain personal or task-owned work: this layout
is not cleanup authorization.

## Private QA and durable evidence

New task artifacts, captures, exports and compact receipts belong in the canonical
ignored `outputs/<task>/` directory. Existing runners retain their own canonical
locations, such as `test-results/` and `tools/e2e/.e2e/`; reference their results
instead of copying complete media into `outputs/`. Keep personal data, credentials and private formative feedback
out of Git. Keep the exact build/source identity, verdict, useful failure artifact
and rerun command in one canonical result; link it rather than copying complete
media archives or rehashing unchanged evidence for each handoff.

A reusable runbook belongs under `doc_web_interne/docs/` or the relevant source
package. Durable redacted QA summaries and deliberately selected supporting
artifacts may be tracked under `doc_web_interne/docs/qa/` or an existing work-package
location. Review them for private content first. Record date, source/build,
environment, command, result and limits; a historical pass is not current proof.

Some older files under `outputs/`, `screenshots/` and `tmp-stage/` are tracked
historical evidence. Their exact retained paths are listed in
[data/repository-hygiene-baseline.json](../../data/repository-hygiene-baseline.json).
This is a path-specific tracking exception, not permission to commit neighboring
files. New private task output stays ignored under `outputs/`; do not introduce
new `output/`, `screenshots/` or `tmp-stage/` task roots. New durable
redacted evidence uses the documentation locations above; an additional legacy
exception needs explicit review. Preserve old factual outcomes and useful history;
age alone does not justify deletion, and this change does not mass-move them.

## Local configuration and secrets

Do not track `.env`, `.env*.local`, `CLAUDE.local.md`, `settings.local.json`, auth
sessions or private credentials. Existing ignored machine settings and skill
installations remain local. Do not introduce a portable example unless there is
a concrete shared need and it contains only placeholders or nonsecret defaults.
Tracked runtime profiles such as `.env.mock` and purposeful `.env*.example` files
are source configuration; their values must be safe to expose. Every
`EXPO_PUBLIC_*` value reaches the client bundle.

An optional `.codex/environments/environment.toml` may delegate desktop Run to
`script/build_and_run.sh`; it is not distributed. Agent skills under hidden machine
directories are also local resources. See
[runtime procedures](repository-operations.md#runtime-and-prerequisites) and
[requested media](repository-operations.md#requested-media) for their use.

## Check the tracked paths

From the repository root:

```sh
node scripts/check-repository-hygiene.cjs
node --test scripts/check-repository-hygiene.test.cjs
```

The check inspects Git-index paths and the exact historical baseline. It refuses
new local settings, generated/temp/raw QA output in tracked locations while
allowing product sources and durable redacted documentation evidence. It does
not inspect file contents or replace secret scanning and a privacy review. The
baseline preserves existing records; it is not a general allowlist for their
directories. Keep existing publication allowlists and runner guards in force.
