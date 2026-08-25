'use strict';
/* global __dirname, describe, expect, it */

const fs = require('fs');
const path = require('path');

const migrationsDir = path.resolve(__dirname, '..', 'supabase', 'migrations');
const migrationName = fs.readdirSync(migrationsDir).find((name) =>
  name.endsWith('_reconcile_orphaned_analysis_jobs.sql')
);

describe('AI job reconciliation database contract', () => {
  it('ships the expected migration', () => {
    expect(migrationName).toBeDefined();
  });

  const sql = migrationName
    ? fs.readFileSync(path.join(migrationsDir, migrationName), 'utf8').toLowerCase()
    : '';

  it('indexes job ownership and pending-dream lease scans', () => {
    expect(sql).toContain('create index if not exists ai_jobs_dream_id_idx');
    expect(sql).toContain('on public.ai_jobs (dream_id)');
    expect(sql).toContain('create index if not exists dreams_pending_analysis_lease_idx');
    expect(sql).toContain("where analysis_status = 'pending'");
  });

  it('fails the matching dream when an analysis job lease expires', () => {
    expect(sql).toContain('create or replace function public.expire_abandoned_ai_jobs');
    expect(sql).toContain("if stale_job.job_type = 'analyze_dream'");
    expect(sql).toContain("analysis_status = 'failed'");
    expect(sql).toContain('analysis_request_id::text = stale_job.client_request_id');
    expect(sql).toContain("error_code = 'ai_job_lease_expired'");
  });

  it('reconciles only aged pending dreams without active analysis work', () => {
    expect(sql).toContain('with orphaned_dreams as');
    expect(sql).toContain(
      "d.updated_at <= p_now - greatest(p_lease, interval '30 minutes')"
    );
    expect(sql).toContain("j.job_type = 'analyze_dream'");
    expect(sql).toContain("j.status in ('queued', 'running')");
    expect(sql).toContain('limit greatest(p_batch_size - expired_count, 0)');
    expect(sql).toContain('return expired_count + orphaned_count');
  });

  it('keeps maintenance server-only and sync unavailable to anon', () => {
    expect(sql).toContain(
      'revoke all on function public.expire_abandoned_ai_jobs(timestamptz, interval, integer)\n  from public, anon, authenticated'
    );
    expect(sql).toContain(
      'grant execute on function public.expire_abandoned_ai_jobs(timestamptz, interval, integer)\n  to service_role'
    );
    expect(sql).toContain(
      'revoke execute on function public.sync_dream_mutations(jsonb)\n  from public, anon'
    );
    expect(sql).toContain(
      'grant execute on function public.sync_dream_mutations(jsonb)\n  to authenticated'
    );
  });
});
