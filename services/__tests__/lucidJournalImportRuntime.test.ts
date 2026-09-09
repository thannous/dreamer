import { createLucidJournalImportRuntime, type LucidJournalImportRuntimeDependencies } from '../lucidJournalImportRuntime';
import type { JournalImportSnapshot } from '@/lib/lucid/journalImport';
const user='00000000-0000-4000-8000-000000000001',journal='00000000-0000-4000-8000-000000000002',lucid='00000000-0000-4000-8000-000000000003',grant='00000000-0000-4000-8000-000000000004',cursor='00000000-0000-4000-8000-000000000005';
const deferred=<T>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return{promise,resolve};};
function fixture() {
 let currentOwner:string|null=user,generation='one',saved:JournalImportSnapshot|null=null;
 const sessions={journal:{begin:jest.fn(async()=> 'https://example.test/auth'),complete:jest.fn(async()=> 'token'),getAccessToken:jest.fn(async()=> 'journal-token'),getAuthority:jest.fn(()=>({userId:user,product:'journal' as const,clientId:journal,sessionGeneration:'j'})),cancel:jest.fn(async()=>undefined)},lucid:{begin:jest.fn(async()=> 'https://example.test/auth'),complete:jest.fn(async()=> 'token'),getAccessToken:jest.fn(async()=> 'lucid-token'),getAuthority:jest.fn(()=>({userId:user,product:'lucid' as const,clientId:lucid,sessionGeneration:'l'})),cancel:jest.fn(async()=>undefined)}};
 const storage={load:jest.fn(async()=>saved),save:jest.fn(async(_scope:string,value:JournalImportSnapshot,check:()=>void)=>{check();saved=structuredClone(value);})};
 const request=jest.fn(async(input:Parameters<LucidJournalImportRuntimeDependencies['request']>[0]):Promise<unknown>=>{
  if(input.path.includes('?select=id'))return[{id:1}];
  if(input.path.endsWith('/create_journal_import_grant'))return{grantId:grant,cursor,expiresAt:'2030-01-01T00:00:00Z',scope:input.body && (input.body as {p_selected_ids:unknown}).p_selected_ids===null?'all':'selected'};
  if(input.path.endsWith('/revoke_journal_import_grant'))return true;
  return{grantId:grant,items:[{id:'1',revision:grant,createdAt:null,transcript:'Dream',clientRequestId:cursor}],done:true,nextCursor:null};
 });
 const deps={journalClientId:journal,lucidClientId:lucid,getOwner:()=>currentOwner,getOwnerGeneration:()=>generation,createSession:jest.fn(async(product:'journal'|'lucid')=>sessions[product]),openAuthSession:jest.fn(async()=>({type:'success',url:'noctalia-lucid://lucid/journal-import?code=x'})),request,storage,now:()=>new Date('2026-09-09T00:00:00Z')};
 const runtime=createLucidJournalImportRuntime(deps);
 return{runtime,deps,sessions,storage,request,saved:()=>saved,changeOwner:()=>{currentOwner='00000000-0000-4000-8000-000000000009';generation='two';}};
}
it('constructs and prepares all without reading dreams or creating a grant',async()=>{
 const f=fixture();expect(f.deps.createSession).not.toHaveBeenCalled();expect(f.request).not.toHaveBeenCalled();expect(f.storage.load).not.toHaveBeenCalled();const result=await f.runtime.prepare('all');expect(result).toEqual({sourceAccount:user,perimeter:'all',knownCount:null});expect(f.deps.openAuthSession).toHaveBeenCalledTimes(2);expect(f.request).not.toHaveBeenCalled();expect(f.runtime.getState().status).toBe('ready');
});
it('reads IDs only for recent30 and creates a selected grant only after confirmation',async()=>{
 const f=fixture();await f.runtime.prepare('recent30');expect(f.request).toHaveBeenCalledTimes(1);expect(f.request.mock.calls[0][0].path).toBe('/rest/v1/dreams?select=id&order=id.desc&limit=30');const result=await f.runtime.confirmStart();expect(Object.values(result.copies)[0]).toMatchObject({text:'Dream',createdAt:null});expect(f.request.mock.calls[1][0]).toMatchObject({product:'journal',accessToken:'journal-token',body:{p_selected_ids:['1'],p_destination_client_id:lucid}});expect(f.runtime.getState().status).toBe('complete');expect(f.runtime.getState().progress?.persistedPages).toBe(1);
});
it('never turns an empty recent selection into an all grant',async()=>{
 const f=fixture();f.request.mockResolvedValueOnce([]);expect((await f.runtime.prepare('recent30')).knownCount).toBe(0);const result=await f.runtime.confirmStart();expect(result.copies).toEqual({});expect(f.request).toHaveBeenCalledTimes(1);expect(f.storage.save).not.toHaveBeenCalled();
});
it('rejects unsafe IDs and never requests a grant',async()=>{
 const f=fixture();f.request.mockResolvedValueOnce([{id:Number.MAX_SAFE_INTEGER+1}]);await expect(f.runtime.prepare('recent30')).rejects.toThrow();expect(f.request).toHaveBeenCalledTimes(1);expect(f.runtime.getState().status).toBe('error');
});
it('requires a distinct explicit confirmation and serializes duplicate starts by state',async()=>{
 const f=fixture();await expect(f.runtime.confirmStart()).rejects.toThrow();await f.runtime.prepare('all');const pending=f.runtime.confirmStart();await expect(f.runtime.confirmStart()).rejects.toThrow();await pending;
});
it('rejects wrong OAuth owner before any Journal data read',async()=>{
 const f=fixture();f.sessions.journal.getAuthority.mockReturnValueOnce({userId:'other',product:'journal',clientId:journal,sessionGeneration:'j'});await expect(f.runtime.prepare('all')).rejects.toThrow();expect(f.request).not.toHaveBeenCalled();expect(f.sessions.journal.cancel).toHaveBeenCalled();
});
it('rejects malformed grants rather than attempting the reader',async()=>{
 const f=fixture();await f.runtime.prepare('all');f.request.mockResolvedValueOnce({grantId:'invalid'});await expect(f.runtime.confirmStart()).rejects.toThrow();expect(f.storage.save).not.toHaveBeenCalled();
});
it('cancels pending pages and revokes the active grant, without a late write',async()=>{
 const f=fixture();await f.runtime.prepare('all');const waiting=deferred<unknown>(),entered=deferred<void>();const original=f.request.getMockImplementation()!;f.request.mockImplementation(async input=>{if(input.path.endsWith('/read_journal_import_page')){entered.resolve();return waiting.promise;}return original(input);});const pending=f.runtime.confirmStart();await entered.promise;await f.runtime.cancel();waiting.resolve({grantId:grant,items:[],done:true,nextCursor:null});await expect(pending).rejects.toThrow();expect(f.storage.save).not.toHaveBeenCalled();expect(f.request).toHaveBeenCalledWith(expect.objectContaining({path:'/rest/v1/rpc/revoke_journal_import_grant'}));expect(f.runtime.getState().status).toBe('cancelled');
});
it('clears displayed copies on owner change and stops late browser results',async()=>{
 const f=fixture(),browser=deferred<{type:string;url:string}>();f.deps.openAuthSession.mockReturnValueOnce(browser.promise);const pending=f.runtime.prepare('all');await Promise.resolve();await Promise.resolve();f.changeOwner();await f.runtime.ownerChanged();browser.resolve({type:'success',url:'callback'});await expect(pending).rejects.toThrow();expect(f.runtime.getState().snapshot).toBeNull();expect(f.request).not.toHaveBeenCalled();
});
it('edits and deletes local copies without an upload and erases even if revocation fails',async()=>{
 const f=fixture();await f.runtime.prepare('all');const snapshot=await f.runtime.confirmStart(),identity=Object.keys(snapshot.copies)[0];f.request.mockClear();await f.runtime.updateCopy(identity,{type:'edit',text:'Local edit'});expect(f.request).not.toHaveBeenCalled();f.request.mockRejectedValueOnce(Error('offline'));const erased=await f.runtime.deleteAll();expect(erased.copies[identity]).toMatchObject({deleted:true,text:''});expect(f.runtime.getState().errorCode).toBe('cleanup_failed');
});
it('retains local inspection without OAuth client configuration and keeps state referentially stable',async()=>{
 const f=fixture();const runtime=createLucidJournalImportRuntime({...f.deps,journalClientId:'',lucidClientId:''});expect(runtime.getState()).toBe(runtime.getState());expect((await runtime.inspectLocal()).copies).toEqual({});await expect(runtime.prepare('all')).rejects.toThrow();expect(f.request).not.toHaveBeenCalled();expect(f.deps.createSession).not.toHaveBeenCalled();
});
it('revokes a grant whose creation completes after cancellation without importing',async()=>{
 const f=fixture();await f.runtime.prepare('all');const waiting=deferred<unknown>(),entered=deferred<void>();const original=f.request.getMockImplementation()!;f.request.mockImplementation(async input=>{if(input.path.endsWith('/create_journal_import_grant')){entered.resolve();return waiting.promise;}return original(input);});const pending=f.runtime.confirmStart();await entered.promise;await f.runtime.cancel();waiting.resolve({grantId:grant,cursor,expiresAt:'2030-01-01T00:00:00Z',scope:'all'});await expect(pending).rejects.toThrow();expect(f.request).toHaveBeenCalledWith(expect.objectContaining({path:'/rest/v1/rpc/revoke_journal_import_grant',body:{p_grant_id:grant}}));expect(f.storage.save).not.toHaveBeenCalled();
});
it('supports guest local inspection and erasure without OAuth or network',async()=>{
 const f=fixture();const runtime=createLucidJournalImportRuntime({...f.deps,getOwner:()=>null,journalClientId:'',lucidClientId:''});expect((await runtime.inspectLocal()).copies).toEqual({});expect(f.storage.load).toHaveBeenCalledWith('guest');await runtime.deleteAll();await expect(runtime.prepare('all')).rejects.toThrow();expect(f.request).not.toHaveBeenCalled();expect(f.deps.createSession).not.toHaveBeenCalled();
});
it('retains failed cleanup and really retries revocation before cancelling the source',async()=>{
 const f=fixture();await f.runtime.prepare('all');await f.runtime.confirmStart();f.request.mockRejectedValueOnce(Error('offline'));await expect(f.runtime.cancel()).rejects.toThrow();expect(f.sessions.journal.cancel).not.toHaveBeenCalled();expect(f.runtime.getState().errorCode).toBe('cleanup_failed');await f.runtime.cancel();expect(f.request.mock.calls.filter(call=>call[0].path.endsWith('/revoke_journal_import_grant'))).toHaveLength(2);expect(f.sessions.journal.cancel).toHaveBeenCalledTimes(1);expect(f.runtime.getState().errorCode).toBeNull();
});
it('waits for source refresh and revocation before session cancellation',async()=>{
 const f=fixture();await f.runtime.prepare('all');await f.runtime.confirmStart();const refresh=deferred<string>();f.sessions.journal.getAccessToken.mockReturnValueOnce(refresh.promise);const stopping=f.runtime.cancel();await Promise.resolve();expect(f.sessions.journal.cancel).not.toHaveBeenCalled();refresh.resolve('rotated-token');await stopping;expect(f.request).toHaveBeenCalledWith(expect.objectContaining({accessToken:'rotated-token',path:'/rest/v1/rpc/revoke_journal_import_grant'}));expect(f.sessions.journal.cancel).toHaveBeenCalledTimes(1);
});

