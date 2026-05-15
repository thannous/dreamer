# Scripts

Keep this directory for reusable project tooling: build commands, checks, release gates, exports, and shared libraries.

Rules of thumb:

- Build and check entrypoints stay in `scripts/` and are wired from `package.json`.
- Shared helpers stay in `scripts/lib/`.
- SEO or content migrations that were only meant to run once go in `scripts/archive/seo-one-shots/` or beside the export/report they operated on.
- New recurring docs generators should use action names like `build-*`, `generate-*`, `check-*`, or `audit-*` instead of `fix-*`.
