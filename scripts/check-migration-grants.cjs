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
//   It also fails when X is handed to a caller role (`alter function X owner to
//   anon|authenticated|service_role`). An owner-only routine (a trigger
//   function) records its decision as `grant execute on function X to postgres`.
//   Fail closed across files: a routine this file does not create has an
//   unknown security mode, so granting it EXECUTE to PUBLIC/anon or resetting
//   its search_path fails (re-create it in the file), and so does `grant
//   execute on all functions in schema public to public|anon`.
//   Shape rules (fail closed, whatever the statement would do):
//   - "dynamic routine SQL": an `execute` whose text mentions function,
//     procedure, routine, definer or search_path;
//   - "non-literal execute": an `execute` that is not one constant string
//     (concatenation, format, variable or call), in any migration;
//   - "unicode-escaped identifier": a U&"..." identifier outside a dollar-quoted
//     body (U&'...' strings are not matched; PostgreSQL rejects a string where
//     a role or object name is expected);
//   - "non-PL/pgSQL DO": a DO block in another language;
//   - "set schema": SET SCHEMA (an alias for SET search_path);
//   - "schema DDL": drop schema or alter schema ... rename, in any migration
//     (schema existence is replayed per file only);
//   - "public schema DDL": alter schema ... rename from or to public, or drop
//     schema public, in any migration;
//   - "caller-writable schema": grant create or all [privileges] on a schema to
//     anon, authenticated, service_role or public (quoted or not, lists, with
//     grant option), in any migration;
//   - "quoted name with parenthesis": a routine statement with a quoted
//     identifier containing "(" (typmod stripping cannot tell "foo(1)" from foo);
//   - "role DDL": create/alter/drop role|user|group (all forms), grant <role>
//     to anyone, revoke <role> from, reassign owned, drop owned. A file that
//     needs one must be grandfathered (pinned by SHA-256); none does today;
//   - "string DO body": a DO block whose body is not dollar-quoted;
//   - "conditional routine or path change": a create/alter of a routine, a
//     set/reset search_path or a set_config inside a DO block with control flow;
//   - "non-literal set_config": set_config without two plain string literals
//     and true/false;
//   - "alter of an earlier routine": an alter that changes the security or the
//     search_path of a routine this file does not create;
//   - "role switch": set role / set session authorization in a migration that
//     changes routines;
//   - "%TYPE signature": a routine signature with a %TYPE argument;
//   - "quoted public grantee": "public" quoted in a routine grant or revoke;
//   - "non-ASCII routine name": a routine statement with non-ASCII characters
//     outside strings (the identifier parser is ASCII only).
//   A search_path ending with pg_temp is only safe when pg_temp appears once,
//   last, after an existing trusted schema (pg_catalog or a KNOWN_SCHEMAS entry).
//   Moving such a routine into public checks it as SECURITY DEFINER, handing
//   any routine to a caller role as owner fails, and so do routine DDL or
//   routine privileges in dynamic SQL (an `execute ...` whose text names a
//   function, procedure, routine or definer, other than a DROP), a DO body in
//   an ordinary string that names one, and any ROLLBACK [TO SAVEPOINT] in a
//   file that changes routines. A conditional DROP keeps the routine and a
//   conditional CREATE OR REPLACE keeps the worse of both states; a
//   conditional search_path change, or any set_config other than a plain
//   whole-statement call on 'search_path', resets resolution to public.
//
// Known limit: argument types are compared as written (after alias
// normalisation such as int4 = integer), not resolved through the search_path.
// An unqualified type name that exists in two schemas is treated as one type,
// so two overloads differing only by which schema's type they take are merged.
// Qualify such types (`private.token`) in routine signatures.
// Known limit: dynamic SQL that spells routine keywords in pieces
// ('func' || 'tion') is not recognised; that is deliberate obfuscation, left
// to code review rather than to this lint.
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
// Schemas that exist when a migration runs: Supabase's own and those the repository's migrations
// create. A new schema created in an earlier migration and then used through search_path must be
// added here, or unqualified names under it are checked as public.
const KNOWN_SCHEMAS = Object.freeze([
  'public', 'extensions', 'auth', 'storage', 'realtime', 'graphql', 'graphql_public', 'vault', 'pgsodium',
  'net', 'cron', 'supabase_functions', 'supabase_migrations', 'pgbouncer',
  'analytics_private', 'app_authorization_private', 'apple_auth_private', 'auth_guard_private', 'private', 'qa_private',
]);
// Roles API requests run as (and PUBLIC): never the owner of a SECURITY DEFINER routine.
const CALLER_ROLES = ['public', ...ROLES];

// A string literal: an escape string (E'...', backslash escapes) or a plain one ('' escapes).
const LITERAL = String.raw`(?<![\w$])[Ee]'(?:[^'\\]|\\[\s\S]|'')*'|'(?:[^']|'')*'`;

