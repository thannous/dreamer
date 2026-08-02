'use strict';
/* global __dirname, describe, expect, it */

// The client privacy guard (lib/productAnalytics.ts) and the ingestion route
// (supabase/functions/api/routes/analytics.ts) each keep their own copy of the
// per-event property schema, and neither can import the other: the client file
// pulls in React Native/Expo modules, the route is Deno with `jsr:` imports.
// Drift is therefore silent — the client accepts an event, the server rejects
// it, and the event is dropped. This test reads both schemas from source and
// compares them entry by entry so that drift fails CI instead.
//
// Validators are compared by the values they allow: `oneOf(...)` (and a
// `value === <literal>` arrow) become a sorted set of typed literals, and any
// other predicate becomes its normalized source body. Bodies must therefore
// stay textually equivalent across the two files even when the alias names
// differ (`nullableIdentifier` vs `nullableShortString`); reconciling a
// deliberate refactor by hand is the intended cost.

const fs = require('fs');
const path = require('path');

const QUOTES = new Set(["'", '"', '`']);
const CLOSERS = { '{': '}', '(': ')', '[': ']' };

function findStringEnd(source, start) {
  const quote = source[start];
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === '\\') {
      index += 1;
      continue;
    }
    if (source[index] === quote) return index;
  }
  throw new Error(`Unterminated string literal at index ${start}`);
}

function stripComments(source) {
  let output = '';
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (QUOTES.has(char)) {
      const end = findStringEnd(source, index);
      output += source.slice(index, end + 1);
      index = end + 1;
      continue;
    }
    if (char === '/' && source[index + 1] === '/') {
      const newline = source.indexOf('\n', index);
      index = newline === -1 ? source.length : newline;
      continue;
    }
    if (char === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }
    output += char;
    index += 1;
  }
  return output;
}

// Returns the text between `source[openIndex]` and its matching closer.
function sliceBalanced(source, openIndex) {
  const open = source[openIndex];
  const close = CLOSERS[open];
  if (!close) throw new Error(`Expected a bracket at index ${openIndex}, found "${open}"`);
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (QUOTES.has(char)) {
      index = findStringEnd(source, index);
      continue;
    }
    if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex + 1, index);
    }
  }
  throw new Error(`Unbalanced "${open}" starting at index ${openIndex}`);
}

function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (QUOTES.has(char)) {
      const end = findStringEnd(body, index);
      current += body.slice(index, end + 1);
      index = end;
      continue;
    }
    if (char === '{' || char === '(' || char === '[') depth += 1;
    else if (char === '}' || char === ')' || char === ']') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

function findDeclarationValue(source, constName) {
  const declaration = new RegExp(`(?:^|\\n)const ${constName}\\b[^=\\n]*=\\s*`);
  const match = declaration.exec(source);
  if (!match) throw new Error(`Could not find "const ${constName}" declaration`);
  const start = match.index + match[0].length;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (QUOTES.has(char)) {
      index = findStringEnd(source, index);
      continue;
    }
    if (char === '{' || char === '(' || char === '[') depth += 1;
    else if (char === '}' || char === ')' || char === ']') depth -= 1;
    else if (char === ';' && depth === 0) return source.slice(start, index).trim();
  }
  throw new Error(`Unterminated "const ${constName}" declaration`);
}

function normalizeLiteral(raw) {
  const token = raw.trim();
  if (QUOTES.has(token[0]) && token[token.length - 1] === token[0] && token.length >= 2) {
    return `s:${token.slice(1, -1)}`;
  }
  if (token === 'true' || token === 'false') return `b:${token}`;
  if (token === 'null') return 'null';
  if (/^-?\d[\d_]*(?:\.\d[\d_]*)?$/.test(token)) return `n:${token.replace(/_/g, '')}`;
  throw new Error(`Unsupported literal "${token}" in an analytics property schema`);
}

function normalizePredicate(param, body) {
  return body
    .replace(new RegExp(`\\b${param}\\b`, 'g'), '_')
    .replace(/\s+/g, ' ')
    .trim();
}

const LITERAL_PATTERN = /'[^']*'|"[^"]*"|true|false|null|-?\d[\d_]*(?:\.\d[\d_]*)?/;

function matchArrow(expression) {
  const arrow = /^\(?\s*([A-Za-z_]\w*)\s*(?::[^)=]*)?\)?\s*=>\s*([\s\S]+)$/.exec(expression);
  if (!arrow) return null;
  return { param: arrow[1], body: arrow[2] };
}

