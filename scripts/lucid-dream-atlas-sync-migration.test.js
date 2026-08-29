const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.resolve(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260829010000_lucid_dream_atlas_sync.sql'
);
const sql = fs.readFileSync(migrationPath, 'utf8').toLowerCase();

describe('Lucid dream-atlas sync migration', () => {
  it('adds dream_atlas to both the entity constraint and mutation allow-list', () => {
    expect(sql).toContain('lucid_trainer_entities_entity_type_check');
    expect(sql).toContain("'dream_sign', 'dream_atlas'");
    expect(sql).toContain('sync_lucid_trainer_mutations(jsonb)');
    expect(sql).toContain('pg_get_functiondef');
    expect(sql).toContain("''dream_sign'', ''dream_atlas''");
  });

  it('does not weaken the existing local-first security contract', () => {
    expect(sql).not.toContain('disable row level security');
    expect(sql).not.toContain('grant all');
    expect(sql).not.toContain('service_role');
  });
});