/** Index after the quoted literal or identifier starting at `i` (E'...' strings honour backslash escapes). */
function quotedEnd(sql, i) {
  const c = sql[i];
  const escapes = c === '\'' && /[Ee]/.test(sql[i - 1] ?? '') && !/[\w$]/.test(sql[i - 2] ?? '');
  let j = i + 1;
  while (j < sql.length) {
    if (escapes && sql[j] === '\\') { j += 2; continue; }
    if (sql[j] === c) { if (sql[j + 1] === c) { j += 2; continue; } return j + 1; }
    j++;
  }
  return sql.length;
}

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
  '20260723143132_remove_location_subsystem_from_noctalia.sql',
  '20260819130000_analysis_job_prompt_version.sql',
  '20260827200000_lucid_dream_sign_sync.sql',
  '20260829010000_lucid_dream_atlas_sync.sql',
  '20260829120000_requeue_failed_generate_image_jobs.sql',
  '20260829160000_preserve_image_job_retry_budget.sql',
  '20260909010000_scope_oauth_product_access.sql',
  '20260916115955_harden_image_retry_exhaustion_and_role_errors.sql',
  '20260917172941_preserve_plus_analysis_authorization.sql',
  '20261014183000_allow_luminous_nostalgic_analysis_themes.sql',
  '20261015120000_add_dream_precise_theme.sql',
  '20261021090000_explicit_public_data_api_grants.sql',
  '20261021100000_tighten_public_data_api_grants.sql',
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
  '20260723143132_remove_location_subsystem_from_noctalia.sql': 'cd1c5ea8a3e0d141cfd5ec7353ceaf150996ba2fa9fde21f7f61942ac41517f5',
  '20260819130000_analysis_job_prompt_version.sql': '29c4d1f56ee9ac1d7735c381f4c860bea31b91f7dba1d0978b0c3b835a227472',
  '20260827200000_lucid_dream_sign_sync.sql': '61df7f16d8c8d7e55f131b74eaae4de3ef2a6cd8becff4d1516f00bc5962afec',
  '20260829010000_lucid_dream_atlas_sync.sql': 'eca5ffa99093ae6c920eff1103c73d9008b52b459e47487deb3e0be9e66c51ae',
  '20260829120000_requeue_failed_generate_image_jobs.sql': 'cbe93e6d41bab0393203dcc8fb3302cc1b29278cb5dbd1eb16e23e12e0aeae82',
  '20260829160000_preserve_image_job_retry_budget.sql': '5d16817e359fe8734d5e4ef31cfb9b118aca29d92a8b55c6b6c3e14301e3d317',
  '20260909010000_scope_oauth_product_access.sql': 'f656b084dd6b1de8d7eaa8bb0504974c79db2b95762dfeaf23a7099681d9f613',
  '20260916115955_harden_image_retry_exhaustion_and_role_errors.sql': 'c24920743cf4700febddc566636eeb84a1fd95d643cad453e0363ad45a2c1e80',
  '20260917172941_preserve_plus_analysis_authorization.sql': '6e1c6643881922ccb7795c24cfe9ed8c78bc8fce7421ad1cc6f7cff24e3301bc',
  '20261014183000_allow_luminous_nostalgic_analysis_themes.sql': '6358c19cc23148bf413b54a5ce2e8668330b9322e7556d76a45e8b42cfee723c',
  '20261015120000_add_dream_precise_theme.sql': 'dc771825dc16ddb01d12f594d6d92fdf57d7fe7b8018575422b30dd9458676ca',
  '20261021090000_explicit_public_data_api_grants.sql': '518ff8f2be523fa14bb9d8fa44f975359a6d63aba725613982680357b7cc71c0',
  '20261021100000_tighten_public_data_api_grants.sql': 'f7998816f45ba9ea5d6df555b500cdc92ce7acdc5b356b3cfaccefd85fc6a9a2',
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
    } else if (sql[i] === '\'' || sql[i] === '"') {
      // The same scanner as the statement splitter: E'...' strings honour backslash escapes.
      const end = quotedEnd(sql, i);
      out += sql.slice(i, end);
      i = end;
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
 * search_path|all`, or a `select|perform set_config('search_path', '...', local)` that is the
 * whole statement. `set local` and a local set_config end at COMMIT/END; ROLLBACK also undoes
 * session changes made in the block. A function's `set search_path` attribute,
 * `alter function|role|database ... set search_path` and function bodies do
 * not change it.
 */
function searchPathChanges(sql) {
  if (pathCache.sql === sql) return pathCache.changes;
  const changes = [];
  const setStatement = new RegExp(String.raw`${LEAD}set\s+(?:(local|session)\s+)?search_path\s*(?:=|\bto\b)\s*([\s\S]*)$`, 'i');
  // Only a statement that is the call itself: inside CASE, WHERE, ... it may never be evaluated.
  const setConfig = new RegExp(String.raw`${LEAD}(?:select|perform)\s+(?:pg_catalog\s*\.\s*)?set_config\s*\(`, 'i');
  const resetStatement = new RegExp(String.raw`${LEAD}reset\s+(?:search_path|all)\s*$`, 'i');
  const beginStatement = new RegExp(String.raw`${LEAD}(?:begin(?:\s+(?:work|transaction))?|start\s+transaction)\b(?![\s\S]*\batomic\b)`, 'i');
  const endStatement = new RegExp(String.raw`${LEAD}(commit|end|rollback|abort)\b(?:\s+(?:work|transaction))?(?:\s+and\s+(?:no\s+)?chain)?\s*$`, 'i');
  // session: the path outside the transaction block.
  let session = null;
  let saved = null; // session path at BEGIN, restored by ROLLBACK
  let inBlock = false;
  const record = (offset, schemas) => changes.push({ offset, schemas });
  const touchesPath = (statement) => setStatement.test(statement.text) || resetStatement.test(statement.text) || /\bset_config\s*\(/i.test(statement.text);
  for (const statement of executedStatements(sql)) {
    // A conditional path change may or may not happen: forget any non-default path (fail closed to public).
    if (statement.conditional) { if (touchesPath(statement)) { if (!inBlock) session = null; record(statement.offset, null); } continue; }
    if (!statement.inBody && beginStatement.test(statement.text)) { inBlock = true; saved = session; continue; }
    // ROLLBACK TO SAVEPOINT may restore any earlier path: fall back to public (fail closed).
    if (new RegExp(String.raw`${LEAD}rollback\s+(?:work\s+|transaction\s+)?to\b`, 'i').test(statement.text)) { session = null; record(statement.offset, null); continue; }
    const ended = endStatement.exec(statement.text);
    if (ended && !statement.inBody) {
      if (/rollback|abort/i.test(ended[1])) session = saved;
      // AND CHAIN starts a new transaction block at once.
      inBlock = /\band\s+chain\s*$/i.test(statement.text);
      if (inBlock) saved = session;
      record(statement.offset, session);
      continue;
    }
    const match = setStatement.exec(statement.text);
    let list = null;
    let local = false;
    if (resetStatement.test(statement.text)) list = 'default';
    else if (match) { list = statement.raw.slice(match.index + match[0].length - match[2].length).trim(); local = /local/i.test(match[1] ?? ''); }
    else {
      const call = setConfig.exec(statement.text);
      const config = call && /^\s*'search_path'\s*,\s*'([^']*)'\s*,\s*(true|false)\s*\)\s*$/i.exec(statement.raw.slice(call.index + call[0].length));
      if (config) { list = config[1]; local = config[2].toLowerCase() === 'true'; }
      // Any other set_config of search_path (E'...', expressions, inside CASE, ...) may move the path
      // anywhere: fail closed, treat it as the default so unqualified names are checked as public.
      else if (/\bset_config\s*\(/i.test(statement.text) && !unrelatedSetConfig(statement)) list = 'default'; // name or value not provably unrelated
    }
    if (list === null) continue;
    const schemas = /^\s*default\s*$/i.test(list) ? null : list.split(',').map((item) => {
      const value = item.trim().replace(/^'(.*)'$/, '$1');
      return value === '"$user"' || value === '$user' ? '$user' : ident(value);
    });
    // A local change lasts until the end of the transaction block (or of the file, which runs as one transaction).
    if (!local || !inBlock) session = schemas;
    record(statement.offset, schemas);
  }
  pathCache = { sql, changes };
  return changes;
}

/** Schema an unqualified name created at `offset` resolves to, from the last search_path set before it
 * (its first existing schema: Supabase's, the repository's, or one this file created before it; `$user`, pg_catalog
 * and pg_temp never receive a new object here). */
function schemaAt(sql, offset) {
  let schemas = null;
  for (const change of searchPathChanges(sql)) {
    if (change.offset > offset) break;
    schemas = change.schemas;
  }
  if (!schemas) return 'public';
  // PostgreSQL skips path entries that do not exist; an unknown schema is treated as missing.
  // Replay schema creates (unconditional only) and drops (any, fail closed) that ran before `offset`.
  const exists = new Set(KNOWN_SCHEMAS);
  const createSchema = new RegExp(String.raw`${LEAD}create\s+schema\s+(?:if\s+not\s+exists\s+)?(${IDENT})`, 'i');
  const dropSchema = new RegExp(String.raw`${LEAD}drop\s+schema\s+(?:if\s+exists\s+)?([\s\S]+?)(?:\s+(?:cascade|restrict))?\s*$`, 'i');
  for (const statement of executedStatements(sql)) {
    if (statement.offset >= offset) break;
    const created = createSchema.exec(statement.text);
    if (created && !statement.conditional) exists.add(ident(created[1]));
    const dropped = dropSchema.exec(statement.text);
    if (dropped) for (const name of splitTopLevel(dropped[1])) exists.delete(ident(name));
    const renamed = new RegExp(String.raw`${LEAD}alter\s+schema\s+(${IDENT})\s+rename\s+to\s+(${IDENT})\s*$`, 'i').exec(statement.text);
    if (renamed) { exists.delete(ident(renamed[1])); if (!statement.conditional) exists.add(ident(renamed[2])); }
  }
  const first = schemas.find((schema) => schema && exists.has(schema));
  return first ?? 'public';
}

/**
 * End (index after END) of a SQL-standard `BEGIN ATOMIC ... END` routine body
 * starting at `i`, or -1 when none starts there. CASE ... END nests inside it;
 * quoted and dollar-quoted literals are skipped.
 */
function atomicBodyEnd(sql, i) {
  const start = /^begin\s+atomic\b/i.exec(sql.slice(i));
  if (!start || /[\w$]/.test(sql[i - 1] ?? '')) return -1;
  let depth = 1;
  let j = i + start[0].length;
  while (j < sql.length) {
    const c = sql[j];
    if (c === '\'' || c === '"') { j = quotedEnd(sql, j); continue; }
    const tag = c === '$' && !/[\w$]/.test(sql[j - 1] ?? '') ? new RegExp(`^${DOLLAR_TAG}`).exec(sql.slice(j)) : null;
    if (tag) {
      const close = sql.indexOf(tag[0], j + tag[0].length);
      j = close < 0 ? sql.length : close + tag[0].length;
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
    if (c === '\'' || c === '"') { i = quotedEnd(sql, i); continue; }
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
    if (c === '\'' || c === '"') i = quotedEnd(body, i) - 1;
    else if (c === '(' || c === '[') depth++;
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
  return text.replace(new RegExp(String.raw`(?<![\w$])(${DOLLAR_TAG})[\s\S]*?\1`, 'g'), blank).replace(new RegExp(LITERAL, 'g'), blank);
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
  const scan = (text, base, conditional = false, inBody = false) => {
    for (const statement of statements(text)) {
      const outside = blankAtomicBodies(statement.text
        .replace(new RegExp(String.raw`(?<![\w$])(${DOLLAR_TAG})[\s\S]*?\1`, 'g'), blank)
        .replace(new RegExp(LITERAL, 'g'), blank));
      // "search_path" quoted is the same setting: rewrite it (same length) so every matcher sees it.
      // Only as a SET/RESET setting name (GUC names ignore case); a routine named "SEARCH_PATH" keeps its case.
      const unquote = (value) => value.replace(/(\b(?:set|reset)\s+(?:(?:local|session)\s+)?)"search_path"/gi, '$1 search_path ');
      result.push({ text: unquote(outside), raw: unquote(statement.text), offset: base + statement.offset, conditional, inBody });
      if (/^\s*do\b/i.test(outside) && !new RegExp(String.raw`^\s*do\s+(?:language\s+${IDENT}\s+)?${DOLLAR_TAG}`, 'i').test(statement.text)) {
        result[result.length - 1].opaqueDo = true; // a DO body in an ordinary string is not read
      }
      const language = /^\s*do\b/i.test(outside) && new RegExp(String.raw`\blanguage\s+(${IDENT})`, 'i').exec(outside);
      if (language && ident(language[1]) !== 'plpgsql') result[result.length - 1].foreignDo = ident(language[1]);
      if (/^\s*do\b/i.test(outside)) {
        for (const body of statement.text.matchAll(new RegExp(String.raw`(?<![\w$])(${DOLLAR_TAG})([\s\S]*?)\1`, 'g'))) {
          // A DO body with control flow may skip any of its statements: they are not proof of a grant.
          const branches = CONTROL_FLOW.test(blankLiterals(body[2]));
          scan(body[2], base + statement.offset + body.index + body[1].length, conditional || branches, true);
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
      .replace(/(?:\s+(?:with\s+grant\s+option|granted\s+by\s+(?:"(?:[^"]|"")*"|\S+)|cascade|restrict))+\s*$/i, '')
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
  let text = definition.trim().replace(/\s*\.\s*/g, '.')
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
  // public.X is X, unless X names a built-in type: then public.int4 is a distinct custom type.
  const builtin = TYPE_ALIASES.has(name) || [...TYPE_ALIASES.values()].includes(name);
  if (schema && schema !== 'pg_catalog' && (schema !== 'public' || builtin)) return `${schema}.${name}${array}`;
  return (TYPE_ALIASES.get(name) ?? name) + array;
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
 * 'safe' when it is empty or ends with pg_temp after an existing trusted schema (PostgreSQL's advice for
 * SECURITY DEFINER, so a caller's temporary objects cannot shadow anything),
 * otherwise the unsafe value as written.
 */
function searchPathSafety(raw) {
  const clause = /^\s*set\s+search_path\s*(?:=|\bto\b|\bfrom\s+current\b)\s*/i.exec(raw);
  if (!clause) return null;
  if (/from\s+current/i.test(clause[0])) return 'from current';
  const list = /^(?:'(?:[^']|'')*'|"(?:[^"]|"")*"|[A-Za-z_][\w$]*)(?:\s*,\s*(?:'(?:[^']|'')*'|"(?:[^"]|"")*"|[A-Za-z_][\w$]*))*/.exec(raw.slice(clause[0].length));
  if (!list) return '?';
  // Only pg_temp itself (unquoted in any case, or exactly "pg_temp" quoted) is the temporary-schema alias.
  const items = splitTopLevel(list[0]).map((item) => {
    const value = item.replace(/^'(.*)'$/s, '$1').trim();
    const quoted = /^"(.*)"$/s.exec(value);
    return quoted ? (quoted[1] === 'pg_temp' ? 'pg_temp' : `"${quoted[1]}"`) : value.toLowerCase();
  });
  // pg_temp alone (or only pg_temp entries) would search the caller's temporary schema first.
  if (items.every((item) => item === '')) return 'safe';
  // Missing schemas are skipped, so a trusted existing schema must come before pg_temp.
  // pg_temp only once, last, after an existing trusted schema (missing schemas are skipped).
  if (items.indexOf('pg_temp') === items.length - 1 && items.slice(0, -1).some((item) => item === 'pg_catalog' || KNOWN_SCHEMAS.includes(item))) return 'safe';
  return list[0];
}

/** True when every set_config call of the statement names, as a plain literal, a setting other than search_path. */
function unrelatedSetConfig(statement) {
  return [...statement.text.matchAll(/\bset_config\s*\(/gi)].every((call) => {
    const name = (argumentList(statement.raw, call.index + call[0].length) ?? [])[0];
    return Boolean(name) && /^'(?:[^']|'')*'$/.test(name) && name.slice(1, -1).trim().toLowerCase() !== 'search_path';
  });
}

/** Top-level arguments of a call whose list starts at `i` (after the opening parenthesis), or null. */
function argumentList(raw, i) {
  let depth = 1;
  for (let j = i; j < raw.length; j++) {
    const c = raw[j];
    if (c === '\'' || c === '"') { j = quotedEnd(raw, j) - 1; continue; }
    if (c === '(') depth++;
    else if (c === ')' && !--depth) return splitTopLevel(raw.slice(i, j));
  }
  return null;
}

/** The less safe of two search_path states (null: none set). */
function worstPath(a, b) {
  if (a === null || b === null) return null;
  return a !== 'safe' ? a : b;
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
    .replace(/(?:\s+(?:with\s+grant\s+option|granted\s+by\s+(?:"(?:[^"]|"")*"|\S+)|cascade|restrict))+\s*$/i, '')
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
  const fresh = (schema, name, sig) => ({ schema, name, sig, definer: false, path: null, owner: null, public: 'default', anon: 'default', grantees: new Set() });
  const find = (target) => routines.filter((r) => r.schema === target.schema && r.name === target.name && (target.sig === null || r.sig === null || r.sig === target.sig));
  const touch = (target) => {
    const found = find(target);
    if (found.length) return found;
    const created = { ...fresh(target.schema, target.name, target.sig), earlier: true };
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
  const problems = [];
  // Fail closed by shape: statements whose effect this replay cannot know fail outright.
  const shapeWords = /\b(?:functions?|procedures?|routines?|definer|search_path|role|user|group|owned|owner|authorization)\b/i;
  const dynamic = new RegExp(String.raw`${LEAD}execute\b`, 'i');
  const constantExecute = new RegExp(String.raw`${LEAD}execute\s+(?:'(?:[^']|'')*'|(?<![\w$])(${DOLLAR_TAG})[\s\S]*?\1)\s*(?:into\s+(?:strict\s+)?[\s\S]*)?$`, 'i');
  const rollback = new RegExp(String.raw`${LEAD}(?:rollback|abort)\b`, 'i');
  const pathChange = new RegExp(String.raw`${LEAD}(?:set\s+(?:(?:local|session)\s+)?search_path\b|reset\s+(?:search_path|all)\b)`, 'i');
  const touchesRoutines = executed.some((st) => createRoutine.test(st.text) || alterRoutine.test(st.text) || privilege.test(st.text) || schemaWide.test(st.text));
  const roleSwitch = new RegExp(String.raw`${LEAD}set\s+(?:(?:session|local)\s+)?(?:role\b|session\s+authorization\b)`, 'i');
  const roleDdl = [
    new RegExp(String.raw`${LEAD}(?:create|alter|drop)\s+(?:role|user|group)\b`, 'i'),
    new RegExp(String.raw`${LEAD}grant\s+(?![\s\S]*\bon\b)[\s\S]+?\s+to\s+\S`, 'i'),
    new RegExp(String.raw`${LEAD}revoke\s+(?![\s\S]*\bon\b)[\s\S]+?\s+from\s+\S`, 'i'),
    // Schema DDL changes which path entries exist; with routines in the same file it fails closed.

    new RegExp(String.raw`${LEAD}(?:reassign|drop)\s+owned\s+by\b`, 'i'),
  ];
  /** Schema shape rules, for a statement or the command of a constant execute. */
  const schemaShapes = (text) => {
    const found = [];
    // Public schema DDL in any migration: renaming another schema into public (or public away)
    // or dropping it swaps every unqualified name, across files, which this replay cannot follow.
    const schemaRename = new RegExp(String.raw`${LEAD}alter\s+schema\s+(${IDENT})\s+rename\s+to\s+(${IDENT})`, 'i').exec(text);
    const schemaDrop = new RegExp(String.raw`${LEAD}drop\s+schema\s+(?:if\s+exists\s+)?([\s\S]+?)\s*(?:\b(?:cascade|restrict)\s*)?$`, 'i').exec(text);
    if ((schemaRename && [schemaRename[1], schemaRename[2]].some((name) => ident(name) === 'public'))
      || (schemaDrop && schemaDrop[1].split(',').some((name) => ident(name) === 'public'))) {
      found.push(`shape rule "public schema DDL": alter schema ... rename from or to public, or drop schema public; never swap the public schema in a migration`);
    } else if (schemaRename || schemaDrop) {
      // Schema existence is replayed per file only, so any drop or rename fails closed in every migration.
      found.push(`shape rule "schema DDL": drop schema or alter schema ... rename; schema existence is not replayed across migrations`);
    }
    // CREATE on a schema lets a caller plant objects that shadow unqualified names on any path that lists it.
    const schemaGrant = new RegExp(String.raw`${LEAD}grant\s+([\s\S]+?)\s+on\s+schema\s+[\s\S]+?\s+to\s+([\s\S]+)$`, 'i').exec(text);
    if (schemaGrant && schemaGrant[1].split(',').some((privilege) => /^(?:create|all(?:\s+privileges)?)$/i.test(privilege.trim()))
      && roleList(schemaGrant[2]).some((role) => CALLER_ROLES.includes(role))) {
      found.push(`shape rule "caller-writable schema": grant create or all on a schema to anon, authenticated, service_role or public; callers must never create objects in a schema`);
    }
    return found;
  };
  let rolledBack = false;
  for (const statement of executed) {
    if (dynamic.test(statement.text)) {
      const literal = constantExecute.exec(statement.raw);
      const command = literal ? statement.raw.slice(statement.raw.search(/\bexecute\b/i) + 7).trim().replace(/^'([\s\S]*)'[\s\S]*$/, '$1').replace(/^(\$[A-Za-z_0-9]*\$)([\s\S]*?)\1[\s\S]*$/, '$2') : '';
      problems.push(...schemaShapes(command));
      if (shapeWords.test(statement.raw) || roleDdl.some((pattern) => pattern.test(command))) problems.push(`shape rule "dynamic routine SQL": an execute whose text mentions function, procedure, routine, definer, search_path, role, user, group, owner, owned or authorization; write it as a plain statement`);
      else if (!constantExecute.test(statement.raw)) problems.push(`shape rule "non-literal execute": an execute that is not one constant string (concatenation, format, variable or call)`);
      continue;
    }
    if (statement.opaqueDo) {
      problems.push(`shape rule "string DO body": a DO block whose body is not dollar-quoted; use do $$ ... $$`);
      continue;
    }
    if (statement.foreignDo) {
      problems.push(`shape rule "non-PL/pgSQL DO": a DO block in language ${statement.foreignDo}; only PL/pgSQL bodies can be read`);
      continue;
    }
    if (statement.conditional && (createRoutine.test(statement.text) || alterRoutine.test(statement.text) || pathChange.test(statement.text) || /\bset_config\s*\(/i.test(statement.text))) {
      problems.push(`shape rule "conditional routine or path change": a create/alter of a routine or a search_path change inside a DO block with control flow; make it unconditional`);
    }
    for (const call of statement.text.matchAll(/\bset_config\s*\(/gi)) {
      const args = argumentList(statement.raw, call.index + call[0].length);
      const setting = args && /^'(?:[^']|'')*'$/.test(args[0] ?? '') ? args[0].slice(1, -1).trim().toLowerCase() : null;
      if (setting === 'role' || setting === 'session_authorization') {
        problems.push(`shape rule "role switch": set_config('${setting}', ...) switches the role; do not change roles in a migration`);
        continue;
      }
      if (setting !== null && setting !== 'search_path') continue;
      if (!args || args.length !== 3 || !/^'(?:[^']|'')*'$/.test(args[0]) || !/^'(?:[^']|'')*'$/.test(args[1]) || !/^(?:true|false)$/i.test(args[2])) {
        problems.push(`shape rule "non-literal set_config": set_config must take two plain string literals and true/false`);
      }
    }
    if (/(?<![\w$])U&["']/i.test(statement.text)) {
      problems.push(`shape rule "unicode-escaped identifier": a U&"..." identifier outside a dollar-quoted body; write the identifier plainly`);
    }
    if (new RegExp(String.raw`${LEAD}set\s+(?:(?:local|session)\s+)?schema\b`, 'i').test(statement.text)) {
      problems.push(`shape rule "set schema": SET SCHEMA is an alias for SET search_path; write set search_path`);
    }
    problems.push(...schemaShapes(statement.text));
    // Typmod stripping cannot tell "foo(1)" from foo, so a quoted name with "(" in a routine statement fails closed.
    if ((createRoutine.test(statement.text) || alterRoutine.test(statement.text) || privilege.test(statement.text) || /^\s*drop\s+(?:function|procedure|routine)\b/i.test(statement.text)) && /"(?:[^"]|"")*\((?:[^"]|"")*"/.test(statement.text)) {
      problems.push(`shape rule "quoted name with parenthesis": a routine statement with a quoted identifier containing "("; rename the type or routine`);
    }
    if (touchesRoutines && roleSwitch.test(statement.text)) {
      problems.push(`shape rule "role switch": set role or set session authorization in a migration that changes routines; new routines would be owned by that role`);
    }
    // Role DDL of any form changes who holds which privileges; this lint cannot replay it.
    // Quoted identifiers are blanked first, so a role named "on" cannot pass for the ON keyword.
    const unquoted = statement.text.replace(/"(?:[^"]|"")*"/g, (name) => 'x'.repeat(name.length));
    if (roleDdl.some((pattern) => pattern.test(unquoted))) {
      problems.push(`shape rule "role DDL": create/alter/drop role|user|group, grant <role> to, revoke <role> from, reassign owned or drop owned; role changes do not belong in a migration`);
    }
    if ((createRoutine.test(statement.text) || alterRoutine.test(statement.text) || privilege.test(statement.text) || /^\s*drop\s+(?:function|procedure|routine)\b/i.test(statement.text)) && /[^\x00-\x7F]/.test(statement.text)) {
      problems.push(`shape rule "non-ASCII routine name": a routine statement with non-ASCII characters outside strings; use ASCII or quoted identifiers`);
    }
    if ((createRoutine.test(statement.text) || alterRoutine.test(statement.text) || privilege.test(statement.text)) && /%\s*type\b/i.test(statement.text)) {
      problems.push(`shape rule "%TYPE signature": a routine signature with a %TYPE argument; spell the type out`);
    }
    if ((privilege.test(statement.text) || schemaWide.test(statement.text)) && /(?:\b(?:to|from)\s+|,\s*)"public"/i.test(statement.raw)) {
      problems.push(`shape rule "quoted public grantee": "public" in quotes is a role named public, not PUBLIC; write PUBLIC unquoted`);
    }
    if (rollback.test(statement.text)) { rolledBack = true; continue; }
    let match = createRoutine.exec(statement.text);
    if (match) {
      const start = match.index + match[0].length;
      const target = reference(statement.text.slice(start), statement.offset);
      if (!target) continue;
      const sig = target.sig ?? '';
      let routine = routines.find((r) => r.schema === target.schema && r.name === target.name && r.sig === sig);
      const existed = Boolean(routine);
      if (!routine) { routine = fresh(target.schema, target.name, sig); routines.push(routine); }
      const rest = statement.text.slice(start + target.end);
      // Repeated options apply in order: the last SET search_path wins.
      const pathAt = [...rest.matchAll(/\bset\s+search_path\b/gi)].pop()?.index ?? -1;
      // CREATE OR REPLACE resets every attribute it does not repeat (security invoker, no SET), not the ACL.
      const definer = lastSecurity(rest) === 'definer';
      const path = pathAt < 0 ? null : searchPathSafety(statement.raw.slice(start + target.end + pathAt));
      if (statement.conditional && existed) {
        // It may not run: keep the worse of both states.
        routine.definer = routine.definer || definer;
        routine.path = worstPath(routine.path, path);
      } else {
        routine.definer = definer;
        routine.path = path;
      }
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
      if (moved || renamed) {
        for (const routine of found) {
          // A conditional move may or may not happen: keep the routine where it was too.
          const next = statement.conditional ? { ...routine, grantees: new Set(routine.grantees) } : routine;
          const from = routine.schema;
          if (moved) next.schema = ident(moved[1]); else next.name = ident(renamed[1]);
          // A routine from an earlier migration moved into public may be SECURITY DEFINER: check it as one.
          if (next.earlier && next.schema === 'public' && from !== 'public') next.definer = true;
          if (next !== routine) routines.push(next);
        }
        continue;
      }
      const owner = new RegExp(String.raw`^\s*owner\s+to\s+(${IDENT})\s*$`, 'i').exec(rest);
      const security = lastSecurity(rest);
      // SET/RESET actions apply in order: the last one wins.
      const actions = [...rest.matchAll(/\b(set\s+search_path\b|reset\s+(?:search_path|all)\b)/gi)];
      const last = actions.pop();
      const pathAt = last && /^set/i.test(last[1]) ? last.index : -1;
      const pathReset = Boolean(last) && pathAt < 0;
      if (found.some((routine) => routine.earlier) && (security || last)) {
        problems.push(`shape rule "alter of an earlier routine": ${target.schema}.${target.name} comes from an earlier migration and this alter changes its security or search_path; re-create it in this file instead`);
      }
      for (const routine of found) {
        if (owner) routine.owner = statement.conditional && !CALLER_ROLES.includes(ident(owner[1])) ? routine.owner : ident(owner[1]);
        // A conditional change may not happen: it can make a routine definer, never clear it.
        if (security && !(statement.conditional && security === 'invoker')) routine.definer = security === 'definer';
        if (pathAt >= 0) {
          const value = searchPathSafety(statement.raw.slice(start + target.end + pathAt));
          routine.path = statement.conditional ? worstPath(routine.path, value) : value;
          if (value !== 'safe') routine.pathUnsafe = value;
        } else if (pathReset) { routine.path = null; routine.pathReset = true; }
      }
      continue;
    }
    match = dropRoutine.exec(statement.text);
    if (match) {
      if (statement.conditional) continue; // the drop may not happen: keep the routine and its state
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
      // Fail closed: earlier migrations' definer routines in that schema cannot be seen from here.
      if (schemas.includes('public')) for (const role of roles) problems.push(`grant execute on all functions in schema public to ${role}: re-opens every public SECURITY DEFINER routine, grant per routine instead`);
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
  // Fail closed: a ROLLBACK [TO SAVEPOINT] may discard any revoke or grant before it.
  if (rolledBack && touchesRoutines) problems.push(`rollback in a migration that changes routines; the lint cannot tell which revokes and grants survive, so do not roll back here`);
  // Ownership by a caller role is never right, whatever the routine's security mode.
  for (const routine of routines.filter((r) => !r.definer && CALLER_ROLES.includes(r.owner))) {
    problems.push(`${routine.schema}.${routine.name}${routine.sig === null ? '' : `(${routine.sig})`}: owned by ${routine.owner}, a role API callers use; keep a trusted owner such as postgres`);
  }
  // Fail closed for a routine created by an earlier migration (its security mode is unknown here):
  // re-opening it to PUBLIC/anon or dropping its search_path must restate the whole decision in this file.
  for (const routine of routines.filter((r) => r.earlier && r.schema === 'public' && !r.definer)) {
    const label = `public.${routine.name}${routine.sig === null ? '' : `(${routine.sig})`}`;
    for (const role of ['public', 'anon']) if (routine[role] === 'granted') problems.push(`${label}: execute granted to ${role} on a routine from an earlier migration; re-create it here (security invoker or fully secured) so the lint can see its security mode`);
    if (routine.pathUnsafe) problems.push(`${label}: unsafe search_path (${routine.pathUnsafe}) set on a routine from an earlier migration; use set search_path = '' or end the list with pg_temp`);
    if (routine.pathReset) problems.push(`${label}: search_path reset on a routine from an earlier migration; re-create it here so the lint can see its security mode`);
  }
  for (const routine of routines.filter((r) => r.schema === 'public' && r.definer)) {
    const label = `public.${routine.name}${routine.sig === null ? '' : `(${routine.sig})`}`;
    for (const role of ['public', 'anon']) {
      if (routine[role] === 'default') problems.push(`${label}: security definer without "revoke execute on function ${label} from ${role}"`);
      if (routine[role] === 'granted') problems.push(`${label}: security definer granted back to ${role} after its revoke`);
    }
    if (!routine.grantees.size) problems.push(`${label}: security definer without an explicit "grant execute on function ${label} to <role>"`);
    if (routine.path === null) problems.push(`${label}: security definer without "set search_path" (in the definition or "alter function ${label} set search_path")`);
    else if (routine.path !== 'safe') problems.push(`${label}: security definer with an unsafe search_path (${routine.path}); use set search_path = '' or end the list with pg_temp`);
    if (CALLER_ROLES.includes(routine.owner)) problems.push(`${label}: security definer owned by ${routine.owner}, a role API callers use; keep a trusted owner such as postgres`);
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
  ROLES, KNOWN_SCHEMAS, GRANDFATHER_CUTOFF, GRANDFATHERED, FUNCTION_GRANDFATHER_CUTOFF, FUNCTION_GRANDFATHERED, GRANDFATHERED_DIGESTS,
  stripComments, statements, executedStatements, createdPublicObjects, decisions, signature,
  checkTableSql, checkFunctionSql, checkMigrationSql, checkMigrations,
};
