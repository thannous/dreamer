#!/usr/bin/env node
'use strict';
// Data API privileges of new public objects (Supabase, from 2026-10-30, and
// supabase/config.toml `[api] auto_expose_new_tables = false` locally): a new
// table, view or sequence in public gets no grant for anon, authenticated or
// service_role, so the migration that creates one must say what each role gets.
//
// A migration with `create [unlogged] table [if not exists] public.X` (quoted or
// not, any case; an unqualified name counts when the search_path in force at
// that statement resolves it to public, which is the default), or with
// `alter table ... set schema public`, fails unless the same file has:
//   - `alter table [if exists] [only] X enable row level security`;
//   - for each of anon, authenticated and service_role, a `grant ... on [table] X
//     to <role>` or `revoke ... on [table] X from <role>` naming X itself
//     (`on all tables in schema public` and PUBLIC do not count: they are not a
//     decision about X for that role; an unqualified target resolves through
//     the search_path too);
//   - when X has a serial, smallserial, bigserial or identity column, the same
//     per-role grant or revoke on its sequence (X_<column>_seq, or the identity
//     column's SEQUENCE NAME).
// A new public view (materialized or not) or standalone sequence needs the same
// per-role grant or revoke (views have no RLS).
//
// SECURITY DEFINER functions (auto-expose does not cover functions: a new one
// keeps EXECUTE for PUBLIC, and Supabase's default privileges add anon). A
// migration with `create [or replace] function|procedure public.X(...) ...
// security definer`, or `alter function|procedure|routine public.X[(...)] ...
// security definer` (quoted or not, any case, unqualified when the search_path
// resolves it to public), fails unless the same file:
//   (a) revokes EXECUTE (or ALL) on X from PUBLIC and from anon, and no later
//       statement of the file grants it back to either;
//   (b) grants EXECUTE (or ALL) on X to at least one other role;
//   (c) sets search_path, in the definition (`set search_path = ...`) or with
//       `alter function X set search_path ...`.
// X is matched by name and, when a statement gives an argument list, by
// signature too: argument names, modes, defaults, OUT arguments and type
// modifiers are ignored and common aliases are normalised (int4 = integer,
// timestamptz = timestamp with time zone, ...). A target without an argument
// list covers every overload. `on all functions in schema public` is not a
// decision about X.
// Only statements that run while the migration applies count: top-level ones
// and those of DO blocks. Text in string literals and function bodies, and
// grants built in EXECUTE strings, are not read.
//
// Grandfathered (tables): the migrations listed in GRANDFATHERED were applied before this
// rule (the latest is 20261020001047) and can never be edited; their tables got
// their privileges from auto-expose, kept explicitly by
// 20261021090000_explicit_public_data_api_grants.sql. The list is closed: an
// entry must name an existing migration that still fails, so nothing new can
// join it without this file changing (a delivery file of verify-local).
// Grandfathered (functions): FUNCTION_GRANDFATHERED, same closed-list rules,
// cutoff FUNCTION_GRANDFATHER_CUTOFF (the latest migration before the function
// rule). Each list only excuses its own rule.

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

// The latest migration that existed before the SECURITY DEFINER rule.
const FUNCTION_GRANDFATHER_CUTOFF = '20261021110000';

