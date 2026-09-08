'use strict';
// Opt-in real issuance only. Never starts/stops the existing stack or changes its configuration.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readLocalStatus } = require('../ti528/local-config.cjs');
const status = readLocalStatus(process.env.TI528_LOCAL_STATUS);
const original = 'supabase_auth_noctalia-ti528-disposable';
const network = 'supabase_network_noctalia-ti528-disposable';
const name = `ti560-auth-${randomUUID()}`;
const endpoint = 'http://127.0.0.1:55329';
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
const config = JSON.parse(docker('inspect', original))[0];
assert.equal(config.Config.Labels['com.supabase.cli.project'], 'noctalia-ti528-disposable');
assert.equal(config.Config.Image, 'public.ecr.aws/supabase/gotrue:v2.189.0');
assert.ok(config.NetworkSettings.Networks[network]);
const environment = Object.fromEntries(config.Config.Env.map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
const db = new URL(environment.GOTRUE_DB_DATABASE_URL);
assert.ok(['db', 'supabase_db_noctalia-ti528-disposable'].includes(db.hostname));
assert.equal(db.pathname, '/postgres');
assert.equal(environment.GOTRUE_API_PORT, '9999');
const privateDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ti560-issuer-'));
fs.chmodSync(privateDirectory, 0o700);
const envFile = path.join(privateDirectory, 'auth.env');
Object.assign(environment, { GOTRUE_OAUTH_SERVER_ENABLED: 'true', GOTRUE_OAUTH_SERVER_AUTHORIZATION_PATH: '/oauth/consent', GOTRUE_OAUTH_SERVER_ALLOW_DYNAMIC_REGISTRATION: 'false' });
assert.ok(Object.values(environment).every(value => !/[\r\n]/.test(value)));
fs.writeFileSync(envFile, Object.entries(environment).map(([key, value]) => `${key}=${value}`).join('\n'), { mode: 0o600 });
let container = false;
const cancellation = new AbortController();
const onSignal = () => cancellation.abort();
process.once('SIGINT', onSignal);
process.once('SIGTERM', onSignal);
const boundedSignal = (cleanup = false) => cleanup
  ? AbortSignal.timeout(10000)
  : AbortSignal.any([cancellation.signal, AbortSignal.timeout(10000)]);
const users = [], clients = [], sessions = [];
const sql = query => execFileSync('docker', ['exec', '-i', 'supabase_db_noctalia-ti528-disposable', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input: query, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] });
async function api(token, route, body, method = body ? 'POST' : 'GET', extra = {}) {
 const response = await fetch(status.API_URL + route, {method, signal: boundedSignal(), headers: {apikey: status.ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type':'application/json', Prefer:'return=representation', ...extra}, body: body === undefined ? undefined : JSON.stringify(body)});
 const raw = await response.text(); let data; try {data = JSON.parse(raw)} catch {data = raw}
 return {status:response.status, data};
}
const rpc = (token, name, body = {}) => api(token, '/rest/v1/rpc/'+name, body);
const ok = (result, label) => { assert.ok(result.status >= 200 && result.status < 300, label + ' status ' + result.status + ' ' + (result.data?.code || '') + ' ' + (result.data?.message || '')); return result.data; };
const deny = (result, label) => assert.ok(result.status === 401 || result.status === 403, label + ' denied status ' + result.status + ' ' + (result.data?.code || '') + ' ' + (result.data?.message || ''));

async function request(route, { token, body, form, method = body || form ? 'POST' : 'GET', expected = 200, cleanup = false } = {}) {
  const response = await fetch(endpoint + route, { method, signal: boundedSignal(cleanup), redirect: 'manual', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, body: body ? JSON.stringify(body) : form ? new URLSearchParams(form) : undefined });
  assert.equal(response.status, expected, `${method} ${route.split('?')[0]} status`);
  if (response.status >= 300 && response.status < 400) return response.headers.get('location');
  if (response.status === 204) return null;
  return response.json();
}
async function verify(token, userId, clientId) {
  const user = await request('/user', { token });
  assert.equal(user.id, userId);
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  assert.equal(claims.sub, userId);
  assert.equal(claims.client_id, clientId);
  assert.equal(claims.aud, 'authenticated');
  assert.equal(claims.iss, environment.GOTRUE_JWT_ISSUER);
  // The existing gateway independently verifies the issuer token, not merely its decoded claims.
  const rest = await fetch(status.API_URL + '/rest/v1/dreams?select=id&limit=1', { signal: boundedSignal(), headers: { apikey: status.ANON_KEY, Authorization: `Bearer ${token}` } });
  assert.equal(rest.status, 200);
}
(async () => {
  try {
    docker('create', '--name', name, '--network', network, '--publish', '127.0.0.1:55329:9999', '--env-file', envFile, config.Image, 'auth');
    container = true;
    cancellation.signal.throwIfAborted();
    docker('start', name);
    let healthy = false;
    for (let i = 0; i < 10; i++) {
      cancellation.signal.throwIfAborted();
      try { healthy = (await fetch(endpoint + '/health', { signal: AbortSignal.any([cancellation.signal, AbortSignal.timeout(1000)]) })).ok; } catch { /* bounded startup */ }
      if (healthy) break;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.ok(healthy, 'Auxiliary local Auth healthy');
    for (const product of ['journal', 'lucid', 'unknown', 'lucid_other']) {
      const redirect = `http://127.0.0.1:55328/${product}`;
      const client = await request('/admin/oauth/clients', { token: status.SERVICE_ROLE_KEY, body: { client_name: `TI560 ${product} ${randomUUID()}`, client_type: 'public', token_endpoint_auth_method: 'none', redirect_uris: [redirect], grant_types: ['authorization_code', 'refresh_token'] }, expected: 201 });
      clients.push(client.client_id);
      if (product !== 'unknown') sql(`insert into app_authorization_private.oauth_clients values ('${client.client_id}', '${product === 'lucid_other' ? 'lucid' : product}');`);
      assert.equal(client.client_type, 'public');
      assert.equal(client.token_endpoint_auth_method, 'none');
    }
    for (let i = 0; i < 2; i++) {
      const email = `ti560-${randomUUID()}@example.test`, password = randomUUID();
      const user = await request('/admin/users', { token: status.SERVICE_ROLE_KEY, body: { email, password, email_confirm: true } });
      users.push(user.id);
      const session = await request('/token?grant_type=password', { body: { email, password } });
      assert.equal(JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url')).client_id, undefined);
      const own = {id:user.id, legacy:session.access_token}; sessions.push(own);
      for (let j = 0; j < clients.length; j++) {
        const clientId = clients[j], redirect = `http://127.0.0.1:55328/${['journal','lucid','unknown','lucid_other'][j]}`;
        const verifier = randomBytes(48).toString('base64url');
        const state = randomUUID();
        const query = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: 'code', scope: 'email', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
        const location = await request('/oauth/authorize?' + query, { expected: 302 });
        const authorizationId = new URL(location).searchParams.get('authorization_id');
        assert.ok(authorizationId);
        await request(`/oauth/authorizations/${authorizationId}`, { token: session.access_token });
        const consent = await request(`/oauth/authorizations/${authorizationId}/consent`, { token: session.access_token, body: { action: 'approve' } });
        const result = new URL(consent.redirect_url);
        assert.equal(result.searchParams.get('state'), state);
        assert.equal(result.origin + result.pathname, redirect);
        const issued = await request('/oauth/token', { form: { grant_type: 'authorization_code', client_id: clientId, code: result.searchParams.get('code'), code_verifier: verifier, redirect_uri: redirect } });
        await verify(issued.access_token, user.id, clientId);
        const refreshed = await request('/oauth/token', { form: { grant_type: 'refresh_token', client_id: clientId, refresh_token: issued.refresh_token } });
        await verify(refreshed.access_token, user.id, clientId);
        own[['journal','lucid','unknown','lucid_other'][j]] = refreshed.access_token;
      }
    }
    await qualify();

  } finally {
    const cleanupErrors = [];
    try {
      if (container) {
        for (const id of users) {
          try { sql(`delete from public.dreams where user_id = '${id}';`); } catch { cleanupErrors.push('dreams'); }
          try { await request(`/admin/users/${id}`, { token: status.SERVICE_ROLE_KEY, method: 'DELETE', cleanup: true }); } catch { cleanupErrors.push('user'); }
        }
        for (const id of clients) {
          try { sql(`delete from app_authorization_private.oauth_clients where client_id = '${id}';`); } catch { cleanupErrors.push('mapping'); }
          try { await request(`/admin/oauth/clients/${id}`, { token: status.SERVICE_ROLE_KEY, method: 'DELETE', expected: 204, cleanup: true }); } catch { cleanupErrors.push('client'); }
        }
      }
    } finally {
      if (container) { try { docker('rm', '-f', name); } catch { cleanupErrors.push('container'); } }
      fs.rmSync(privateDirectory, { recursive: true });
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
    }
    assert.equal(cleanupErrors.length, 0, 'Owned synthetic fixture/container cleanup completed');
  }
})().catch(error => { console.error(error instanceof assert.AssertionError ? error.message : 'Local issuer qualification failed; private credentials omitted. ' + String(error.stack || '').split('\n').filter(line=>line.includes('qualify-import-local.cjs')).join(' ')); process.exitCode = 1; });

async function qualify() {
 const [a,b]=sessions;
 const create=(user,ids=null)=>rpc(user.journal,'create_journal_import_grant',{p_destination_client_id:clients[1],p_selected_ids:ids});
 const page=(token,cursor,limit=100)=>rpc(token,'read_journal_import_page',{p_cursor:cursor,p_limit:limit});
 const revoke=(token,grant)=>rpc(token,'revoke_journal_import_grant',{p_grant_id:grant});
 const empty=ok(await create(a),'empty grant');
 const emptyPage=ok(await page(a.lucid,empty.cursor),'empty page');assert.deepEqual(emptyPage.items,[]);assert.equal(emptyPage.done,true);assert.equal(emptyPage.nextCursor,null);
 for(const token of [a.lucid,a.unknown,a.legacy]) deny(await rpc(token,'create_journal_import_grant',{p_destination_client_id:clients[1]}),'wrong grant issuer');
 for(const token of [a.journal,a.unknown,a.legacy,b.lucid,a.lucid_other]) deny(await page(token,empty.cursor),'wrong grant reader');
 deny(await page(a.lucid,randomUUID()),'absent grant');
 for(const token of [a.lucid,a.unknown,a.legacy,b.journal]) deny(await revoke(token,empty.grantId),'wrong revoker');
 const seed=user=>sql(`insert into public.dreams(user_id,transcript,title,interpretation,shareable_quote,dream_type,client_request_id) values ('${user.id}','TI560 import single','Private title','Private analysis','Private quote','Symbolic Dream',gen_random_uuid()) returning id;`).trim().split('\n')[0];
 const first=seed(a), foreign=seed(b);
 const single=ok(await create(a),'single grant');const one=ok(await page(a.lucid,single.cursor),'single page');assert.equal(one.items.length,1);assert.equal(one.items[0].id,first);assert.equal(one.done,true);
 assert.deepEqual(Object.keys(one.items[0]).sort(),['clientRequestId','createdAt','id','revision','transcript']);
 deny(await create(a,[Number(foreign)]),'foreign selection');
 const bulk=sql(`insert into public.dreams(user_id,transcript,title,interpretation,shareable_quote,dream_type,client_request_id) select '${a.id}','TI560 import synthetic '||i,'Private title','Private analysis','Private quote','Symbolic Dream',gen_random_uuid() from generate_series(1,2500) i returning id;`).trim().split('\n').filter(value=>/^\d+$/.test(value));assert.equal(bulk.length,2500);
 const all=ok(await create(a),'2501 grant');
 const late=seed(a); // Created after the all-grant watermark.
 const gathered=[];let cursor=all.cursor;let firstPage;
 do {const result=ok(await page(a.lucid,cursor,200),'all page');if(!firstPage)firstPage=result;assert.ok(result.items.length<=200);gathered.push(...result.items);cursor=result.nextCursor;assert.equal(result.done,cursor===null);}while(cursor);
 assert.equal(gathered.length,2501);assert.equal(new Set(gathered.map(item=>item.id)).size,2501);assert.ok(!gathered.some(item=>item.id===late));assert.ok(!gathered.some(item=>item.id===foreign));
 const parallel=await Promise.all(Array.from({length:5},()=>page(a.lucid,all.cursor,7)));for(const response of parallel){const result=ok(response,'parallel replay');assert.equal(result.nextCursor,firstPage.nextCursor);assert.equal(result.items.length,200);}
 const parallelFresh=ok(await create(a),'parallel fresh grant');const parallelFirst=await Promise.all(Array.from({length:5},()=>page(a.lucid,parallelFresh.cursor,50)));const next=ok(parallelFirst[0],'fresh page').nextCursor;for(const response of parallelFirst){const result=ok(response,'parallel first');assert.equal(result.nextCursor,next);assert.equal(result.items.length,50);}
 const selected=ok(await create(a,[Number(first),Number(bulk[2499])]),'selection grant');const selectedPage=ok(await page(a.lucid,selected.cursor),'selection page');assert.deepEqual(selectedPage.items.map(item=>item.id),[first,bulk[2499]]);assert.equal(selectedPage.done,true);
 const oldRevision=firstPage.items[0].revision;
 sql(`update public.dreams set transcript='TI560 revised text' where id=${first} and user_id='${a.id}'; delete from public.dreams where id=${bulk[0]} and user_id='${a.id}';`);
 const replay=ok(await page(a.lucid,all.cursor,1),'replay current data');assert.equal(replay.nextCursor,firstPage.nextCursor);assert.equal(replay.items.length,199);assert.equal(replay.items[0].transcript,'TI560 revised text');assert.notEqual(replay.items[0].revision,oldRevision);assert.ok(!replay.items.some(item=>item.id===bulk[0]));
 const expiring=ok(await create(a),'expiring grant');ok(await page(a.lucid,expiring.cursor),'initial expiring page');sql(`update app_authorization_private.journal_import_grants set expires_at=clock_timestamp()-interval '1 second' where id='${expiring.grantId}';`);deny(await page(a.lucid,expiring.cursor),'expired cached replay');
 assert.equal(ok(await revoke(a.journal,all.grantId),'cancel grant'),true);deny(await page(a.lucid,all.cursor),'revoked cached replay');deny(await page(a.lucid,firstPage.nextCursor),'revoked next page');
 for(const role of ['anon','authenticated'])for(const table of ['journal_import_grants','journal_import_cursors'])assert.equal(sql(`select has_table_privilege('${role}','app_authorization_private.${table}','select');`).trim(),'f');
 assert.equal(sql(`select count(*) from app_authorization_private.journal_import_cursors where grant_id='${parallelFresh.grantId}';`).trim(),'2');
 // A row committed/backfilled into an old sequence gap must not enlarge a replay.
 const gapId=bulk[2];
 sql(`delete from public.dreams where id=${gapId} and user_id='${a.id}';`);
 const gapGrant=ok(await create(a),'gap grant');
 const beforeGap=ok(await page(a.lucid,gapGrant.cursor,200),'gap first page');assert.equal(beforeGap.items.length,200);
 sql(`insert into public.dreams(id,user_id,transcript,title,interpretation,shareable_quote,dream_type,client_request_id) overriding system value values (${gapId},'${a.id}','TI560 late gap backfill','','','','Symbolic Dream',gen_random_uuid());`);
 const afterGap=ok(await page(a.lucid,gapGrant.cursor,200),'gap replay');
 assert.equal(afterGap.items.length,200);assert.deepEqual(afterGap.items.map(item=>item.id),beforeGap.items.map(item=>item.id));assert.ok(!afterGap.items.some(item=>item.id===gapId));
 // Hold the cursor lock until after expiry. Admission before waiting is insufficient.
 const waiting=ok(await create(a),'waiting grant');
 sql(`update app_authorization_private.journal_import_grants set expires_at=clock_timestamp()+interval '2 seconds' where id='${waiting.grantId}';`);
 const {spawn}=require('node:child_process');
 const locker=spawn('docker',['exec','-i','supabase_db_noctalia-ti528-disposable','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],{stdio:['pipe','pipe','pipe']});
 const exited=new Promise((resolve,reject)=>{locker.once('error',reject);locker.once('exit',code=>code===0?resolve():reject(new Error('Owned cursor lock failed')));});
 let output='';const locked=new Promise((resolve,reject)=>{locker.stdout.on('data',chunk=>{output+=chunk.toString();if(output.includes('TI560_LOCKED'))resolve();});locker.once('error',reject);locker.once('exit',()=>{if(!output.includes('TI560_LOCKED'))reject(new Error('Cursor lock not acquired'));});});
 locker.stdin.end(`begin; select id from app_authorization_private.journal_import_cursors where id='${waiting.cursor}' for update; select 'TI560_LOCKED'; select pg_sleep(3); commit;`);
 try {await locked; const started=Date.now();deny(await page(a.lucid,waiting.cursor),'expiry after cursor lock wait');assert.ok(Date.now()-started>=1000,'request actually waited for cursor lock');} finally {await exited;}
 console.log('PASS: real OAuth import grants; 0/1/2501 exhaustive watermark pagination, selected ownership, current replay revisions/deletion, stable parallel cursor, gap backfill and lock-wait expiry, wrong actors/legacy, expiry/revocation/cancel and private storage. No client activation or deployment claim.');
}
