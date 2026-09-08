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
    for (const product of ['journal', 'lucid', 'unknown']) {
      const redirect = `http://127.0.0.1:55328/${product}`;
      const client = await request('/admin/oauth/clients', { token: status.SERVICE_ROLE_KEY, body: { client_name: `TI560 ${product} ${randomUUID()}`, client_type: 'public', token_endpoint_auth_method: 'none', redirect_uris: [redirect], grant_types: ['authorization_code', 'refresh_token'] }, expected: 201 });
      clients.push(client.client_id);
      if (product !== 'unknown') sql(`insert into app_authorization_private.oauth_clients values ('${client.client_id}', '${product}');`);
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
        const clientId = clients[j], redirect = `http://127.0.0.1:55328/${['journal','lucid','unknown'][j]}`;
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
        own[['journal','lucid','unknown'][j]] = refreshed.access_token;
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
})().catch(error => { console.error(error instanceof assert.AssertionError ? error.message : 'Local issuer qualification failed; private credentials omitted.'); process.exitCode = 1; });

async function qualify() {
 const [a,b] = sessions;
 for (const user of sessions) {
  for (const product of ['journal','lucid','unknown','legacy']) assert.equal(ok(await rpc(user[product], 'current_app_product'), 'scope'), product);
 }
 assert.equal(sql("select has_schema_privilege('authenticated','app_authorization_private','usage') or has_table_privilege('authenticated','app_authorization_private.oauth_clients','select');").trim(), 'f');
 assert.equal(sql("select count(*) from information_schema.role_table_grants where grantee in ('authenticated','anon') and table_schema='public' and table_name in ('dreams','lucid_trainer_entities','lucid_trainer_reset_fences','quota_usage','subscription_state','subscription_events') and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER');").trim(), '0');
 const rows=[];
 for (const user of sessions) {
  const row = ok(await api(user.journal, '/rest/v1/dreams', {interpretation:'',shareable_quote:'',dream_type:'Symbolic Dream',user_id:user.id, transcript:'TI560 synthetic scoped dream', title:'Scope fixture'}), 'Journal create')[0]; rows.push(row);
  assert.equal(ok(await api(user.journal, `/rest/v1/dreams?id=eq.${row.id}`), 'Journal read').length, 1);
  ok(await api(user.journal, `/rest/v1/dreams?id=eq.${row.id}`, {title:'Updated fixture'}, 'PATCH'), 'Journal update');
  for (const token of [user.lucid,user.unknown]) {
   assert.deepEqual(ok(await api(token, `/rest/v1/dreams?id=eq.${row.id}`), 'foreign read'), []);
   deny(await api(token, '/rest/v1/dreams', {title:'',interpretation:'',shareable_quote:'',dream_type:'Symbolic Dream',user_id:user.id,transcript:'Forbidden'}), 'foreign create');
   assert.deepEqual(ok(await api(token, `/rest/v1/dreams?id=eq.${row.id}`, {title:'Forbidden'}, 'PATCH'), 'foreign update'), []);
   assert.deepEqual(ok(await api(token, `/rest/v1/dreams?id=eq.${row.id}`, undefined, 'DELETE'), 'foreign delete'), []);
  }
  assert.equal(ok(await api(user.legacy, `/rest/v1/dreams?id=eq.${row.id}`), 'legacy Journal').length,1);
  const mutation = {mutation_id:randomUUID(),client_request_id:randomUUID(),entity_type:'preferences',entity_key:'preferences',operation:'upsert',client_updated_at:new Date().toISOString(),payload:{entity:{entityType:'preferences',entityKey:'preferences',value:{qa:true}}}};
  assert.equal(ok(await rpc(user.lucid,'sync_lucid_trainer_mutations',{mutations:[mutation]}),'Lucid sync')[0].status,'ack');
  assert.equal(ok(await rpc(user.lucid,'get_lucid_trainer_entities'),'Lucid read').entities.length,1);
  assert.equal(ok(await rpc(user.legacy,'get_lucid_trainer_entities'),'legacy Lucid').entities.length,1);
  for (const token of [user.journal,user.unknown]) assert.equal(ok(await rpc(token,'get_lucid_trainer_entities'),'foreign Lucid read').entities.length,0);
 }
 assert.deepEqual(ok(await api(b.journal, `/rest/v1/dreams?id=eq.${rows[0].id}`),'B cannot read A'),[]);
 const foreignCreate = await api(b.journal, '/rest/v1/dreams', {title:'',interpretation:'',shareable_quote:'',dream_type:'Symbolic Dream',user_id:a.id,transcript:'Forbidden'});
 assert.equal(foreignCreate.status,403); assert.equal(foreignCreate.data.code,'42501'); // Ownership denial must be an authorization error, not a malformed RAISE.
 assert.deepEqual(ok(await api(b.journal, `/rest/v1/dreams?id=eq.${rows[0].id}`, {title:'Forbidden'},'PATCH'),'B cannot update A'),[]);
 assert.deepEqual(ok(await api(b.lucid, `/rest/v1/lucid_trainer_entities?user_id=eq.${a.id}`),'B cannot read A Lucid'),[]);
 const chatRequest=randomUUID();
 const journalCalls=[
  ['sync_dream_mutations',{mutations:[]}],
  ['get_effective_subscription_tier',{p_user_id:a.id}],
  ['get_authenticated_quota_snapshot',{}],
  ['begin_authenticated_chat_turn',{p_dream_id:rows[0].id,p_request_id:chatRequest,p_user_message:{role:'user',text:'Synthetic question'}}],
  ['complete_authenticated_chat_turn',{p_dream_id:rows[0].id,p_request_id:chatRequest,p_attempt_count:1,p_model_message:{role:'model',text:'Synthetic response'}}],
  ['fail_authenticated_chat_turn',{p_dream_id:rows[0].id,p_request_id:chatRequest,p_attempt_count:1,p_error_code:'QA'}],
 ];
 for (const [name,body] of journalCalls) {
  for (const token of [a.lucid,a.unknown]) deny(await rpc(token,name,body),name+' wrong product');
  const result = ok(await rpc(a.journal,name,body),name+' Journal positive');
  if(name === 'begin_authenticated_chat_turn') assert.equal(result.allowed,true);
  if(name === 'complete_authenticated_chat_turn') assert.equal(result.completed,true);
  if(name === 'get_effective_subscription_tier') assert.equal(result,'free');
 }
 for (const [name,body] of [['sync_lucid_trainer_mutations',{mutations:[]}],['delete_lucid_trainer_data',{}]]) {
  for (const token of [a.journal,a.unknown]) deny(await rpc(token,name,body),name+' wrong product');
  ok(await rpc(a.lucid,name,body),name+' Lucid positive');
 }
 assert.equal(ok(await api(a.journal, `/rest/v1/dreams?id=eq.${rows[0].id}`),'Lucid delete preserves Journal').length,1);
 assert.deepEqual(ok(await api(a.lucid, '/rest/v1/dreams?select=id', undefined,'GET',{'x-app-id':'journal',appId:'journal'}),'forged header'),[]);
 await request('/user',{token:a.lucid,method:'PUT',body:{data:{appId:'journal',product:'journal',client_id:clients[0]}}});
 assert.equal(ok(await rpc(a.lucid,'current_app_product'),'metadata scope'),'lucid');
 // Both product tokens remain owner-scoped; membership does not expose another user's rows.
 const mediaPath=`${a.id}/ti560-${randomUUID()}.png`;
 const storage = async (token,method,body) => {
  const response=await fetch(status.API_URL+'/storage/v1/object/dream-images/'+mediaPath,{method,signal:boundedSignal(),headers:{apikey:status.ANON_KEY,Authorization:`Bearer ${token}`,'Content-Type':'image/png'},body});
  return {status:response.status,data:await response.text()};
 };
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
 const storageDenied=(result,label)=>{
  assert.ok([400,403,404].includes(result.status),label+' authorization status '+result.status);
  const error=JSON.parse(result.data);
  assert.ok(/not.?found|no.?such.?key|row.level.security|access.?denied|unauthorized/i.test([error.code,error.error,error.message].join(' ')),label+' authorization error');
 };
 try {
  ok(await storage(a.journal,'POST',png),'Journal media upload');
  ok(await storage(a.journal,'GET'),'Journal media read');
  for (const token of [a.lucid,a.unknown,b.journal]) {
   storageDenied(await storage(token,'GET'),'foreign media read');
   storageDenied(await storage(token,'PUT',png),'foreign media overwrite');
  }
 } finally {
  const response=await fetch(status.API_URL+'/storage/v1/object/dream-images',{method:'DELETE',signal:boundedSignal(true),headers:{apikey:status.SERVICE_ROLE_KEY,Authorization:`Bearer ${status.SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({prefixes:[mediaPath]})});
  assert.ok(response.ok,'owned media cleanup');
 }
 for (let i=0;i<sessions.length;i++) ok(await api(sessions[i].journal, `/rest/v1/dreams?id=eq.${rows[i].id}`,undefined,'DELETE'),'Journal delete');
 console.log('PASS: real PKCE + refresh; two users x Journal/Lucid/unknown; RLS CRUD, nine RPCs, media, forged metadata/header, private mapping, revoked privileges, explicit legacy compatibility. No remote-import consent claim.');
}