const FUNCTION_GRANDFATHERED = Object.freeze([
  '20251204000000_create_guest_usage.sql',
  '20251205000000_create_user_quota_events.sql',
  '20251212195000_enforce_authenticated_monthly_quotas.sql',
  '20251213121000_fix_exploration_quota_logging.sql',
  '20251214000002_add_chat_quota_trigger.sql',
  '20251215000000_fix_ambiguous_tier_in_quota_triggers.sql',
  '20251219000000_add_fingerprint_upgrade_tracking.sql',
  '20251220000000_unify_quota_tables.sql',
  '20251221000000_fix_fingerprint_upgrade_tracking.sql',
  '20251222115718_remote_schema.sql',
  '20251223100000_add_guest_image_quota.sql',
  '20260316120000_create_ai_jobs.sql',
  '20260316130000_add_dream_sync_revisions.sql',
  '20260316140000_add_subscription_state_convergence.sql',
  '20260616120000_add_dream_memory_metadata.sql',
  '20260721120000_add_dream_analysis_details.sql',
  '20260819130000_analysis_job_prompt_version.sql',
  '20260829120000_requeue_failed_generate_image_jobs.sql',
  '20260829160000_preserve_image_job_retry_budget.sql',
  '20260909010000_scope_oauth_product_access.sql',
  '20260917172941_preserve_plus_analysis_authorization.sql',
  '20261014183000_allow_luminous_nostalgic_analysis_themes.sql',
  '20261015120000_add_dream_precise_theme.sql',
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

let pathCache = { sql: null, changes: [] };

/**
 * search_path changes that run in the migration session, in order: a top-level
 * (or DO block) `set [local|session] search_path` or a `select|perform
 * set_config('search_path', ...)`. A function's `set search_path` attribute,
 * `alter function|role|database ... set search_path` and function bodies do
 * not change it.
 */
function searchPathChanges(sql) {
  if (pathCache.sql === sql) return pathCache.changes;
  const changes = [];
  const setStatement = new RegExp(String.raw`${LEAD}set\s+(?:(?:local|session)\s+)?search_path\s*(?:=|\bto\b)\s*([\s\S]*)$`, 'i');
  const setConfig = new RegExp(String.raw`${LEAD}(?:select|perform)\b`, 'i');
  for (const statement of executedStatements(sql)) {
    const match = setStatement.exec(statement.text);
    let list = null;
    if (match) list = statement.raw.slice(match.index + match[0].length - match[1].length).trim();
    else if (setConfig.test(statement.text)) {
      const config = /set_config\s*\(\s*'search_path'\s*,\s*'([^']*)'/i.exec(statement.raw);
      if (config) list = config[1];
    }
    if (list === null) continue;
    const schemas = /^\s*default\s*$/i.test(list) ? null : list.split(',').map((item) => {
      const value = item.trim().replace(/^'(.*)'$/, '$1');
      return value === '"$user"' || value === '$user' ? '$user' : ident(value);
    });
    changes.push({ offset: statement.offset, schemas });
  }
  pathCache = { sql, changes };
  return changes;
}

/** Schema an unqualified name created at `offset` resolves to, from the last search_path set before it. */
function schemaAt(sql, offset) {
  let schemas = null;
  for (const change of searchPathChanges(sql)) {
    if (change.offset > offset) break;
    schemas = change.schemas;
  }
  if (!schemas) return 'public';
  const first = schemas.find((schema) => schema && !['$user', 'pg_catalog', 'pg_temp'].includes(schema));
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

/** Sequences a column list owns: serial types and identity columns ([schema|null, name]). */
function ownedSequences(statement, afterName, table) {
  const open = statement.indexOf('(', afterName);
  if (open < 0 || /^\s*(?:partition\s+of|as\b)/i.test(statement.slice(afterName, open))) return [];
  let depth = 0;
  let close = -1;
  for (let i = open; i < statement.length; i++) {
    if (statement[i] === '(') depth++;
    else if (statement[i] === ')' && --depth === 0) { close = i; break; }
  }
  const sequences = [];
  for (const definition of splitTopLevel(statement.slice(open + 1, close < 0 ? undefined : close))) {
    if (/^(?:constraint|primary|unique|check|foreign|exclude|like)\b/i.test(definition)) continue;
    const match = new RegExp(`^(${IDENT})\\s+([\\s\\S]*)$`).exec(definition);
    if (!match) continue;
    const column = ident(match[1]);
    const rest = match[2];
    const identity = /\bgenerated\s+(?:always|by\s+default)\s+as\s+identity\b([\s\S]*)/i.exec(rest);
    if (!identity && !/^(?:small|big)?serial[248]?\b/i.test(rest)) continue;
    // An identity column may name its sequence: GENERATED ... AS IDENTITY (SEQUENCE NAME x).
    const custom = identity && new RegExp(String.raw`^\s*\([\s\S]*?\bsequence\s+name\s+(${QUALIFIED})`, 'i').exec(identity[1]);
    sequences.push({ column, sequence: custom ? qualified(custom[1]) : [null, `${table}_${column}_seq`] });
  }
  return sequences;
}

/**
 * Statements PostgreSQL runs while applying the migration: the top-level ones
 * and those of DO blocks (not function bodies, which only run when called).
 * `text` has dollar-quoted bodies and string literals blanked, so text inside a
 * string or a function body never counts; `offset` is absolute in `sql`.
 */
function executedStatements(sql) {
  const result = [];
  const blank = (text) => ' '.repeat(text.length);
  const scan = (text, base) => {
    for (const statement of statements(text)) {
      const outside = statement.text
        .replace(/(\$[A-Za-z_]*\$)[\s\S]*?\1/g, blank)
        .replace(/'(?:[^']|'')*'/g, blank);
      result.push({ text: outside, raw: statement.text, offset: base + statement.offset });
      if (/^\s*do\b/i.test(outside)) {
        for (const body of statement.text.matchAll(/(\$[A-Za-z_]*\$)([\s\S]*?)\1/g)) {
          scan(body[2], base + statement.offset + body.index + body[1].length);
        }
      }
    }
  };
  scan(sql, 0);
  return result;
}

// A statement may open a PL/pgSQL block or branch inside a DO body.
const LEAD = String.raw`^(?:[\s\S]*?\b(?:begin|then|else|loop)\b)?\s*`;

/** Schema an object reference resolves to at `offset` (search_path for an unqualified name). */
function resolve(sql, raw, offset) {
  const [schema, name] = qualified(raw);
  return [schema ?? schemaAt(sql, offset), name];
}

/** The public tables, views and standalone sequences a migration creates or moves into public. */
function createdPublicObjects(sql, executed) {
  const objects = [];
  const add = (kind, name, sequences = []) => {
    if (!objects.some((object) => object.kind === kind && object.name === name)) objects.push({ kind, name, sequences });
  };
  const createTable = new RegExp(String.raw`${LEAD}create\s+(?:(?:global|local)\s+)?(?:(temp|temporary)\s+|unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?(${QUALIFIED})`, 'i');
  const createView = new RegExp(String.raw`${LEAD}create\s+(?:or\s+replace\s+)?(?:(temp|temporary)\s+)?(?:recursive\s+)?(?:materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?(${QUALIFIED})`, 'i');
  const createSequence = new RegExp(String.raw`${LEAD}create\s+(?:(temp|temporary)\s+|unlogged\s+)?sequence\s+(?:if\s+not\s+exists\s+)?(${QUALIFIED})`, 'i');
  const moveTable = new RegExp(String.raw`${LEAD}alter\s+(table|view|materialized\s+view|sequence)\s+(?:if\s+exists\s+)?(${QUALIFIED})\s+set\s+schema\s+(${IDENT})\s*$`, 'i');
  for (const statement of executed) {
    let match = createTable.exec(statement.text);
    if (match && !match[1]) {
      const [schema, name] = resolve(sql, match[2], statement.offset);
      if (schema === 'public') add('table', name, ownedSequences(statement.raw, match.index + match[0].length, name));
      continue;
    }
    match = createView.exec(statement.text);
    if (match && !match[1]) {
      const [schema, name] = resolve(sql, match[2], statement.offset);
      if (schema === 'public') add('view', name);
      continue;
    }
    match = createSequence.exec(statement.text);
    if (match && !match[1]) {
      const [schema, name] = resolve(sql, match[2], statement.offset);
      if (schema === 'public') add('sequence', name);
      continue;
    }
    match = moveTable.exec(statement.text);
    if (match && ident(match[3]) === 'public') {
      const kind = /sequence/i.test(match[1]) ? 'sequence' : /view/i.test(match[1]) ? 'view' : 'table';
      add(kind, qualified(match[2])[1]);
    }
  }
  return objects;
}

/** Public tables (and views) a migration enables RLS on. */
function rlsTables(sql, executed) {
  const tables = new Set();
  const pattern = new RegExp(String.raw`${LEAD}alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(${QUALIFIED})\s+enable\s+row\s+level\s+security\s*$`, 'i');
  for (const statement of executed) {
    const match = pattern.exec(statement.text);
    if (!match) continue;
    const [schema, name] = resolve(sql, match[1], statement.offset);
    if (schema === 'public') tables.add(name);
  }
  return tables;
}

/** Roles each public table (or view) and sequence gets an explicit grant or revoke for. */
function decisions(sql, executed = executedStatements(sql)) {
  const found = { table: new Map(), sequence: new Map() };
  const grant = new RegExp(String.raw`${LEAD}(grant|revoke)\s+([\s\S]+?)\s+on\s+([\s\S]+?)\s+(to|from)\s+([\s\S]+)$`, 'i');
  for (const statement of executed) {
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
      // An unqualified target resolves through the search_path in force at that statement.
      const [schema, name] = resolve(sql, object, statement.offset);
      if (schema !== 'public') continue;
      const set = found[kind].get(name) ?? new Set();
      for (const role of roles) set.add(role);
      found[kind].set(name, set);
    }
  }
  return found;
}


