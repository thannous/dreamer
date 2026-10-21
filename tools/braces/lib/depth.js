"use strict";

// This fixed ceiling applies at each actual recursive step, including
// caller-supplied ASTs, and cannot be disabled with parser options.
const MAX_DEPTH = 128;

function assertDepth(depth) {
  if (!Number.isInteger(depth) || depth < 0 || depth > MAX_DEPTH) {
    throw Object.assign(new SyntaxError(`Brace pattern exceeds maximum AST depth (${MAX_DEPTH})`), {
      code: "ERR_BRACES_DEPTH"
    });
  }
}

module.exports = { assertDepth };
