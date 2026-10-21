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
//   (c) sets a safe search_path, in the definition (`set search_path = ...`)
//       or with `alter function X set search_path ...`: empty (`''`) or a list
//       ending with pg_temp, so a caller's temporary objects cannot shadow
//       anything the body uses unqualified.
// X is matched by name and, when a statement gives an argument list, by
// signature too: argument names, modes, defaults, OUT arguments and type
// modifiers are ignored and common aliases are normalised (int4 = integer,
// timestamptz = timestamp with time zone, ...). A target without an argument
// list covers every overload. `on all functions in schema public` is not a
// decision about X, but a later `grant ... on all functions in schema public
// to public|anon` re-opens it. The file is replayed in order: a later revoke
// of the only grantee, `alter function X reset search_path|all`, or a `drop`
// (the new X gets fresh default privileges) undoes what came before it; a
// name-only target means the overloads existing at that statement; `alter
// function ... set schema public` (or rename) moves a routine into the check.
// SQL-standard `begin atomic ... end` bodies are not read, like dollar-quoted
// ones, and statements of a DO block with control flow (IF, CASE, loops,
// EXCEPTION, ...) never count as a grant, revoke, RLS or search_path.
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
// rule). Each list only excuses its own rule, and every grandfathered file must
// keep the SHA-256 recorded in GRANDFATHERED_DIGESTS.

const crypto = require('node:crypto');
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
  '20260316154500_harden_subscription_state_rpcs.sql',
  '20260616120000_add_dream_memory_metadata.sql',
  '20260623152929_authenticated_analysis_quota_claim.sql',
  '20260721120000_add_dream_analysis_details.sql',
  '20260819130000_analysis_job_prompt_version.sql',
  '20260829120000_requeue_failed_generate_image_jobs.sql',
  '20260829160000_preserve_image_job_retry_budget.sql',
  '20260909010000_scope_oauth_product_access.sql',
  '20260917172941_preserve_plus_analysis_authorization.sql',
  '20261014183000_allow_luminous_nostalgic_analysis_themes.sql',
  '20261015120000_add_dream_precise_theme.sql',
]);

// A dollar-quote tag: $$ or $name$ (an identifier: letters, digits after the first, underscores).
const DOLLAR_TAG = String.raw`\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$`;