const TYPE_ALIASES = new Map(Object.entries({
  int: 'integer', int4: 'integer', integer: 'integer', int8: 'bigint', int2: 'smallint',
  bool: 'boolean', float8: 'double precision', float: 'double precision', float4: 'real',
  varchar: 'character varying', char: 'character', bpchar: 'character', decimal: 'numeric',
  timestamptz: 'timestamp with time zone', timestamp: 'timestamp without time zone',
  'timestamp without time zone': 'timestamp without time zone',
  timetz: 'time with time zone', time: 'time without time zone',
}));
// Types whose name is several words: an argument equal to one of these has no name.
const MULTIWORD_TYPE = /^(?:double\s+precision|character\s+varying|bit\s+varying|national\s+character(?:\s+varying)?|(?:timestamp|time)(?:\s*\(\s*\d+\s*\))?\s+with(?:out)?\s+time\s+zone|interval\s+\w+(?:\s+to\s+\w+)?)(?:\s*\(\s*[\d\s,]*\))?(?:\s*\[\s*\d*\s*\])*$/i;

/** Normalised type of one argument (empty for an OUT argument, which is not part of the signature). */
function argumentType(definition) {
  let text = definition.trim()
    .replace(/\s+default\b[\s\S]*$/i, '')
    .replace(/\s*=[\s\S]*$/, '');
  const mode = /^(in|out|inout|variadic)\s+/i.exec(text);
  if (mode) {
    if (mode[1].toLowerCase() === 'out') return '';
    text = text.slice(mode[0].length);
  }
  if (!MULTIWORD_TYPE.test(text)) {
    const named = new RegExp(`^${IDENT}\\s+(\\S[\\s\\S]*)$`).exec(text);
    if (named) text = named[1];
  }
  let type = text.replace(/\(\s*[\d\s,]*\)/g, '').replace(/\s+/g, ' ').trim();
  let array = '';
  const suffix = /(?:\s*\[\s*\d*\s*\])+$|\s+array(?:\s*\[\s*\d*\s*\])?$/i.exec(type);
  if (suffix) { array = '[]'; type = type.slice(0, suffix.index).trim(); }
  const [schema, name] = /^(?:"[^"]*"|[^\s."]+)\s*\.\s*/.test(type) ? qualified(type) : [null, /^"/.test(type) ? ident(type) : type.toLowerCase()];
  const base = schema && !['public', 'pg_catalog'].includes(schema) ? `${schema}.${name}` : name;
  return (TYPE_ALIASES.get(base) ?? base) + array;
}

