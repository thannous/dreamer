'use strict';
/* global __dirname, describe, expect, it */

const fs = require('fs');
const path = require('path');

const migrationsDir = path.resolve(__dirname, '..', 'supabase', 'migrations');
const migrationName = fs.readdirSync(migrationsDir).find((name) =>
  name.endsWith('_product_analytics_events.sql')
);
const sql = fs.readFileSync(path.join(migrationsDir, migrationName), 'utf8').toLowerCase();

describe('product analytics database privacy contract', () => {
  it('keeps raw events service-role only with RLS and no identity/content columns', () => {
    const rawTable = sql.match(/create table public\.product_analytics_events \(([\s\S]*?)\n\);/)?.[1] ?? '';

    expect(rawTable).not.toMatch(/user_id|fingerprint|dream_id|transcript|interpretation|email/);
    expect(sql).toContain('alter table public.product_analytics_events enable row level security');
    expect(sql).toContain('revoke all on table public.product_analytics_events from public, anon, authenticated');
    expect(sql).toContain('grant select, insert, delete on table public.product_analytics_events to service_role');
  });

  it('materializes only cohorts of at least ten distinct journeys', () => {
    expect(sql).toContain('create table analytics_private.product_analytics_daily_aggregates');
    expect(sql).toContain('check (journey_count >= 10)');
    expect(sql).toContain('having count(distinct journey_id) >= 10');
    expect(sql).toContain('revoke all on schema analytics_private from public, anon, authenticated');
    expect(sql).toContain('grant select on table analytics_private.product_analytics_daily_aggregates to service_role');
  });

  it('enforces 90-day raw and 24-month aggregate retention with scheduled jobs', () => {
    expect(sql).toContain("received_at < now() - interval '90 days'");
    expect(sql).toContain("event_date < current_date - interval '24 months'");
    expect(sql).toContain("'product_analytics_aggregate_daily'");
    expect(sql).toContain("'product_analytics_purge_daily'");
  });
});
