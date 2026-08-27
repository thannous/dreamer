const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.resolve(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260827200000_lucid_dream_sign_sync.sql'
);
const sql = fs.readFileSync(migrationPath, 'utf8').toLowerCase();

describe('Lucid dream-sign sync migration', () => {
  it('adds dream_sign to both the entity constraint and mutation allow-list', () => {
    expect(sql).toContain('lucid_trainer_entities_entity_type_check');
    expect(sql).toContain("'weekly_review', 'dream_sign'");
    expect(sql).toContain('sync_lucid_trainer_mutations(jsonb)');
    expect(sql).toContain('pg_get_functiondef');
    expect(sql).toContain("''weekly_review'', ''dream_sign''");
  });

  it('does not weaken the existing local-first security contract', () => {
    expect(sql).not.toContain('disable row level security');
    expect(sql).not.toContain('grant all');
    expect(sql).not.toContain('service_role');
  });
});