it.each([ { getOwner: () => null }, { journalClientId: '' }, { remoteConfigured: false } ])('reports unsupported authorization while preserving local access', async overrides => {
 const f=fixture(), runtime=createLucidJournalImportRuntime({...f.deps,...overrides});
 await runtime.inspectLocal(); const snapshot=runtime.getState().snapshot;
 expect(runtime.canPrepare()).toBe(false);
 await expect(runtime.prepare('all')).rejects.toThrow();
 expect(runtime.getState()).toMatchObject({status:'error',errorCode:'unavailable',snapshot});
 expect(f.deps.createSession).not.toHaveBeenCalled();expect(f.request).not.toHaveBeenCalled();
 await runtime.deleteAll();
});
it('preserves saved copies after failed edits and clears the error on retry',async()=>{
 const f=fixture();await f.runtime.prepare('all');const snapshot=await f.runtime.confirmStart(),identity=Object.keys(snapshot.copies)[0];
 f.storage.save.mockRejectedValueOnce(Error('disk'));
 await expect(f.runtime.updateCopy(identity,{type:'edit',text:'Edit'})).rejects.toThrow();
 expect(f.runtime.getState()).toMatchObject({errorCode:'unavailable',snapshot});
 await f.runtime.updateCopy(identity,{type:'edit',text:'Edit'});
 expect(f.runtime.getState().errorCode).toBeNull();
 expect(f.runtime.getState().snapshot?.copies[identity].text).toBe('Edit');
});

