# Zod v3 compatibility and bounded validation

MIT v3 source is copied unchanged from zod 4.6.7's `v3/` directory except for
the two early-return guards in `v3/types.js` and `v3/types.cjs`. LICENSE is retained.
Existing v3 consumers retain `record(valueSchema)`, effects, error maps and
JSON Schema conversion. Explicit v4 entry points use the fixed zod 4.6.7 package.

GHSA-mrhx-c7xc-m3w5 was fixed in upstream v4, but the v3 distribution still
visits every element of an oversized constrained collection. After recording
the existing size error, this backport aborts oversized `array.max`,
`array.length` and `set.max` before copying/visiting elements (sync and async).
Unconstrained collections and valid collections retain their behavior.

Both app packages install this fork as `zod`, including its `zod/v3` entry point.
Explicit overrides give consumers requiring the v4 root API upstream 4.6.7;
their v3 children retain this fork. The pinned `zod-patched` alias supplies
the explicit v4 subpaths without changing the root v3 API.
Tests cover CJS, ESM, both entry points and legitimate v3/JSON Schema consumers.
Run the root dependency-security tests for both installations. Any upstream
upgrade must recheck the v3 subpath; its parent version alone is not proof.
