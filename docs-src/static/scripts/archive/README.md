# Archived Docs Scripts

Historical docs-site migration scripts. The active docs scripts remain one level up, especially:

- `check-site.js`
- `generate-symbol-pages.js`

`fix-eeat-signals.js` and `fix-title-lengths.js` are retained here only for
historical reference. Their results were absorbed into `docs-src/`, shared
data, and the maintained generators.

Prefer adding new reusable tooling to root `scripts/`. Never add a command
that mutates generated `docs/` output directly.
