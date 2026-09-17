# Site tooling package: first isolation step

## Decision

The marketing site can install its build and validation dependencies through
`apps/site/package.json`, independently of the Expo application. Editable content
stays in `docs-src/`, shared catalogs in `data/`, generators in `scripts/`, and
generated output in ignored `docs/`. Public routes and product behavior are not
part of this change.

The site owns explicit dependencies on Sharp, esbuild, image-size, Motion and
Lenis. The latter two are dynamically imported by the landing experience. In
particular, image-size must no longer rely on being installed transitively by
Metro. Generator imports resolve through the site package, so running from the
repository root does not accidentally require an Expo installation.

The root package keeps a local development dependency on the site package for
existing `npm ci` and `docs:*` commands. Its existing Sharp/esbuild dependencies
remain because other root tools still consume them. There is no npm workspace
migration in this step; native package alignment and autolinking need their own
qualification before restructuring Journal or Lucid.

## Installation and compatibility

From the repository root:

```sh
npm ci --prefix apps/site
npm run build --prefix apps/site
npm run check --prefix apps/site
```

These commands need the repository sources but do not need root `node_modules`.
Existing root commands remain supported after root `npm ci`.

The standalone and root lockfiles must both be refreshed when site dependencies
change. Optional browser SEO audits and deployment tooling retain their current
root installation requirements.

## Delivery boundary

This change provides an isolated installation path. It does not switch existing
CircleCI or Cloudflare installation commands, apply live watch filters, or claim
provider build savings. Those changes belong to the separate CI optimization
task. Unknown `apps/site/*` paths currently trigger all CI surfaces conservatively.

Next architecture decisions remain separate: native package extraction after
device qualification, genuinely shared packages with identified consumers, and
a versioned Lucid sync protocol for local confirmations and Atlas preferences.
See `NOCTALIA-LUCID-SYNC-V1-COMPATIBILITY.md` for the existing compatibility boundary.

## Acceptance evidence

Validated on macOS with Node 24.19.0 against base `e09e99f9b`:

- Standalone `npm ci` installed 17 packages; build and check passed with no root
  `node_modules`. The 65 dependency entries in its lockfile preserve root versions
  and integrity values, including nested resolutions.
- A fresh root installation installed 1,836 packages. Root build/check passed
  with no `apps/site/node_modules`, exercising the compatibility path.
- Six focused Jest suites passed (36 tests): image generators, cache and renderer.
- Independent code review passed with no actionable findings.
- Both builds produced 3,900 public files. The Lenis/Motion chunks have identical
  bytes but different hashed names because their resolution paths differ. After
  normalizing those names and the resulting asset version, all files match,
  including the sitemap. This is content parity, not strict byte parity of HTML
  containing cache URLs. `version.txt` contains the corresponding asset version.
- Image cache changes affect input signatures only; image bytes and output
  inventory are unchanged. Generated experience chunks remain tracked source
  inputs under `docs-src/static/`; ignored `docs/` is not committed.

Provider installation savings and Linux validation remain outside this local
evidence. No provider configuration was changed.
