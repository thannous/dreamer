# Noctalia — dependency boundaries (TI-527)

## Executable sources

`.circleci/dependency-consumers.tsv` is the exact shared-input map consumed by
`classify-changes.sh`. Classification tests iterate every row, so adding a mapped
input automatically adds its gate fixture. The Node boundary tests validate unique
paths, existing files, graph names, consumers and the concrete Android execution
chain. This document explains the map; it does not duplicate its path list.

| Graph | Current contract | Validation |
| --- | --- | --- |
| Business imports | Lucid owns observations and training state; Meditation owns its runtime. The explicitly pure primitives are `dateUtils`, `circuitBreaker`, `authValidation`. | `npm run boundaries:check`; root quality always runs it, Meditation quality runs its own subset using its installed TypeScript. |
| Build | Journal and Lucid use the root installation, also consumed by site generators, Node database contracts and Edge Functions lint. Meditation keeps its own package and lockfile. The Node version map covers all Node jobs, including the Node install/lint portion of Edge Functions; Deno itself stays separately pinned. The executor image pins the effective CI Node version, so changing `.nvmrc` selects compatibility checks but does not change that image. | Mapped consumers; no workspace or dependency version changes. |
| Content/contracts | Verified common dream content reaches root mobile and generated site. Product analytics reaches root mobile and the Edge parity contract. | Map fixtures plus existing site/contract checks. Unknown data selects all surfaces. |
| Execution | Root Expo runner imports the Android lock; six Meditation E2E commands invoke that same lock. | Both application quality gates selected for lock changes. These jobs do **not** constitute device execution or device validation. |

The remaining classifier rules describe app-only roots, site generators, backend
runtime and database contracts. Unknown execution scripts now select all surfaces;
known Jest tooling remains root-only. Unknown global inputs, deletions and renames
remain conservative. Missing/unusable diff bases retain TI-517 exhaustive Jest
fallback. `docs-src` is editable site source and runs site-build; generated `docs`
is ignored output. Internal Markdown documentation remains a no-op.

`supabase/types` currently has no runtime imports in root apps, Meditation or Edge
sources (inspection at this change); it retains database-contract classification.
New shared contracts must add their verified consumers to the map. This is not a
claim that every backend schema change can be inferred from TypeScript imports.

## Import rules and limits

The TypeScript AST checker reads literal imports, exports, `require`, dynamic
imports and import-equals, including type-only imports. Relative paths normalize
before checks; `@/` belongs to the containing root or Meditation installation.

- Lucid domain, routes, components, hooks and trainer context cannot directly import
  Journal providers, dream hooks, offline sync queue, storage, analysis or
  `supabaseDreamService` adapters.
- Lucid domain and the three explicitly pure primitives cannot import app routes,
  components, hooks or contexts.
- Meditation runtime roots cannot import outside their own application directory.
  Tooling and configuration are deliberately outside this rule; the shared Android
  lock is an execution dependency, not a business dependency.

No temporary exception is needed. Shared neutral types and Lucid notification
contracts remain permitted. Failures print `consumer:line -> target [rule]`.
The scope is these defined direct import boundaries, not a proof of all transitive
runtime behavior: computed module strings, native integrations and new aliases
require review. Tests are excluded from product import rules because fixtures may
intentionally model another app. TI-518 runtime tests establish absence of Journal
pipeline mounting and calls at the instrumented boundaries; they do not measure
real network traffic. The static checker complements those tests.

## Local verification

Mobile-only script changes in `package.json` and changes confined to the two
mobile jobs in `.circleci/continue.yml` retain mobile checks without selecting
site/backend jobs. Dependencies, installation hooks, shared executors, workflows,
unknown configuration shapes and site jobs retain conservative shared validation.
`test:file` is shared with Edge contracts and is not eligible for the mobile-only exemption.
Routing scripts/map/tests run their regression checks through Noctalia quality.

The root Vercel `ignoreCommand` skips preview builds of the legacy web app
(`npm run build:web`, output `dist`). Production and unknown environments retain
the build. The marketing site uses its separate Cloudflare pipeline. Existing
deployments and checks are not cancelled retroactively.

- `npm run boundaries:check`
- `node scripts/check-monorepo-boundaries.js --meditation`
- `npm run test:node -- --runInBand --watchman=false scripts/check-monorepo-boundaries.test.js`
- `bash .circleci/tests/classify-changes.test.sh`
- `python3 .circleci/tests/shared-build-impact.test.py`
- `bash .circleci/tests/fallback-jest.test.sh`

Native smoke, CI completion and deployment remain separate evidence layers.
