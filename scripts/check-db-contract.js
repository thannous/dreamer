'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const DEFAULT_MANIFEST_PATH = path.resolve(__dirname, '..', 'supabase', 'db-contract.manifest.json');
const DEFAULT_LOCAL_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

function parseArgs(argv) {
  const options = {
    manifestPath: DEFAULT_MANIFEST_PATH,
    local: false,
    json: false,
    dbUrl: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--local') {
      options.local = true;
      continue;
    }

    if (arg === '--json') {
      options.json = true;
      continue;
    }

    if (arg === '--manifest') {
      options.manifestPath = path.resolve(process.cwd(), argv[i + 1] ?? '');
      i += 1;
      continue;
    }

    if (arg === '--db-url') {
      options.dbUrl = argv[i + 1] ?? null;
      i += 1;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  node ./scripts/check-db-contract.js [--local] [--db-url <postgres-url>] [--manifest <path>] [--json]

Connection resolution:
  1. --db-url
  2. SUPABASE_DB_URL
  3. DATABASE_URL
  4. --local -> ${DEFAULT_LOCAL_DB_URL}

Examples:
  npm run db:contract:check -- --local
  SUPABASE_DB_URL=postgresql://... npm run db:contract:check
  npm run db:contract:check -- --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres
`.trim());
}

function resolveDbUrl(options, env) {
  if (options.dbUrl) return options.dbUrl;
  if (env.SUPABASE_DB_URL) return env.SUPABASE_DB_URL;
  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (options.local) return env.SUPABASE_LOCAL_DB_URL || DEFAULT_LOCAL_DB_URL;
  return null;
}

function loadManifest(manifestPath) {
  const raw = fs.readFileSync(manifestPath, 'utf8');
  return JSON.parse(raw);
}

async function fetchTableColumns(client, tables) {
  const schemas = [...new Set(tables.map((table) => table.schema))];
  const names = [...new Set(tables.map((table) => table.name))];

  const { rows } = await client.query(
    `
      select table_schema, table_name, column_name
      from information_schema.columns
      where table_schema = any($1::text[])
        and table_name = any($2::text[])
      order by table_schema, table_name, ordinal_position
    `,
    [schemas, names]
  );

  const result = new Map();
  rows.forEach((row) => {
    const key = `${row.table_schema}.${row.table_name}`;
    const existing = result.get(key) ?? new Set();
    existing.add(row.column_name);
    result.set(key, existing);
  });
  return result;
}

async function fetchFunctions(client, requiredFunctions) {
  const schemas = [...new Set(requiredFunctions.map((fn) => fn.schema))];
  const names = [...new Set(requiredFunctions.map((fn) => fn.name))];

  const { rows } = await client.query(
    `
      select
        n.nspname as schema_name,
        p.proname as function_name,
        pg_get_function_identity_arguments(p.oid) as identity_arguments,
        pg_get_function_result(p.oid) as function_result
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = any($1::text[])
        and p.proname = any($2::text[])
    `,
    [schemas, names]
  );

  const result = new Map();
  rows.forEach((row) => {
    const key = `${row.schema_name}.${row.function_name}(${row.identity_arguments ?? ''})`;
    result.set(key, {
      schema: row.schema_name,
      name: row.function_name,
      identityArguments: row.identity_arguments ?? '',
      result: row.function_result,
    });
  });
  return result;
}

async function fetchTriggers(client, requiredTriggers) {
  const schemas = [...new Set(requiredTriggers.map((trigger) => trigger.schema))];
  const tableNames = [...new Set(requiredTriggers.map((trigger) => trigger.table))];

  const { rows } = await client.query(
    `
      select
        table_ns.nspname as table_schema,
        table_rel.relname as table_name,
        trigger_obj.tgname as trigger_name,
        function_ns.nspname as function_schema,
        function_obj.proname as function_name,
        pg_get_triggerdef(trigger_obj.oid, true) as trigger_definition
      from pg_trigger trigger_obj
      join pg_class table_rel on table_rel.oid = trigger_obj.tgrelid
      join pg_namespace table_ns on table_ns.oid = table_rel.relnamespace
      join pg_proc function_obj on function_obj.oid = trigger_obj.tgfoid
      join pg_namespace function_ns on function_ns.oid = function_obj.pronamespace
      where not trigger_obj.tgisinternal
        and table_ns.nspname = any($1::text[])
        and table_rel.relname = any($2::text[])
    `,
    [schemas, tableNames]
  );

  const result = new Map();
  rows.forEach((row) => {
    const key = `${row.table_schema}.${row.table_name}.${row.trigger_name}`;
    result.set(key, {
      schema: row.table_schema,
      table: row.table_name,
      name: row.trigger_name,
      functionSchema: row.function_schema,
      functionName: row.function_name,
      definition: row.trigger_definition,
    });
  });
  return result;
}

async function fetchIndexes(client, requiredIndexes) {
  const schemas = [...new Set(requiredIndexes.map((index) => index.schema))];
  const tableNames = [...new Set(requiredIndexes.map((index) => index.table))];

  const { rows } = await client.query(
    `
      select
        ns.nspname as schema_name,
        tbl.relname as table_name,
        idx.relname as index_name,
        index_meta.indisunique as is_unique,
        coalesce(
          array_agg(att.attname order by ord.ordinality)
            filter (where att.attname is not null),
          '{}'::text[]
        ) as index_columns
      from pg_index index_meta
      join pg_class idx on idx.oid = index_meta.indexrelid
      join pg_class tbl on tbl.oid = index_meta.indrelid
      join pg_namespace ns on ns.oid = tbl.relnamespace
      left join unnest(index_meta.indkey) with ordinality as ord(attnum, ordinality) on true
      left join pg_attribute att on att.attrelid = tbl.oid and att.attnum = ord.attnum
      where ns.nspname = any($1::text[])
        and tbl.relname = any($2::text[])
      group by ns.nspname, tbl.relname, idx.relname, index_meta.indisunique
    `,
    [schemas, tableNames]
  );

  const result = new Map();
  rows.forEach((row) => {
    const key = `${row.schema_name}.${row.table_name}.${row.index_name}`;
    result.set(key, {
      schema: row.schema_name,
      table: row.table_name,
      name: row.index_name,
      unique: row.is_unique,
      columns: row.index_columns,
    });
  });
  return result;
}

async function fetchSeedRows(client, requiredSeedRows) {
  const grouped = new Map();

  requiredSeedRows.forEach((row) => {
    const key = `${row.schema}.${row.table}`;
    const existing = grouped.get(key) ?? [];
    existing.push(row);
    grouped.set(key, existing);
  });

  const result = new Map();

  for (const [tableKey, rows] of grouped.entries()) {
    const [schema, table] = tableKey.split('.');
    const selectedColumns = [...new Set(rows.flatMap((row) => [
      ...Object.keys(row.match ?? {}),
      ...Object.keys(row.expect ?? {}),
    ]))];

    const sql = `select ${selectedColumns.map(quoteIdentifier).join(', ')} from ${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
    try {
      const queryResult = await client.query(sql);

      result.set(tableKey, {
        columns: selectedColumns,
        rows: queryResult.rows,
      });
    } catch (error) {
      if (error && error.code === '42P01') {
        result.set(tableKey, {
          columns: selectedColumns,
          rows: [],
        });
        continue;
      }

      throw error;
    }
  }

  return result;
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function matchesExpectedSeedRow(actualRow, expectedRow) {
  const match = expectedRow.match ?? {};
  const expect = expectedRow.expect ?? {};

  return Object.entries(match).every(([column, value]) => actualRow[column] === value) &&
    Object.entries(expect).every(([column, value]) => actualRow[column] === value);
}

function toSortedArray(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function normalizeArray(values) {
  return Array.isArray(values) ? values : [];
}

async function runChecks(options) {
  const dbUrl = resolveDbUrl(options, process.env);
  if (!dbUrl) {
    throw new Error(
      'Missing database connection. Provide --db-url, SUPABASE_DB_URL, DATABASE_URL, or use --local.'
    );
  }

  const manifest = loadManifest(options.manifestPath);
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    const tableColumnsByTable = await fetchTableColumns(client, manifest.requiredTables ?? []);
    const functionsBySignature = await fetchFunctions(client, manifest.requiredFunctions ?? []);
    const triggersByName = await fetchTriggers(client, manifest.requiredTriggers ?? []);
    const indexesByName = await fetchIndexes(client, manifest.requiredIndexes ?? []);
    const seedRowsByTable = await fetchSeedRows(client, manifest.requiredSeedRows ?? []);

    const failures = [];
    const checks = [];

    normalizeArray(manifest.requiredTables).forEach((table) => {
      const tableKey = `${table.schema}.${table.name}`;
      const columns = tableColumnsByTable.get(tableKey);
      const missingColumns = normalizeArray(table.requiredColumns).filter((column) => !columns?.has(column));

      if (!columns) {
        failures.push(`Missing table ${tableKey}`);
        checks.push({ type: 'table', target: tableKey, ok: false, details: 'table missing' });
        return;
      }

      if (missingColumns.length > 0) {
        failures.push(`Table ${tableKey} is missing columns: ${missingColumns.join(', ')}`);
        checks.push({
          type: 'table',
          target: tableKey,
          ok: false,
          details: `missing columns: ${missingColumns.join(', ')}`,
        });
        return;
      }

      checks.push({
        type: 'table',
        target: tableKey,
        ok: true,
        details: `columns verified (${table.requiredColumns.length})`,
      });
    });

    normalizeArray(manifest.requiredFunctions).forEach((fn) => {
      const signatureKey = `${fn.schema}.${fn.name}(${fn.identityArguments ?? ''})`;
      const actual = functionsBySignature.get(signatureKey);

      if (!actual) {
        failures.push(`Missing function ${signatureKey}`);
        checks.push({ type: 'function', target: signatureKey, ok: false, details: 'function missing' });
        return;
      }

      if (fn.result && String(actual.result).toLowerCase() !== String(fn.result).toLowerCase()) {
        failures.push(
          `Function ${signatureKey} returns ${actual.result}, expected ${fn.result}`
        );
        checks.push({
          type: 'function',
          target: signatureKey,
          ok: false,
          details: `return type mismatch: ${actual.result}`,
        });
        return;
      }

      checks.push({ type: 'function', target: signatureKey, ok: true, details: `returns ${actual.result}` });
    });

    normalizeArray(manifest.requiredTriggers).forEach((trigger) => {
      const triggerKey = `${trigger.schema}.${trigger.table}.${trigger.name}`;
      const actual = triggersByName.get(triggerKey);

      if (!actual) {
        failures.push(`Missing trigger ${triggerKey}`);
        checks.push({ type: 'trigger', target: triggerKey, ok: false, details: 'trigger missing' });
        return;
      }

      const wrongFunction =
        actual.functionSchema !== trigger.functionSchema || actual.functionName !== trigger.functionName;
      if (wrongFunction) {
        failures.push(
          `Trigger ${triggerKey} points to ${actual.functionSchema}.${actual.functionName}, expected ${trigger.functionSchema}.${trigger.functionName}`
        );
        checks.push({ type: 'trigger', target: triggerKey, ok: false, details: actual.definition });
        return;
      }

      const definition = actual.definition ?? '';
      const missingDefinitionParts = normalizeArray(trigger.definitionIncludes).filter(
        (part) => !definition.includes(part)
      );

      if (missingDefinitionParts.length > 0) {
        failures.push(
          `Trigger ${triggerKey} definition drifted; missing: ${missingDefinitionParts.join(' | ')}`
        );
        checks.push({ type: 'trigger', target: triggerKey, ok: false, details: actual.definition });
        return;
      }

      checks.push({ type: 'trigger', target: triggerKey, ok: true, details: actual.definition });
    });

    normalizeArray(manifest.requiredIndexes).forEach((index) => {
      const indexKey = `${index.schema}.${index.table}.${index.name}`;
      const actual = indexesByName.get(indexKey);

      if (!actual) {
        failures.push(`Missing index ${indexKey}`);
        checks.push({ type: 'index', target: indexKey, ok: false, details: 'index missing' });
        return;
      }

      if (Boolean(actual.unique) !== Boolean(index.unique)) {
        failures.push(
          `Index ${indexKey} unique=${actual.unique}, expected ${index.unique}`
        );
        checks.push({
          type: 'index',
          target: indexKey,
          ok: false,
          details: `unique mismatch; columns=${actual.columns.join(', ')}`,
        });
        return;
      }

      const expectedColumns = normalizeArray(index.columns);
      if (actual.columns.join(',') !== expectedColumns.join(',')) {
        failures.push(
          `Index ${indexKey} columns are ${actual.columns.join(', ')}, expected ${expectedColumns.join(', ')}`
        );
        checks.push({ type: 'index', target: indexKey, ok: false, details: `columns=${actual.columns.join(', ')}` });
        return;
      }

      checks.push({
        type: 'index',
        target: indexKey,
        ok: true,
        details: `${actual.unique ? 'unique' : 'non-unique'} on ${actual.columns.join(', ')}`,
      });
    });

    normalizeArray(manifest.requiredSeedRows).forEach((seedRow) => {
      const tableKey = `${seedRow.schema}.${seedRow.table}`;
      const actualRows = seedRowsByTable.get(tableKey)?.rows ?? [];
      const description = `${tableKey} ${JSON.stringify(seedRow.match)}`;
      const actual = actualRows.find((row) => matchesExpectedSeedRow(row, seedRow));

      if (!actual) {
        failures.push(
          `Missing or incorrect seed row for ${tableKey}: match=${JSON.stringify(seedRow.match)} expect=${JSON.stringify(seedRow.expect)}`
        );
        checks.push({ type: 'seed', target: description, ok: false, details: 'row missing or values drifted' });
        return;
      }

      checks.push({ type: 'seed', target: description, ok: true, details: JSON.stringify(seedRow.expect) });
    });

    return {
      ok: failures.length === 0,
      manifestPath: options.manifestPath,
      dbUrlSource: options.dbUrl
        ? '--db-url'
        : process.env.SUPABASE_DB_URL
          ? 'SUPABASE_DB_URL'
          : process.env.DATABASE_URL
            ? 'DATABASE_URL'
            : '--local default',
      database: sanitizeDbUrl(dbUrl),
      checkCount: checks.length,
      failures,
      checks,
    };
  } finally {
    await client.end();
  }
}

function sanitizeDbUrl(dbUrl) {
  try {
    const parsed = new URL(dbUrl);
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return 'unparseable-db-url';
  }
}

function printSummary(report, asJson) {
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`DB contract manifest: ${report.manifestPath}`);
  console.log(`Database: ${report.database}`);
  console.log(`Connection source: ${report.dbUrlSource}`);
  console.log(`Checks executed: ${report.checkCount}`);

  if (report.ok) {
    console.log('Status: PASS');
    return;
  }

  console.log('Status: FAIL');
  report.failures.forEach((failure) => {
    console.log(`- ${failure}`);
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = await runChecks(options);
  printSummary(report, options.json);
  process.exit(report.ok ? 0 : 1);
}

if (require.main === module) {
  main().catch((error) => {
    const connectionHint = error.code === 'ECONNREFUSED'
      ? ' Start local Supabase with `npx supabase start` or pass a reachable --db-url.'
      : '';
    console.error(`DB contract check failed: ${error.message}.${connectionHint}`);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_LOCAL_DB_URL,
  DEFAULT_MANIFEST_PATH,
  loadManifest,
  parseArgs,
  resolveDbUrl,
  runChecks,
  sanitizeDbUrl,
};
