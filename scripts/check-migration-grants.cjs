#!/usr/bin/env node
'use strict';
// Data API privileges of new public tables (Supabase, from 2026-10-30, and
// supabase/config.toml `[api] auto_expose_new_tables = false` locally): a new
// table in public gets no grant for anon, authenticated or service_role, so a
// migration that creates one must say what each role gets.
//
// A migration with `create table [if not exists] public.X` (quoted or not, any
// case; an unqualified name counts when the file's search_path resolves it to
// public, which is the default) fails unless the same file has:
//   - `alter table [if exists] [only] X enable row level security`;
//   - for each of anon, authenticated and service_role, a `grant ... on [table] X
//     to <role>` or `revoke ... on [table] X from <role>` naming X itself
//     (`on all tables in schema public` does not count: it is not a decision
//     about X);
//   - when X has a serial, smallserial, bigserial or identity column, the same
//     per-role grant or revoke on its sequence (the default name X_<column>_seq).
// Only plain SQL statements count: a grant built inside a function body or an
// EXECUTE string is not read.
//
// Grandfathered: the migrations listed in GRANDFATHERED were applied before this
// rule (the latest is 20261020001047) and can never be edited; their tables got
// their privileges from auto-expose, kept explicitly by
// 20261021090000_explicit_public_data_api_grants.sql. The list is closed: an
// entry must name an existing migration that still fails, so nothing new can
// join it without this file changing (a delivery file of verify-local).

const fs = require('node:fs');
const path = require('node:path');

const ROLES = ['anon', 'authenticated', 'service_role'];

// The latest migration that existed before this rule: nothing after it can be grandfathered.
const GRANDFATHER_CUTOFF = '20261020001047';

const GRANDFATHERED = Object.freeze([
  '20251019163753_create_kv_table_6e8fb8b0.sql',
  '20251204000000_create_guest_usage.sql',
  '20251205000000_create_user_quota_events.sql',
  '20251212195800_create_quota_limits_table.sql',
  '20251214150000_create_quota_events_table.sql',
  '20251220000000_unify_quota_tables.sql',
  '20260316120000_create_ai_jobs.sql',
  '20260316130000_add_dream_sync_revisions.sql',
  '20260316140000_add_subscription_state_convergence.sql',
  '20260712214624_add_idempotent_guest_analysis_quota.sql',
  '20260722124500_add_ai_sync_admission_control.sql',
  '20260722134500_add_idempotent_chat_turns.sql',
  '20260722151231_unify_interpretation_entitlements_and_device_risk.sql',
]);

/** Remove comments, keep string and dollar-quoted contents (they may hold real DDL in DO blocks). */
function stripComments(sql) {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const rest = sql.slice(i);
    if (rest.startsWith('--')) {
      const end = sql.indexOf('\n', i);
      i = end < 0 ? sql.length : end;
    } else if (rest.startsWith('/*')) {
      let depth = 0;
      while (i < sql.length) {
        if (sql.startsWith('/*', i)) { depth++; i += 2; } else if (sql.startsWith('*/', i)) { depth--; i += 2; if (!depth) break; } else i++;
      }
      out += ' ';
    } else if (sql[i] === '\'') {
      let j = i + 1;
      while (j < sql.length && !(sql[j] === '\'' && sql[j + 1] !== '\'')) j += sql[j] === '\'' ? 2 : 1;
      out += sql.slice(i, j + 1);
      i = j + 1;
    } else if (sql[i] === '"') {
      let j = i + 1;
      while (j < sql.length && !(sql[j] === '"' && sql[j + 1] !== '"')) j += sql[j] === '"' ? 2 : 1;
      out += sql.slice(i, j + 1);
      i = j + 1;
    } else {
      const tag = /^\$[A-Za-z_]*\$/.exec(rest);
      if (tag && !/[\w$]/.test(sql[i - 1] ?? '')) {
        const end = sql.indexOf(tag[0], i + tag[0].length);
        const stop = end < 0 ? sql.length : end + tag[0].length;
        // The body is SQL too (DO blocks, functions): strip its comments the same way.
        out += tag[0] + stripComments(sql.slice(i + tag[0].length, end < 0 ? sql.length : end)) + (end < 0 ? '' : tag[0]);
        i = stop;
      } else {
        out += sql[i];
        i++;
      }
    }
  }
  return out;
}

const IDENT = String.raw`(?:"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*)`;
const QUALIFIED = String.raw`${IDENT}(?:\s*\.\s*${IDENT})?`;

function ident(raw) {
  const text = raw.trim();
  return text.startsWith('"') ? text.slice(1, -1).replaceAll('""', '"') : text.toLowerCase();
}

/** [schema|null, name] of a possibly qualified identifier. */
function qualified(raw) {
  const parts = [...raw.matchAll(new RegExp(IDENT, 'g'))].map((m) => ident(m[0]));
  return parts.length === 2 ? [parts[0], parts[1]] : [null, parts[0]];
}