// SHA-256 of every grandfathered file: a grandfathered migration may not change
// (a new violation added to it would otherwise hide behind the old ones).
const GRANDFATHERED_DIGESTS = Object.freeze({
  '20251019163753_create_kv_table_6e8fb8b0.sql': '432ddc785cced9adb0112bccbfb132ddf37d6b38be9bcbfce49570c5c7d52e6c',
  '20251204000000_create_guest_usage.sql': 'f2e3a2c61b1c870c676ade4cffcffe1819a3e0ecaba3c1226bfb412c5ca52361',
  '20251205000000_create_user_quota_events.sql': 'a05ce17f1314545dca1ac3b2c7ffb2b052e00784064abd5e110a1d1797f6288f',
  '20251212195000_enforce_authenticated_monthly_quotas.sql': 'f1798180f2fab1c25b96f2f946c86f9291bc82ff32c9b42e5250b3d06daf1632',
  '20251212195800_create_quota_limits_table.sql': '06bec4ca4aa2e8933114f1075d9076aec13464d20024140de3608c17abd6373d',
  '20251213121000_fix_exploration_quota_logging.sql': '93c5c549fb75b3431bc8bfa467c6a2dcc32452f5e86c08c9a66f1eb8f9dd21c3',
  '20251214000002_add_chat_quota_trigger.sql': '2b1a9a7f0750de7e6c62a6714421434cf73cab46315ec3ef78ec92d7221a699a',
  '20251214150000_create_quota_events_table.sql': 'f2f97354e98180b858bab4f0924d95dab2c1bfe9c47f86bbb93b3175b154f413',
  '20251215000000_fix_ambiguous_tier_in_quota_triggers.sql': '68b15979cd7f376eab71d0f51874222dd0693b179f307fa98a470c9289a4749d',
  '20251219000000_add_fingerprint_upgrade_tracking.sql': 'a1f4eecf739876bf62e29e9b55c7dbddf219960ba0872f79992c3cf1def858f2',
  '20251220000000_unify_quota_tables.sql': 'cc02d1637f6478367ccfd1883ab697826bfd6f1038d87f59d6afb0541b7b3cdf',
  '20251221000000_fix_fingerprint_upgrade_tracking.sql': '52a48b5faf5173595b13b1c58cfa1a26cb801034ec949e7a6d62b0fbb0a6a47e',
  '20251222115718_remote_schema.sql': 'c7e2299445252f790d90953091bfc7cffd743272d40b6506e63e536fe03db72d',
  '20251223100000_add_guest_image_quota.sql': '1a220ba80d617566ad7e41c5921246b7e1d8a66c4eb683250769ad1523891409',
  '20260316120000_create_ai_jobs.sql': 'ef7f1dbab85857c6fa166b48533e90110957a292e4738338f66c9bf48bc9a157',
  '20260316130000_add_dream_sync_revisions.sql': 'b57dca708a8993225ebe10d03925c207f62254accc67550f473716072e9150f5',
  '20260316140000_add_subscription_state_convergence.sql': 'fdf87707d1a1ad365d555529021cdfc29f4bd080859d76099d45401b3796f42a',
  '20260316154500_harden_subscription_state_rpcs.sql': 'f48118fb0c5df0936b16e7676806dbad4ed721fd3c63133aa30a1f0529abc913',
  '20260616120000_add_dream_memory_metadata.sql': '7447192179e7d6e888aadceca21d4c41b303c3275ad28fe617155a911c078849',
  '20260623152929_authenticated_analysis_quota_claim.sql': '381cd4fe74d6ecb5f66d0577f26333947d822739c2e345aee43b29125d40cbc6',
  '20260712214624_add_idempotent_guest_analysis_quota.sql': '0dd24a127896cdd2a47bb011847b0468c8664b068ba9dc10ef32f3bd074d539e',
  '20260721120000_add_dream_analysis_details.sql': '2c5048cb795ccbac8adad778e5a9ea1003189a3686650914e1b0873077b03dde',
  '20260722124500_add_ai_sync_admission_control.sql': '86e8360c43d341f77f5d66cdc3a011450cae54546c60f84741c1ef7e2e894875',
  '20260722134500_add_idempotent_chat_turns.sql': '5f90eaf2e47211ff17c9e18147232551bae72d72c73c60c035e60da7b996c153',
  '20260722151231_unify_interpretation_entitlements_and_device_risk.sql': '32ecd01cbc9ad5fed36e29d173e9ed94167fc0329789af3ab8b16461be0aa9e6',
  '20260819130000_analysis_job_prompt_version.sql': '29c4d1f56ee9ac1d7735c381f4c860bea31b91f7dba1d0978b0c3b835a227472',
  '20260829120000_requeue_failed_generate_image_jobs.sql': 'cbe93e6d41bab0393203dcc8fb3302cc1b29278cb5dbd1eb16e23e12e0aeae82',
  '20260829160000_preserve_image_job_retry_budget.sql': '5d16817e359fe8734d5e4ef31cfb9b118aca29d92a8b55c6b6c3e14301e3d317',
  '20260909010000_scope_oauth_product_access.sql': 'f656b084dd6b1de8d7eaa8bb0504974c79db2b95762dfeaf23a7099681d9f613',
  '20260917172941_preserve_plus_analysis_authorization.sql': '6e1c6643881922ccb7795c24cfe9ed8c78bc8fce7421ad1cc6f7cff24e3301bc',
  '20261014183000_allow_luminous_nostalgic_analysis_themes.sql': '6358c19cc23148bf413b54a5ce2e8668330b9322e7556d76a45e8b42cfee723c',
  '20261015120000_add_dream_precise_theme.sql': 'dc771825dc16ddb01d12f594d6d92fdf57d7fe7b8018575422b30dd9458676ca',
});

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
      const tag = new RegExp(`^${DOLLAR_TAG}`).exec(rest);
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
 * (or unconditional DO block) `set [local|session] search_path`, `reset
 * search_path|all`, or a `select|perform set_config('search_path', ...)`. A function's `set search_path` attribute,
 * `alter function|role|database ... set search_path` and function bodies do
 * not change it.
 */
