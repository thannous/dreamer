# Archived docs-output migrations

These scripts modified generated files under `docs/` during historical SEO and
site migrations. Their durable results now live in `docs-src/`, shared data, or
the maintained site generators.

They are intentionally not exposed through `package.json` and must not be used
as part of the current build. New recurring tooling must read or update source
files, then use `npm run docs:build` to regenerate `docs/`.