/** Schema an unqualified name created at `offset` resolves to, from the last search_path set before it. */
function schemaAt(sql, offset) {
  const pattern = /\bset\s+(?:(?:local|session)\s+)?search_path\s*(?:=|\bto\b)\s*([^;]+)|set_config\s*\(\s*'search_path'\s*,\s*'([^']*)'/gi;
  let schemas = null;
  for (const match of sql.matchAll(pattern)) {
    if (match.index > offset) break;
    const list = match[1] ?? match[2];
    schemas = /^\s*default\s*$/i.test(list) ? null : list.split(',').map((item) => {
      const value = item.trim().replace(/^'(.*)'$/, '$1');
      return value === '"$user"' || value === '$user' ? '$user' : ident(value);
    });
  }
  if (!schemas) return 'public';
  const first = schemas.find((schema) => !['$user', 'pg_catalog', 'pg_temp'].includes(schema));
  return first ?? 'public';
}

/** Split on top-level semicolons (outside quotes, dollar quotes and parentheses do not matter for `;`). */
function statements(sql) {
  const result = [];
  let start = 0;
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (c === '\'' || c === '"') {
      let j = i + 1;
      while (j < sql.length && !(sql[j] === c && sql[j + 1] !== c)) j += sql[j] === c ? 2 : 1;
      i = j + 1;
      continue;
    }
    const tag = c === '$' && !/[\w$]/.test(sql[i - 1] ?? '') ? /^\$[A-Za-z_]*\$/.exec(sql.slice(i)) : null;
    if (tag) {
      const end = sql.indexOf(tag[0], i + tag[0].length);
      i = end < 0 ? sql.length : end + tag[0].length;
      continue;
    }
    if (c === ';') { result.push({ text: sql.slice(start, i), offset: start }); start = i + 1; }
    i++;
  }
  if (sql.slice(start).trim()) result.push({ text: sql.slice(start), offset: start });
  return result;
}