/** Normalised signature of a parenthesised argument list (without the parentheses). */
function signature(args) {
  return splitTopLevel(args).map(argumentType).filter(Boolean).join(',');
}

/** Balanced parenthesised group starting at `open` (an index of '('): [inner text, index after ')']. */
function parenthesised(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '"') { const end = text.indexOf('"', i + 1); i = end < 0 ? text.length : end; continue; }
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return [text.slice(open + 1, i), i + 1];
  }
  return [text.slice(open + 1), text.length];
}

/** A routine reference `name[(args)]` at the start of `text`: { name: [schema|null, name], sig: string|null, end }. */
function routineReference(text) {
  const match = new RegExp(`^\\s*(${QUALIFIED})\\s*`).exec(text);
  if (!match) return null;
  let end = match[0].length;
  let sig = null;
  if (text[end] === '(') {
    const [inner, after] = parenthesised(text, end);
    sig = signature(inner);
    end = after;
  }
  return { raw: match[1], sig, end };
}

const sameRoutine = (definer, target) => definer.name === target.name && (target.sig === null || target.sig === definer.sig);

/** Problems of the SECURITY DEFINER functions (and procedures) a migration creates or alters in public. */
function checkFunctionSql(source) {
  const sql = stripComments(source);
  const executed = executedStatements(sql);
  const createRoutine = new RegExp(String.raw`${LEAD}create\s+(?:or\s+replace\s+)?(?:function|procedure)\s+`, 'i');
  const alterRoutine = new RegExp(String.raw`${LEAD}alter\s+(?:function|procedure|routine)\s+`, 'i');
  const privilege = new RegExp(String.raw`${LEAD}(grant|revoke)\s+(grant\s+option\s+for\s+)?([\s\S]+?)\s+on\s+(?:function|procedure|routine)\s+([\s\S]+?)\s+(to|from)\s+([\s\S]+)$`, 'i');
  const definers = [];
  const pathTargets = [];
  const events = [];
  const lastSecurity = (text) => [...text.matchAll(/\bsecurity\s+(definer|invoker)\b/gi)].pop()?.[1].toLowerCase();
  for (const statement of executed) {
    let match = createRoutine.exec(statement.text);
    if (match) {
      const reference = routineReference(statement.text.slice(match.index + match[0].length));
      if (!reference) continue;
      const [schema, name] = resolve(sql, reference.raw, statement.offset);
      const rest = statement.text.slice(match.index + match[0].length + reference.end);
      if (schema === 'public' && lastSecurity(rest) === 'definer') {
        const sig = reference.sig ?? '';
        const pathSet = /\bset\s+search_path\b/i.test(rest);
        const known = definers.find((other) => other.name === name && other.sig === sig);
        if (known) known.pathSet = known.pathSet || pathSet;
        else definers.push({ name, sig, pathSet });
      }
      continue;
    }
    match = alterRoutine.exec(statement.text);
    if (match) {
      const reference = routineReference(statement.text.slice(match.index + match[0].length));
      if (!reference) continue;
      const [schema, name] = resolve(sql, reference.raw, statement.offset);
      if (schema !== 'public') continue;
      const rest = statement.text.slice(match.index + match[0].length + reference.end);
      const target = { name, sig: reference.sig };
      if (/\bset\s+search_path\b/i.test(rest)) pathTargets.push(target);
      if (lastSecurity(rest) === 'definer' && !definers.some((other) => other.name === name && other.sig === (target.sig ?? other.sig))) {
        definers.push({ name, sig: target.sig, pathSet: false });
      }
      continue;
    }
    match = privilege.exec(statement.text);
    if (!match || match[2]) continue; // `revoke grant option for` keeps the privilege itself.
    if (!/^(?:all(?:\s+privileges)?|(?:[\s\S]*,\s*)?execute(?:\s*,[\s\S]*)?)$/i.test(match[3].trim())) continue;
    const roles = match[6]
      .replace(/\s+(?:with\s+grant\s+option|granted\s+by\s+[\s\S]*|cascade|restrict)\s*$/i, '')
      .split(',').map((role) => ident(role.replace(/^\s*group\s+/i, '')));
    for (const object of splitTopLevel(match[4])) {
      const reference = routineReference(object);
      if (!reference) continue;
      const [schema, name] = resolve(sql, reference.raw, statement.offset);
      if (schema === 'public') events.push({ action: match[1].toLowerCase(), target: { name, sig: reference.sig }, roles });
    }
  }
  const problems = [];
  for (const definer of definers) {
    const label = `public.${definer.name}${definer.sig === null ? '' : `(${definer.sig})`}`;
    // An `alter ... security definer` without an argument list covers every overload: match by name.
    const matches = (target) => definer.sig === null ? target.name === definer.name : sameRoutine(definer, target);
    const state = { public: 'default', anon: 'default' };
    const grantees = new Set();
    for (const event of events.filter((item) => matches(item.target))) {
      for (const role of event.roles) {
        if (role in state) state[role] = event.action === 'revoke' ? 'revoked' : 'granted';
        else if (event.action === 'grant') grantees.add(role);
      }
    }
    for (const role of ['public', 'anon']) {
      if (state[role] === 'default') problems.push(`${label}: security definer without "revoke execute on function ${label} from ${role}"`);
      if (state[role] === 'granted') problems.push(`${label}: security definer granted back to ${role} after its revoke`);
    }
    if (!grantees.size) problems.push(`${label}: security definer without an explicit "grant execute on function ${label} to <role>"`);
    if (!definer.pathSet && !pathTargets.some(matches)) problems.push(`${label}: security definer without "set search_path" (in the definition or "alter function ${label} set search_path")`);
  }
  return problems;
}