function searchPathChanges(sql) {
  if (pathCache.sql === sql) return pathCache.changes;
  const changes = [];
  const setStatement = new RegExp(String.raw`${LEAD}set\s+(?:(?:local|session)\s+)?search_path\s*(?:=|\bto\b)\s*([\s\S]*)$`, 'i');
  const setConfig = new RegExp(String.raw`${LEAD}(?:select|perform)\b`, 'i');
  const resetStatement = new RegExp(String.raw`${LEAD}reset\s+(?:search_path|all)\s*$`, 'i');
  for (const statement of executedStatements(sql)) {
    if (statement.conditional) continue;
    const match = setStatement.exec(statement.text);
    let list = null;
    if (resetStatement.test(statement.text)) list = 'default';
    else if (match) list = statement.raw.slice(match.index + match[0].length - match[1].length).trim();
    else if (setConfig.test(statement.text)) {
      // Only a real call counts: the name must be outside strings and bodies (blanked in `text`).
      const call = /\bset_config\s*\(/i.exec(statement.text);
      const config = call && /^set_config\s*\(\s*'search_path'\s*,\s*'([^']*)'/i.exec(statement.raw.slice(call.index));
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

/**
 * End (index after END) of a SQL-standard `BEGIN ATOMIC ... END` routine body
 * starting at `i`, or -1 when none starts there. CASE ... END nests inside it.
 */
function atomicBodyEnd(sql, i) {
  const start = /^begin\s+atomic\b/i.exec(sql.slice(i));
  if (!start || /[\w$]/.test(sql[i - 1] ?? '')) return -1;
  let depth = 1;
  let j = i + start[0].length;
  while (j < sql.length) {
    const c = sql[j];
    if (c === '\'' || c === '"') {
      let k = j + 1;
      while (k < sql.length && !(sql[k] === c && sql[k + 1] !== c)) k += sql[k] === c ? 2 : 1;
      j = k + 1;
      continue;
    }
    const word = /[\w$]/.test(sql[j - 1] ?? '') ? null : /^(case|end)\b/i.exec(sql.slice(j, j + 5));
    if (word) {
      depth += word[1].toLowerCase() === 'case' ? 1 : -1;
      j += word[1].length;
      if (!depth) return j;
      continue;
    }
    j++;
  }
  return sql.length;
}

/** Split on top-level semicolons (outside quotes, dollar quotes and BEGIN ATOMIC bodies). */
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
    const tag = c === '$' && !/[\w$]/.test(sql[i - 1] ?? '') ? new RegExp(`^${DOLLAR_TAG}`).exec(sql.slice(i)) : null;
    if (tag) {
      const end = sql.indexOf(tag[0], i + tag[0].length);
      i = end < 0 ? sql.length : end + tag[0].length;
      continue;
    }
    const atomic = (c === 'b' || c === 'B') ? atomicBodyEnd(sql, i) : -1;
    if (atomic >= 0) { i = atomic; continue; }
    if (c === ';') { result.push({ text: sql.slice(start, i), offset: start }); start = i + 1; }
    i++;
  }
  if (sql.slice(start).trim()) result.push({ text: sql.slice(start), offset: start });
  return result;
}

/** Top-level comma split of a parenthesised list (commas inside (), [] and quotes do not split). */
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
    } else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
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

// PL/pgSQL that can skip statements of a DO block.
const CONTROL_FLOW = /\b(?:if|case|loop|while|for|foreach|exception|return|exit|continue|raise)\b/i;

/** `text` with dollar-quoted bodies and string literals blanked. */
function blankLiterals(text) {
  const blank = (part) => ' '.repeat(part.length);
  return text.replace(new RegExp(String.raw`(${DOLLAR_TAG})[\s\S]*?\1`, 'g'), blank).replace(/'(?:[^']|'')*'/g, blank);
}

/** `text` with each BEGIN ATOMIC routine body blanked (it only runs when the routine is called). */
function blankAtomicBodies(text) {
  let out = text;
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== 'b' && out[i] !== 'B') continue;
    const end = atomicBodyEnd(out, i);
    if (end >= 0) { out = out.slice(0, i) + ' '.repeat(end - i) + out.slice(end); i = end - 1; }
  }
  return out;
}

/**
 * Statements PostgreSQL runs while applying the migration: the top-level ones
 * and those of DO blocks (not function bodies, which only run when called).
 * `conditional` marks statements of a DO block with control flow (IF, CASE,
 * loops, EXCEPTION, ...): they may not run, so they never count as a grant,
 * a revoke, RLS or a search_path change.
 * `text` has dollar-quoted bodies and string literals blanked, so text inside a
 * string or a function body never counts; `offset` is absolute in `sql`.
 */
