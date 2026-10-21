# Local braces security fix

MIT-licensed source copied from the installed `braces@3.0.3` npm release.
The original copyright and license are retained in LICENSE. This private fork
is not an upstream release and is never published to npm.

[CVE-2026-93687 / GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
has no upstream patched release as of 21 October 2026. Deep brace/parenthesis
patterns can exhaust recursive AST walkers despite the existing character cap.
The local change adds a fixed maximum AST depth of 128, rejects excessive parser
stack depth, and bounds each actual recursive step in compile, expand and
stringify, including caller-supplied ASTs. Rejection is an explicit SyntaxError with code
`ERR_BRACES_DEPTH`; options cannot remove the ceiling. Parent and previous-node
links used by the upstream parser are not descendant edges. No prewalk consumes
one-shot iterators, and expansion/stringification share the current depth.

Overrides select this package for the existing braces 3 dependency. It preserves
fast-glob and all Next.js lint rules, including monorepo roots, absolute paths
and symlink directories. Published glob replacements tested during diagnosis
changed those behaviors, so they were not adopted.

The original character and range limits remain in force. This is a fix for
recursive nesting, not a general resource bound for every possible regex or
brace expansion. Remove this fork when an upstream fix passes the regression
tests in `scripts/dependency-security.test.mjs`.

The test also compares installed files with this tracked source, so an isolated
verification using linked node_modules cannot silently test a different fork.