// Reduces a validator expression to what it accepts, so that equivalent
// validators compare equal across the two files regardless of how they spell it.
function describeValidator(expression, aliases, resolving = []) {
  const trimmed = expression.trim();

  if (/^[A-Za-z_]\w*$/.test(trimmed)) {
    if (resolving.includes(trimmed)) {
      throw new Error(`Circular validator alias "${trimmed}"`);
    }
    if (!aliases.has(trimmed)) {
      throw new Error(`Unknown validator alias "${trimmed}"`);
    }
    return describeValidator(aliases.get(trimmed), aliases, [...resolving, trimmed]);
  }

  if (/^oneOf\s*\(/.test(trimmed)) {
    const args = splitTopLevel(sliceBalanced(trimmed, trimmed.indexOf('(')));
    if (args.length === 0) throw new Error(`Empty oneOf() in "${trimmed}"`);
    return { allowedValues: args.map(normalizeLiteral).sort() };
  }

  const arrow = matchArrow(trimmed);
  if (arrow) {
    // Only a body that is exactly `param === <literal>` enumerates a value;
    // anything longer (`param === null || ...`) is a predicate.
    const equality = new RegExp(
      `^${arrow.param}\\s*===\\s*(${LITERAL_PATTERN.source})$`
    ).exec(arrow.body.trim());
    if (equality) return { allowedValues: [normalizeLiteral(equality[1])] };
    return { predicate: normalizePredicate(arrow.param, arrow.body) };
  }

  throw new Error(`Unsupported validator expression "${trimmed}"`);
}

function collectValidatorAliases(source) {
  const aliases = new Map();
  const declaration = /(?:^|\n)const ([A-Za-z_]\w*)\b[^=\n]*=\s*/g;
  let match = declaration.exec(source);
  while (match) {
    const name = match[1];
    // `oneOf` is the schema DSL itself, never referenced as a bare validator.
    if (name !== 'oneOf') {
      try {
        aliases.set(name, findDeclarationValue(source, name));
      } catch {
        // Unrelated top-level constants are not validators; ignore them.
      }
    }
    match = declaration.exec(source);
  }
  return aliases;
}

function parseEventNames(source, constName) {
  const value = findDeclarationValue(source, constName);
  const open = value.indexOf('[');
  if (open === -1) throw new Error(`"${constName}" does not contain an array literal`);
  return splitTopLevel(sliceBalanced(value, open))
    .map(normalizeLiteral)
    .map((literal) => literal.replace(/^s:/, ''));
}

// { [eventName]: { [propertyKey]: descriptor } }
function parsePropertySchemas(source, constName) {
  const aliases = collectValidatorAliases(source);
  const value = findDeclarationValue(source, constName);
  const open = value.indexOf('{');
  if (open === -1) throw new Error(`"${constName}" does not contain an object literal`);

  const schemas = {};
  for (const entry of splitTopLevel(sliceBalanced(value, open))) {
    const event = /^([A-Za-z_]\w*)\s*:\s*([\s\S]+)$/.exec(entry);
    if (!event) throw new Error(`Unsupported schema entry "${entry}" in ${constName}`);
    const [, eventName, schemaLiteral] = event;
    const schemaOpen = schemaLiteral.indexOf('{');
    if (schemaOpen === -1) throw new Error(`Event "${eventName}" has no property object literal`);

    const properties = {};
    for (const propertyEntry of splitTopLevel(sliceBalanced(schemaLiteral, schemaOpen))) {
      const keyed = /^([A-Za-z_]\w*)\s*:\s*([\s\S]+)$/.exec(propertyEntry);
      const shorthand = /^([A-Za-z_]\w*)$/.exec(propertyEntry);
      if (keyed) {
        properties[keyed[1]] = describeValidator(keyed[2], aliases);
      } else if (shorthand) {
        properties[shorthand[1]] = describeValidator(shorthand[1], aliases);
      } else {
        throw new Error(`Unsupported property entry "${propertyEntry}" on "${eventName}"`);
      }
    }
    schemas[eventName] = properties;
  }
  return schemas;
}

const clientSource = stripComments(
  fs.readFileSync(path.resolve(__dirname, '..', 'lib', 'productAnalytics.ts'), 'utf8')
);
const serverSource = stripComments(
  fs.readFileSync(
    path.resolve(__dirname, '..', 'supabase', 'functions', 'api', 'routes', 'analytics.ts'),
    'utf8'
  )
);

const clientEventNames = parseEventNames(clientSource, 'PRODUCT_ANALYTICS_EVENT_NAMES');
const serverEventNames = parseEventNames(serverSource, 'EVENT_NAMES');
const clientSchemas = parsePropertySchemas(clientSource, 'PRODUCT_ANALYTICS_PROPERTY_SCHEMAS');
const serverSchemas = parsePropertySchemas(serverSource, 'PROPERTY_SCHEMAS');

describe('product analytics client/server schema parity', () => {
  it('parses a non-empty schema from both files', () => {
    // Guards the comparisons below against a rename silently emptying both maps.
    expect(clientEventNames.length).toBeGreaterThan(0);
    expect(Object.keys(clientSchemas).sort()).toEqual([...clientEventNames].sort());
    expect(Object.keys(serverSchemas).sort()).toEqual([...serverEventNames].sort());
  });

  it('declares the same event names on both sides', () => {
    expect([...serverEventNames].sort()).toEqual([...clientEventNames].sort());
  });

  it('accepts the same property keys for every event', () => {
    const keysByEvent = (schemas) =>
      Object.fromEntries(
        Object.entries(schemas).map(([event, properties]) => [event, Object.keys(properties).sort()])
      );
    expect(keysByEvent(serverSchemas)).toEqual(keysByEvent(clientSchemas));
  });

  it('allows the same value set for every event property', () => {
    expect(serverSchemas).toEqual(clientSchemas);
  });

  it('accepts symbol_detail_viewed from a dream guide on both sides', () => {
    // Regression: `source: 'guide'` (app/dream-guide/[id].tsx) passed the client
    // guard but was rejected by the route, so those events were silently lost.
    expect(clientSchemas.symbol_detail_viewed.source.allowedValues).toContain('s:guide');
    expect(serverSchemas.symbol_detail_viewed.source.allowedValues).toContain('s:guide');
  });
});