function executedStatements(sql) {
  const result = [];
  const blank = (text) => ' '.repeat(text.length);
  const scan = (text, base, conditional = false) => {
    for (const statement of statements(text)) {
      const outside = blankAtomicBodies(statement.text
        .replace(new RegExp(String.raw`(${DOLLAR_TAG})[\s\S]*?\1`, 'g'), blank)
        .replace(/'(?:[^']|'')*'/g, blank));
      result.push({ text: outside, raw: statement.text, offset: base + statement.offset, conditional });
      if (/^\s*do\b/i.test(outside)) {
        for (const body of statement.text.matchAll(new RegExp(String.raw`(${DOLLAR_TAG})([\s\S]*?)\1`, 'g'))) {
          // A DO body with control flow may skip any of its statements: they are not proof of a grant.
          const branches = CONTROL_FLOW.test(blankLiterals(body[2]));
          scan(body[2], base + statement.offset + body.index + body[1].length, conditional || branches);
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
    const match = !statement.conditional && pattern.exec(statement.text);
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
    const match = !statement.conditional && grant.exec(statement.text);
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
  // PostgreSQL also accepts the mode after the name: `p_user IN uuid`, `result OUT text`.
  const modeAfterName = !mode && new RegExp(`^${IDENT}\\s+(in|out|inout|variadic)\\s+(\\S[\\s\\S]*)$`, 'i').exec(text);
  if (mode) {
    if (mode[1].toLowerCase() === 'out') return '';
    text = text.slice(mode[0].length);
  } else if (modeAfterName) {
    if (modeAfterName[1].toLowerCase() === 'out') return '';
    text = modeAfterName[2];
  }
  if (!modeAfterName && !MULTIWORD_TYPE.test(text)) {
    const named = new RegExp(`^${IDENT}\\s+(\\S[\\s\\S]*)$`).exec(text);
    if (named) text = named[1];
  }
  // float(p) is real for p <= 24 and double precision above (and without p).
  text = text.replace(/^float\s*\(\s*(\d+)\s*\)/i, (_, precision) => (Number(precision) <= 24 ? 'real' : 'double precision'));
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

/**
 * The search_path a `set search_path ...` clause at the start of `raw` sets:
 * 'safe' when it is empty or ends with pg_temp (PostgreSQL's advice for
 * SECURITY DEFINER, so a caller's temporary objects cannot shadow anything),
 * otherwise the unsafe value as written.
 */
function searchPathSafety(raw) {
  const clause = /^\s*set\s+search_path\s*(?:=|\bto\b|\bfrom\s+current\b)\s*/i.exec(raw);
  if (!clause) return null;
  if (/from\s+current/i.test(clause[0])) return 'from current';
  const list = /^(?:'(?:[^']|'')*'|"(?:[^"]|"")*"|[A-Za-z_][\w$]*)(?:\s*,\s*(?:'(?:[^']|'')*'|"(?:[^"]|"")*"|[A-Za-z_][\w$]*))*/.exec(raw.slice(clause[0].length));
  if (!list) return '?';
  const items = splitTopLevel(list[0]).map((item) => item.replace(/^'(.*)'$/s, '$1').replace(/^"(.*)"$/s, '$1').trim().toLowerCase());
  if (items.every((item) => item === '') || items[items.length - 1] === 'pg_temp') return 'safe';
  return list[0];
}

/** Problems of the SECURITY DEFINER functions (and procedures) a migration creates, alters or moves into public. */
function checkFunctionSql(source) {
  const sql = stripComments(source);
  const executed = executedStatements(sql);
  const createRoutine = new RegExp(String.raw`${LEAD}create\s+(?:or\s+replace\s+)?(?:function|procedure)\s+`, 'i');
  const alterRoutine = new RegExp(String.raw`${LEAD}alter\s+(?:function|procedure|routine)\s+`, 'i');
  const dropRoutine = new RegExp(String.raw`${LEAD}drop\s+(?:function|procedure|routine)\s+(?:if\s+exists\s+)?([\s\S]+?)(?:\s+(?:cascade|restrict))?\s*$`, 'i');
  const privilege = new RegExp(String.raw`${LEAD}(grant|revoke)\s+(grant\s+option\s+for\s+)?([\s\S]+?)\s+on\s+(?:function|procedure|routine)\s+([\s\S]+?)\s+(to|from)\s+([\s\S]+)$`, 'i');
  const schemaWide = new RegExp(String.raw`${LEAD}(grant|revoke)\s+(grant\s+option\s+for\s+)?([\s\S]+?)\s+on\s+all\s+(?:functions|procedures|routines)\s+in\s+schema\s+([\s\S]+?)\s+(to|from)\s+([\s\S]+)$`, 'i');
  const lastSecurity = (text) => [...text.matchAll(/\bsecurity\s+(definer|invoker)\b/gi)].pop()?.[1].toLowerCase();
  const executes = (privileges) => /^(?:all(?:\s+privileges)?|(?:[\s\S]*,\s*)?execute(?:\s*,[\s\S]*)?)$/i.test(privileges.trim());
  const roleList = (text) => text
    .replace(/\s+(?:with\s+grant\s+option|granted\s+by\s+[\s\S]*|cascade|restrict)\s*$/i, '')
    .split(',').map((role) => ident(role.replace(/^\s*group\s+/i, '')));
  const reference = (raw, offset) => {
    const found = routineReference(raw);
    if (!found) return null;
    const [schema, name] = resolve(sql, found.raw, offset);
    return { schema, name, sig: found.sig, end: found.end };
  };
  // The routines this file touches, as it runs: what PostgreSQL would hold after each statement.
  // A routine the file did not create starts from the defaults the rule must override
  // (PUBLIC and anon can execute) with an unknown, so not definer, security mode.
  let routines = [];
  const fresh = (schema, name, sig) => ({ schema, name, sig, definer: false, path: null, public: 'default', anon: 'default', grantees: new Set() });
  const find = (target) => routines.filter((r) => r.schema === target.schema && r.name === target.name && (target.sig === null || r.sig === null || r.sig === target.sig));
  const touch = (target) => {
    const found = find(target);
    if (found.length) return found;
    const created = fresh(target.schema, target.name, target.sig);
    routines.push(created);
    return [created];
  };
  const grantTo = (routine, action, roles) => {
    for (const role of roles) {
      if (role === 'public' || role === 'anon') routine[role] = action === 'revoke' ? 'revoked' : 'granted';
      else if (action === 'grant') routine.grantees.add(role);
      else routine.grantees.delete(role);
    }
  };
  for (const statement of executed) {
    let match = createRoutine.exec(statement.text);
    if (match) {
      const start = match.index + match[0].length;
      const target = reference(statement.text.slice(start), statement.offset);
      if (!target) continue;
      const sig = target.sig ?? '';
      let routine = routines.find((r) => r.schema === target.schema && r.name === target.name && r.sig === sig);
      if (!routine) { routine = fresh(target.schema, target.name, sig); routines.push(routine); }
      const rest = statement.text.slice(start + target.end);
      const pathAt = rest.search(/\bset\s+search_path\b/i);
      // CREATE OR REPLACE resets every attribute it does not repeat (security invoker, no SET), not the ACL.
      routine.definer = lastSecurity(rest) === 'definer';
      routine.path = pathAt < 0 ? null : searchPathSafety(statement.raw.slice(start + target.end + pathAt));
      continue;
    }
    match = alterRoutine.exec(statement.text);
    if (match) {
      const start = match.index + match[0].length;
      const target = reference(statement.text.slice(start), statement.offset);
      if (!target) continue;
      const rest = statement.text.slice(start + target.end);
      const moved = new RegExp(String.raw`^\s*set\s+schema\s+(${IDENT})\s*$`, 'i').exec(rest);
      const renamed = new RegExp(String.raw`^\s*rename\s+to\s+(${IDENT})\s*$`, 'i').exec(rest);
      const found = touch(target);
      if (moved) { for (const routine of found) routine.schema = ident(moved[1]); continue; }
      if (renamed) { for (const routine of found) routine.name = ident(renamed[1]); continue; }
      const security = lastSecurity(rest);
      const pathAt = rest.search(/\bset\s+search_path\b/i);
      for (const routine of found) {
        if (security) routine.definer = security === 'definer';
        if (pathAt >= 0 && !statement.conditional) routine.path = searchPathSafety(statement.raw.slice(start + target.end + pathAt));
        else if (/\breset\s+(?:search_path|all)\b/i.test(rest)) routine.path = null;
      }
      continue;
    }
    match = dropRoutine.exec(statement.text);
    if (match) {
      for (const object of splitTopLevel(match[1])) {
        const target = reference(object, statement.offset);
        if (target) { const gone = new Set(find(target)); routines = routines.filter((r) => !gone.has(r)); }
      }
      continue;
    }
    // A grant inside a DO block that may skip it is no proof; a schema-wide grant still re-opens access.
    match = schemaWide.exec(statement.text);
    if (match) {
      if (match[2] || !executes(match[3]) || match[1].toLowerCase() !== 'grant') continue;
      const schemas = splitTopLevel(match[4]).map(ident);
      const roles = roleList(match[6]).filter((role) => role === 'public' || role === 'anon');
      for (const routine of routines.filter((r) => schemas.includes(r.schema))) grantTo(routine, 'grant', roles);
      continue;
    }
    match = privilege.exec(statement.text);
    if (!match || match[2] || !executes(match[3])) continue; // `revoke grant option for` keeps the privilege itself.
    const action = match[1].toLowerCase();
    if (statement.conditional && action === 'revoke') continue;
    const roles = roleList(match[6]);
    for (const object of splitTopLevel(match[4])) {
      const target = reference(object, statement.offset);
      if (!target) continue;
      // A name without arguments means the routines of that name existing at this statement.
      for (const routine of touch(target)) grantTo(routine, action, statement.conditional ? roles.filter((role) => role === 'public' || role === 'anon') : roles);
    }
  }
  const problems = [];
  for (const routine of routines.filter((r) => r.schema === 'public' && r.definer)) {
    const label = `public.${routine.name}${routine.sig === null ? '' : `(${routine.sig})`}`;
    for (const role of ['public', 'anon']) {
      if (routine[role] === 'default') problems.push(`${label}: security definer without "revoke execute on function ${label} from ${role}"`);
      if (routine[role] === 'granted') problems.push(`${label}: security definer granted back to ${role} after its revoke`);
    }
    if (!routine.grantees.size) problems.push(`${label}: security definer without an explicit "grant execute on function ${label} to <role>"`);
    if (routine.path === null) problems.push(`${label}: security definer without "set search_path" (in the definition or "alter function ${label} set search_path")`);
    else if (routine.path !== 'safe') problems.push(`${label}: security definer with an unsafe search_path (${routine.path}); use set search_path = '' or end the list with pg_temp`);
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
 * rule must exist, be at or before that rule's cutoff, still fail it and keep
 * its recorded SHA-256; it is only excused from that rule.
 */
function checkMigrations(dir, grandfathered = {}) {
  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.sql')).sort();
  const sources = new Map(files.map((file) => [file, fs.readFileSync(path.join(dir, file), 'utf8')]));
  const digests = grandfathered.digests ?? GRANDFATHERED_DIGESTS;
  const failures = new Map();
  const stale = [];
  const counts = {};
  for (const [rule, { check, cutoff, list, constant }] of Object.entries(RULES)) {
    const excused = grandfathered[rule] ?? list;
    const allowed = new Set(excused);
    counts[rule] = allowed.size;
    for (const file of excused) {
      if (!sources.has(file)) { stale.push(`${constant}: ${file}: grandfathered but missing; remove it from the list`); continue; }
      if (!(file.slice(0, cutoff.length) <= cutoff)) stale.push(`${constant}: ${file}: newer than ${cutoff}; only migrations applied before this rule can be grandfathered`);
      const digest = crypto.createHash('sha256').update(sources.get(file)).digest('hex');
      if (digests[file] !== digest) stale.push(`${constant}: ${file}: changed since it was grandfathered (sha256 ${digest}); a grandfathered migration cannot be edited`);
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
  ROLES, GRANDFATHER_CUTOFF, GRANDFATHERED, FUNCTION_GRANDFATHER_CUTOFF, FUNCTION_GRANDFATHERED, GRANDFATHERED_DIGESTS,
  stripComments, statements, executedStatements, createdPublicObjects, decisions, signature,
  checkTableSql, checkFunctionSql, checkMigrationSql, checkMigrations,
};