/** Top-level comma split of a parenthesised column list. */
function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '\'' || c === '"') {
      let j = i + 1;
      while (j < body.length && !(body[j] === c && body[j + 1] !== c)) j += body[j] === c ? 2 : 1;
      i = j;
    } else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) { parts.push(body.slice(start, i)); start = i + 1; }
  }
  parts.push(body.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

/** Columns that own a sequence: serial types and identity columns. */
function sequenceColumns(statement, afterName) {
  const open = statement.indexOf('(', afterName);
  if (open < 0 || /^\s*(?:partition\s+of|as\b)/i.test(statement.slice(afterName, open))) return [];
  let depth = 0;
  let close = -1;
  for (let i = open; i < statement.length; i++) {
    if (statement[i] === '(') depth++;
    else if (statement[i] === ')' && --depth === 0) { close = i; break; }
  }
  const columns = [];
  for (const definition of splitTopLevel(statement.slice(open + 1, close < 0 ? undefined : close))) {
    if (/^(?:constraint|primary|unique|check|foreign|exclude|like)\b/i.test(definition)) continue;
    const match = new RegExp(`^(${IDENT})\\s+([\\s\\S]*)$`).exec(definition);
    if (!match) continue;
    const rest = match[2];
    if (/^(?:small|big)?serial[248]?\b/i.test(rest) || /\bgenerated\s+(?:always|by\s+default)\s+as\s+identity\b/i.test(rest)) {
      columns.push(ident(match[1]));
    }
  }
  return columns;
}

/** The tables of public a migration creates, with the columns owning a sequence. */
function createdPublicTables(sql) {
  const tables = [];
  const createTable = new RegExp(String.raw`(?:^|\b(?:begin|then|else|loop)\b)\s*create\s+(?:(?:global|local)\s+)?(?:(temp|temporary)\s+|unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?(${QUALIFIED})`, 'i');
  const scan = (text, base) => {
    for (const statement of statements(text)) {
      // Dollar-quoted bodies are scanned below, on their own.
      const outside = statement.text.replace(/(\$[A-Za-z_]*\$)[\s\S]*?\1/g, (body) => ' '.repeat(body.length));
      const match = createTable.exec(outside);
      if (match && !match[1]) {
        const [schema, name] = qualified(match[2]);
        const resolved = schema ?? schemaAt(sql, base + statement.offset);
        if (resolved === 'public' && !tables.some((table) => table.name === name)) {
          tables.push({ name, sequences: sequenceColumns(statement.text, match.index + match[0].length) });
        }
      }
      // DO blocks and function bodies: their statements are SQL too.
      for (const body of statement.text.matchAll(/(\$[A-Za-z_]*\$)([\s\S]*?)\1/g)) {
        scan(body[2], base + statement.offset + body.index + body[1].length);
      }
    }
  };
  scan(sql, 0);
  return tables;
}

/** Whether a reference (qualified or not) names public.<name>. */
function namesPublic(raw, name) {
  const [schema, object] = qualified(raw);
  return object === name && (schema === null || schema === 'public');
}

/** Roles each table or sequence of public gets an explicit grant or revoke for. */
function decisions(sql) {
  const found = { table: new Map(), sequence: new Map() };
  const grant = /^\s*(grant|revoke)\s+([\s\S]+?)\s+on\s+([\s\S]+?)\s+(to|from)\s+([\s\S]+)$/i;
  for (const statement of statements(sql)) {
    const match = grant.exec(statement.text);
    if (!match) continue;
    let target = match[3].trim();
    let kind = 'table';
    if (/^sequence\s/i.test(target)) { kind = 'sequence'; target = target.replace(/^sequence\s+/i, ''); }
    else if (/^table\s/i.test(target)) target = target.replace(/^table\s+/i, '');
    else if (/^(?:all\s|schema\s|function\s|procedure\s|routine\s|database\s|domain\s|type\s|language\s|large\s|foreign\s|tablespace\s|parameter\s)/i.test(target)) continue;
    const roles = match[5]
      .replace(/\s+(?:with\s+grant\s+option|granted\s+by\s+[\s\S]*|cascade|restrict)\s*$/i, '')
      .split(',').map((role) => ident(role.replace(/^\s*group\s+/i, '')));
    for (const object of target.split(',')) {
      const [schema, name] = qualified(object);
      if (schema !== null && schema !== 'public') continue;
      const set = found[kind].get(name) ?? new Set();
      for (const role of roles) set.add(role);
      found[kind].set(name, set);
    }
  }
  return found;
}

/** Problems of one migration's SQL; an empty list means it passes. */
function checkMigrationSql(source) {
  const sql = stripComments(source);
  const problems = [];
  const granted = decisions(sql);
  for (const table of createdPublicTables(sql)) {
    const label = `public.${table.name}`;
    const rls = [...sql.matchAll(new RegExp(String.raw`\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(${QUALIFIED})\s+enable\s+row\s+level\s+security`, 'gi'))]
      .some((match) => namesPublic(match[1], table.name));
    if (!rls) problems.push(`${label}: no "alter table ${label} enable row level security"`);
    const roles = granted.table.get(table.name) ?? new Set();
    const missing = ROLES.filter((role) => !roles.has(role));
    if (missing.length) problems.push(`${label}: no explicit grant or revoke on the table for ${missing.join(', ')}`);
    for (const column of table.sequences) {
      const sequence = `${table.name}_${column}_seq`;
      const sequenceRoles = granted.sequence.get(sequence) ?? new Set();
      const sequenceMissing = ROLES.filter((role) => !sequenceRoles.has(role));
      if (sequenceMissing.length) {
        problems.push(`${label}: column ${column} owns sequence public.${sequence}; no explicit grant or revoke on it for ${sequenceMissing.join(', ')}`);
      }
    }
  }
  return problems;
}

/** Check every migration of `dir`; grandfathered files must exist and still fail. */
function checkMigrations(dir, grandfathered = GRANDFATHERED) {
  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.sql')).sort();
  const allowed = new Set(grandfathered);
  const failures = [];
  const stale = [];
  for (const file of grandfathered) {
    if (!files.includes(file)) stale.push(`${file}: grandfathered but missing; remove it from the list`);
    if (!(file.slice(0, GRANDFATHER_CUTOFF.length) <= GRANDFATHER_CUTOFF)) stale.push(`${file}: newer than ${GRANDFATHER_CUTOFF}; only migrations applied before this rule can be grandfathered`);
  }
  for (const file of files) {
    const problems = checkMigrationSql(fs.readFileSync(path.join(dir, file), 'utf8'));
    if (allowed.has(file)) {
      if (!problems.length) stale.push(`${file}: grandfathered but passes; remove it from the list`);
    } else if (problems.length) {
      failures.push({ file, problems });
    }
  }
  return { files: files.length, grandfathered: allowed.size, failures, stale };
}

function main() {
  const dir = path.resolve(__dirname, '..', 'supabase/migrations');
  const result = checkMigrations(dir);
  for (const { file, problems } of result.failures) {
    for (const problem of problems) console.error(`supabase/migrations/${file}: ${problem}`);
  }
  for (const line of result.stale) console.error(`scripts/check-migration-grants.cjs: ${line}`);
  if (result.failures.length || result.stale.length) {
    console.error('A new public table needs RLS and an explicit grant or revoke for anon, authenticated and service_role (and its sequence) in the same migration.');
    process.exitCode = 1;
    return;
  }
  console.log(`Migration grants: ${result.files} migrations, ${result.grandfathered} grandfathered, 0 failures.`);
}

if (require.main === module) main();

module.exports = { ROLES, GRANDFATHER_CUTOFF, GRANDFATHERED, stripComments, statements, createdPublicTables, decisions, checkMigrationSql, checkMigrations };
