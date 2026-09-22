'use strict';
/* global describe, it, expect, beforeAll */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { buildProductSql, buildReport, normalizeProduct, normalizeWeb, windowOptions } = require('./lib/product-funnel');
const options = {from:'2026-09-01',to:'2026-09-01',asOf:'2026-09-17'};
describe('adoption baseline boundaries', () => {
  it('rejects unsafe, impossible and unbounded date input', () => {
    for (const from of ["2026-09-01';drop table x;--",'2026-02-30','2025-01-01']) {
      expect(()=>windowOptions({...options,from})).toThrow();
    }
    expect(()=>windowOptions({...options,to:'2026-09-17'})).toThrow();
  });
  it('does not equate absent events or inputs with a zero conversion rate', () => {
    const empty=buildReport({...options,product:[{platform:'android',collection_status:'no_events_received',onboarding_journeys:0}]});
    expect(empty.product[0].activation_rate).toBeNull();
    expect(empty.product[0].onboarding_journeys).toBeNull();
    expect(empty.product[1].status).toBe('unavailable');
    expect(empty.website.click_rate).toBeNull();
  });
  it('suppresses small outcomes and complementary groups', () => {
    for(const saved of [0,9,21,30]) {
      const row=normalizeProduct([{platform:'android',onboarding_journeys:30,saved_within_24h:saved}])[0];
      expect(row.saved_within_24h).toBeNull();
      expect(row.activation_rate).toBeNull();
    }
    expect(normalizeProduct([{platform:'android',onboarding_journeys:30,saved_within_24h:20}])[0].activation_rate).toBe(66.67);
  });
  it('requires comparable website session counts, QA exclusion and matching windows', () => {
    const web={...options,scope:'four_priority_pages',metric:'distinct_sessions_with_product_click',sessions:100,click_sessions:12,processing_complete:true,qa_excluded:true};
    expect(normalizeWeb(web,options).click_rate).toBe(12);
    expect(normalizeWeb({...web,click_sessions:101},options).click_rate).toBeNull();
    expect(normalizeWeb({...web,metric:'eventCount'},options).click_rate).toBeNull();
    expect(normalizeWeb({...web,qa_excluded:false},options).click_rate).toBeNull();
    expect(normalizeWeb({...web,to:'2026-09-02'},options).status).toBe('window_mismatch');
  });
});

describe('read-only aggregate query against PostgreSQL', () => {
  let matureRows, immatureRows;
  const migration=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20260921175137_product_analytics_dream_save_milestones.sql'),'utf8');
  beforeAll(() => {
    // Run PGlite outside Jest's VM; its WASM loader uses dynamic import.
    const code = `const {PGlite}=require('@electric-sql/pglite');
      (async()=>{const db=new PGlite();
        await db.exec(${JSON.stringify("CREATE TABLE product_analytics_events (\n      event_id text PRIMARY KEY, event_name text, occurred_at timestamptz, received_at timestamptz,\n      journey_id text, platform text, properties jsonb\n    );\nINSERT INTO product_analytics_events\n      SELECT 'o'||i,'onboarding_completed','2026-09-01T10:00Z','2026-09-01T10:00Z','j'||i,'android','{}'\n      FROM generate_series(1,30)i;\n      INSERT INTO product_analytics_events\n      SELECT 's'||i,'recording_saved',CASE WHEN i<=20 THEN '2026-09-02T09:59Z' ELSE '2026-09-02T10:00Z' END::timestamptz,\n      '2026-09-03T10:00Z','j'||i,'android','{}' FROM generate_series(1,30)i;\n      INSERT INTO product_analytics_events\n      SELECT 'f'||i,'dream_save_milestone','2026-09-01T12:00Z','2026-09-01T12:00Z','j'||i,'android',\n        jsonb_build_object('stage','first','cohort_day',date '2026-09-01'-date '1970-01-01') FROM generate_series(1,40)i;\n      INSERT INTO product_analytics_events\n      SELECT 'r'||i,'dream_save_milestone','2026-09-08T12:00Z','2026-09-08T12:00Z','rotated'||i,'android',\n        jsonb_build_object('stage','return_7d','cohort_day',date '2026-09-01'-date '1970-01-01') FROM generate_series(1,20)i;")});
        await db.exec("ALTER TABLE product_analytics_events ADD CONSTRAINT product_analytics_events_platform_check CHECK(platform IN ('android','ios'));");
        await db.exec(${JSON.stringify(migration)});
        await db.exec("INSERT INTO product_analytics_events VALUES ('web-save','recording_saved','2026-09-01T12:00Z','2026-09-01T12:00Z','web-journey','web','{}');");
        const a=await db.query(${JSON.stringify(buildProductSql(options))});
        const b=await db.query(${JSON.stringify(buildProductSql({...options,asOf:'2026-09-03'}))});
        console.log(JSON.stringify([a.rows,b.rows])); await db.close();
      })().catch(e=>{console.error(e);process.exit(1)});`;
    [matureRows, immatureRows]=JSON.parse(execFileSync(process.execPath,['-e',code],{encoding:'utf8'}));
  },30000);
  it('counts bounded saves and mature return cohorts without exporting identities', async()=>{
    const rows=matureRows;
    const android=rows.find(r=>r.platform==='android');
    expect(Number(android.onboarding_journeys)).toBe(30);
    expect(Number(android.saved_within_24h)).toBe(20);
    expect(Number(android.mature_first_saves)).toBe(40);
    expect(Number(android.returned_within_7d)).toBe(20);
    expect(android.return_status).toBe('mature_observed');
    expect(rows.find(r=>r.platform==='ios').collection_status).toBe('no_events_received');
    expect(rows.find(r=>r.platform==='web').collection_status).toBe('events_received');
    expect(rows.find(r=>r.platform==='web').onboarding_journeys).toBeNull();
    expect(JSON.stringify(rows)).not.toMatch(/journey_id|cohort_day|rotated|event_id/);
  });
  it('does not classify immature cohorts as zero return',async()=>{
    const rows=immatureRows;
    const android=rows.find(r=>r.platform==='android');
    expect(android.return_status).toBe('immature');
    expect(android.returned_within_7d).toBeNull();
  });
});