/** Problems of one migration's public tables, views and sequences. */
function checkTableSql(source) {
  const sql = stripComments(source);
  const executed = executedStatements(sql);
  const problems = [];
  const granted = decisions(sql, executed);
  const rls = rlsTables(sql, executed);
  const missingFor = (map, name) => {
    const roles = map.get(name) ?? new Set();
    return ROLES.filter((role) => !roles.has(role));
  };
  for (const object of createdPublicObjects(sql, executed)) {
    const label = `public.${object.name}`;
    if (object.kind === 'table' && !rls.has(object.name)) problems.push(`${label}: no "alter table ${label} enable row level security"`);
    const missing = missingFor(object.kind === 'sequence' ? granted.sequence : granted.table, object.name);
    if (missing.length) problems.push(`${label}: no explicit grant or revoke on the ${object.kind} for ${missing.join(', ')}`);
    for (const { column, sequence: [schema, name] } of object.sequences) {
      const sequenceLabel = `${schema ?? 'public'}.${name}`;
      const sequenceMissing = (schema ?? 'public') === 'public' ? missingFor(granted.sequence, name) : [];
      if (sequenceMissing.length) {
        problems.push(`${label}: column ${column} owns sequence ${sequenceLabel}; no explicit grant or revoke on it for ${sequenceMissing.join(', ')}`);
      }
    }
  }
  return problems;
}