it('erases departed-owner credentials even if revocation fails without refreshing',async()=>{
 const f=fixture();await f.runtime.prepare('all');await f.runtime.confirmStart();
 f.changeOwner();f.sessions.journal.getAccessToken.mockClear();f.sessions.journal.getAccessToken.mockRejectedValue(Error('owner changed'));f.request.mockRejectedValue(Error('offline'));
 await f.runtime.ownerChanged();
 expect(f.sessions.journal.getAccessToken).not.toHaveBeenCalled();
 expect(f.sessions.journal.cancel).toHaveBeenCalled();expect(f.sessions.lucid.cancel).toHaveBeenCalled();
 expect(f.runtime.getState().snapshot).toBeNull();
});

it('does not cancel shared credentials again when the old browser returns after disposal',async()=>{
 const f=fixture(),browser=deferred<{type:string;url:string}>();f.deps.openAuthSession.mockReturnValueOnce(browser.promise);
 const pending=f.runtime.prepare('all');const rejected=expect(pending).rejects.toThrow();
 while(!f.deps.openAuthSession.mock.calls.length) await Promise.resolve();
 await f.runtime.dispose();expect(f.sessions.journal.cancel).toHaveBeenCalledTimes(1);
 browser.resolve({type:'success',url:'callback'});await rejected;
 expect(f.sessions.journal.cancel).toHaveBeenCalledTimes(1);
 expect(f.sessions.journal.complete).not.toHaveBeenCalled();
});

it('does not erase credentials for a session factory finishing after disposal before begin',async()=>{
 const f=fixture(),factory=deferred<typeof f.sessions.journal>();f.deps.createSession.mockReturnValueOnce(factory.promise);
 const pending=f.runtime.prepare('all');const rejected=expect(pending).rejects.toThrow();
 while(!f.deps.createSession.mock.calls.length) await Promise.resolve();
 await f.runtime.dispose();factory.resolve(f.sessions.journal);await rejected;
 expect(f.sessions.journal.begin).not.toHaveBeenCalled();expect(f.sessions.journal.cancel).not.toHaveBeenCalled();
});
