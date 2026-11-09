# stream-json 1.x security backport

BSD-3-Clause source: stream-json 1.9.1 (LICENSE retained). Expo Atlas uses its CommonJS
`Disassembler` and `Stringer` entry points; a direct 3.x replacement changes that API.

- GHSA-mjw6-4jj6-33hc: both Assembler writes, including reviver mode, define
  own data properties. JSON `__proto__` remains data, as with `JSON.parse`.
- GHSA-528h-pc64-c93x: FilterBase rejects paths deeper than 1024 or longer
  than 16384 characters before repeatedly constructing paths. The length bound
  also covers shallow arrays beneath a long key. Normal
  Pick/Ignore/Filter/Replace behavior and stream-chain 2 interoperability remain.
- GHSA-hqr4-qq8f-hg3x concerns the JSONC parser; 1.9.1 contains no JSONC parser
  or comment accumulation path. No comment-parsing API was added to this fork.

`node --test scripts/dependency-security.test.mjs` exercises prototype keys
with and without a reviver and depth rejection for all four filter classes.