/** Problems of one migration's SQL (tables, then SECURITY DEFINER functions); an empty list means it passes. */
function checkMigrationSql(source) {
  return [...checkTableSql(source), ...checkFunctionSql(source)];
}

const RULES = Object.freeze({
  tables: { check: checkTableSql, cutoff: GRANDFATHER_CUTOFF, list: GRANDFATHERED, constant: 'GRANDFATHERED' },
  functions: { check: checkFunctionSql, cutoff: FUNCTION_GRANDFATHER_CUTOFF, list: FUNCTION_GRANDFATHERED, constant: 'FUNCTION_GRANDFATHERED' },
});

/**
 * Check every migration of `dir` against each rule. A file grandfathered for a
 * rule must exist, be at or before that rule's cutoff and still fail it; it is
 * only excused from that rule.
 */
function checkMigrations(dir, grandfathered = {}) {
  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.sql')).sort();
  const sources = new Map(files.map((file) => [file, fs.readFileSync(path.join(dir, file), 'utf8')]));
  const failures = new Map();
  const stale = [];
  const counts = {};
  for (const [rule, { check, cutoff, list, constant }] of Object.entries(RULES)) {
    const excused = grandfathered[rule] ?? list;
    const allowed = new Set(excused);
    counts[rule] = allowed.size;
    for (const file of excused) {
      if (!sources.has(file)) stale.push(`${constant}: ${file}: grandfathered but missing; remove it from the list`);
      if (!(file.slice(0, cutoff.length) <= cutoff)) stale.push(`${constant}: ${file}: newer than ${cutoff}; only migrations applied before this rule can be grandfathered`);
    }
    for (const file of files) {
      const problems = check(sources.get(file));
      if (allowed.has(file)) {
        if (!problems.length) stale.push(`${constant}: ${file}: grandfathered but passes; remove it from the list`);
      } else if (problems.length) {
        failures.set(file, [...(failures.get(file) ?? []), ...problems]);
      }
    }
  }
  return {
    files: files.length,
    grandfathered: counts,
    failures: [...failures].sort(([a], [b]) => a.localeCompare(b)).map(([file, problems]) => ({ file, problems })),
    stale,
  };
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
    console.error('A public SECURITY DEFINER function needs, in the same migration, a revoke of EXECUTE from PUBLIC and anon, a grant of EXECUTE to at least one role, and a set search_path.');
    process.exitCode = 1;
    return;
  }
  console.log(`Migration grants: ${result.files} migrations, ${result.grandfathered.tables} grandfathered for tables, ${result.grandfathered.functions} for security definer functions, 0 failures.`);
}

if (require.main === module) main();

module.exports = {
  ROLES, GRANDFATHER_CUTOFF, GRANDFATHERED, FUNCTION_GRANDFATHER_CUTOFF, FUNCTION_GRANDFATHERED,
  stripComments, statements, executedStatements, createdPublicObjects, decisions, signature,
  checkTableSql, checkFunctionSql, checkMigrationSql, checkMigrations,
};
