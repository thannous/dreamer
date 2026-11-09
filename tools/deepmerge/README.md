# deepmerge security backport

MIT source: deepmerge 4.3.1, `dist/cjs.js` and `index.d.ts`,
https://github.com/TehShrike/deepmerge. LICENSE is retained.

GHSA-gcqx-w48m-w2h4 has no upstream fixed release. All three writes in
`mergeObject` define own data properties instead of invoking inherited setters.
Objects keep their ordinary prototype and legitimate own `__proto__` data is
preserved, including null-prototype inputs. No merge option or array policy changes.

The root and Meditation overrides install this package. Run
`node --test scripts/dependency-security.test.mjs` at the root, then repeat with
`DEPENDENCY_SECURITY_PROJECT=meditation`. Remove this fork only when an upstream
replacement passes those attack and compatibility cases.
