import { createJournalImportEngine, type JournalImportSnapshot, type JournalImportStorage, type JournalImportProgress } from '@/lib/lucid/journalImport';
import { createLucidJournalImportReader, type ConfirmedJournalImportGrant } from './lucidJournalImportReader';
import { createProductOAuthSession } from './productOAuthSession';

export const LUCID_JOURNAL_IMPORT_CALLBACK = 'noctalia-lucid://lucid/journal-import';
export type JournalImportPerimeter = 'all' | 'recent30';
export type JournalImportRuntimeStatus = 'idle' | 'preparing' | 'ready' | 'importing' | 'complete' | 'cancelled' | 'error';
export interface JournalImportPreparation { sourceAccount: string; perimeter: JournalImportPerimeter; knownCount: number | null }
export interface LucidJournalImportRuntimeState {
  status: JournalImportRuntimeStatus;
  preparation: JournalImportPreparation | null;
  snapshot: JournalImportSnapshot | null;
  progress: JournalImportProgress | null;
  errorCode: 'unavailable' | 'cleanup_failed' | null;
}
export type JournalImportCopyAction = { type: 'edit'; text: string } | { type: 'delete' | 'keepLocal' | 'useIncoming' };
export interface LucidJournalImportRuntime {
  getState(): LucidJournalImportRuntimeState;
  subscribe(listener: () => void): () => void;
  prepare(perimeter: JournalImportPerimeter): Promise<JournalImportPreparation>;
  confirmStart(): Promise<JournalImportSnapshot>;
  inspectLocal(): Promise<JournalImportSnapshot>;
  updateCopy(identity: string, action: JournalImportCopyAction): Promise<JournalImportSnapshot>;
  deleteAll(): Promise<JournalImportSnapshot>;
  cancel(): Promise<void>;
  ownerChanged(): Promise<void>;
  dispose(): Promise<void>;
}
type ProductSession = Pick<ReturnType<typeof createProductOAuthSession>, 'begin' | 'complete' | 'getAccessToken' | 'getAuthority' | 'cancel'>;
export interface LucidJournalImportRuntimeDependencies {
  journalClientId: string; lucidClientId: string;
  getOwner(): string | null; getOwnerGeneration(): string;
  createSession(product: 'journal' | 'lucid'): Promise<ProductSession>;
  openAuthSession(url: string, redirect: string): Promise<{ type: string; url?: string }>;
  /** Only scoped bearer requests; never a legacy auth fallback. */
  request(input: { product: 'journal' | 'lucid'; accessToken: string; path: string; body?: object }): Promise<unknown>;
  storage: JournalImportStorage; now(): Date;
}
const unavailable = () => new Error('Journal import unavailable');
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { for (const item of Object.values(value)) freeze(item); Object.freeze(value); }
  return value;
}

/** No network or session construction until prepare is explicitly invoked. */
export function createLucidJournalImportRuntime(deps: LucidJournalImportRuntimeDependencies): LucidJournalImportRuntime {
  let state: LucidJournalImportRuntimeState = freeze({ status: 'idle', preparation: null, snapshot: null, progress: null, errorCode: null });
  let epoch = 0, disposed = false;
  let source: ProductSession | null = null, destination: ProductSession | null = null;
  let selection: string[] | null = null;
  let preparedOwnerGeneration: string | null = null;
  let activeGrant: string | null = null;
  const pendingCleanup: { source: ProductSession | null; destination: ProductSession | null; grant: string | null }[] = [];
  let cleanupTail: Promise<unknown> = Promise.resolve();
  let readPage: ReturnType<typeof createLucidJournalImportReader> | null = null;
  const listeners = new Set<() => void>();
  const emit = (patch: Partial<LucidJournalImportRuntimeState>) => {
    state = freeze({ ...state, ...patch });
    for (const listener of listeners) { try { listener(); } catch { /* Observers never control persistence. */ } }
  };
  const owner = () => { const value = deps.getOwner(); if (disposed || !uuid(value) || !deps.getOwnerGeneration()) throw unavailable(); return value; };
  const check = (version: number, user: string | null, generation: string) => {
    if (disposed || epoch !== version || deps.getOwner() !== user || deps.getOwnerGeneration() !== generation) throw unavailable();
  };
  const engine = createJournalImportEngine({ storage: deps.storage,
    readPage: input => { if (!readPage) throw unavailable(); return readPage(input); },
    getCurrentDestinationScope: () => uuid(deps.getOwner()) ? `user:${deps.getOwner()}` : 'guest',
    getCurrentSourceAccount: deps.getOwner, now: deps.now,
    onProgress: progress => { if (!disposed && state.status === 'importing' && deps.getOwnerGeneration() === preparedOwnerGeneration) emit({ progress: { ...progress } }); },
  });
  const request = async (session: ProductSession, product: 'journal' | 'lucid', path: string, body: object | undefined, guard: () => void) => {
    guard(); const bearer = await session.getAccessToken(); guard();
    const result = await deps.request({ product, accessToken: bearer, path, body });
    try { guard(); } catch {
      // A cancelled grant creation can still finish on the server. Revoke that
      // returned grant with the original bearer, without publishing it locally.
      if (path.endsWith('/create_journal_import_grant') && uuid((result as {grantId?:unknown})?.grantId)) {
        try {
          const revoked = await deps.request({product:'journal',accessToken:bearer,path:'/rest/v1/rpc/revoke_journal_import_grant',body:{p_grant_id:(result as {grantId:string}).grantId}});
          if (revoked !== true) throw unavailable();
        } catch {
          pendingCleanup.push({source:session,destination:null,grant:(result as {grantId:string}).grantId});
          emit({errorCode:'cleanup_failed'});
        }
      }
      throw unavailable();
    }
    return result;
  };
  const stop = async (clearSnapshot: boolean) => {
    const version = ++epoch; engine.cancel(); readPage = null;
    if (source || destination || activeGrant) pendingCleanup.push({source,destination,grant:activeGrant});
    source = null; destination = null; activeGrant = null; selection = null; preparedOwnerGeneration = null;
    emit({ status: 'cancelled', preparation: null, progress: null, errorCode: pendingCleanup.length ? state.errorCode : null, ...(clearSnapshot ? { snapshot: null } : {}) });
    const cleanup = async () => {
      let failed = false;
      for (const entry of [...pendingCleanup]) {
        try {
          if (entry.grant) {
            if (!entry.source) throw unavailable();
            // Keep the source session usable until refresh and revocation finish.
            const accessToken = await entry.source.getAccessToken();
            const revoked = await deps.request({product:'journal',accessToken,path:'/rest/v1/rpc/revoke_journal_import_grant',body:{p_grant_id:entry.grant}});
            if (revoked !== true) throw unavailable();
            entry.grant = null;
          }
          if (entry.source) { await entry.source.cancel(); entry.source = null; }
          if (entry.destination) { await entry.destination.cancel(); entry.destination = null; }
          pendingCleanup.splice(pendingCleanup.indexOf(entry),1);
        } catch { failed = true; }
      }
      if (epoch === version) emit({errorCode:failed?'cleanup_failed':null});
      if (failed) throw unavailable();
    };
    const result = cleanupTail.then(cleanup,cleanup); cleanupTail = result.catch(() => undefined); await result;
  };

  const local = async (action: (scope: string) => Promise<JournalImportSnapshot>) => {
    const user = deps.getOwner(), version = epoch, generation = deps.getOwnerGeneration();
    if (disposed || !generation) throw unavailable();
    try { const result = await action(uuid(user) ? `user:${user}` : 'guest'); check(version,user,generation); emit({ snapshot: result }); return copy(result); }
    catch { if (epoch === version && !disposed) emit({ errorCode: 'unavailable' }); throw unavailable(); }
  };
  const runtime: LucidJournalImportRuntime = {
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async prepare(perimeter) {
      const user = owner();
      if (!['all','recent30'].includes(perimeter) || ['preparing','importing','ready'].includes(state.status) || !uuid(deps.journalClientId) || !uuid(deps.lucidClientId) || deps.journalClientId === deps.lucidClientId) throw unavailable();
      if (pendingCleanup.length || source || destination || activeGrant) await stop(false);
      const version = ++epoch, generation = deps.getOwnerGeneration();
      const guard = () => check(version,user,generation);
      emit({ status: 'preparing', preparation: null, progress: null, errorCode: null });
      try {
        await Promise.all([source?.cancel(),destination?.cancel()]); guard(); source = null; destination = null;
        for (const product of ['journal','lucid'] as const) {
          const session = await deps.createSession(product);
          try {
            guard(); if (product === 'journal') source = session; else destination = session;
            const url = await session.begin(); guard();
            const result = await deps.openAuthSession(url,LUCID_JOURNAL_IMPORT_CALLBACK); guard();
            if (result.type !== 'success' || !result.url) throw unavailable();
            await session.complete(result.url); guard();
            const identity = session.getAuthority();
            if (!identity || identity.userId !== user || identity.product !== product || identity.clientId !== (product === 'journal' ? deps.journalClientId : deps.lucidClientId)) throw unavailable();
          } catch { await session.cancel(); throw unavailable(); }
        }
        selection = null;
        if (perimeter === 'recent30') {
          const rows = await request(source!,'journal','/rest/v1/dreams?select=id&order=id.desc&limit=30',undefined,guard);
          if (!Array.isArray(rows) || rows.length > 30) throw unavailable();
          selection = rows.map(row => {
            const id = row?.id;
            if ((typeof id === 'number' && (!Number.isSafeInteger(id) || id <= 0)) ||
              !['number','string'].includes(typeof id) || !/^[1-9][0-9]*$/.test(String(id)) || BigInt(id) > 9223372036854775807n) throw unavailable();
            return String(id);
          });
          if (new Set(selection).size !== selection.length) throw unavailable();
        }
        guard(); preparedOwnerGeneration = generation;
        const preparation = { sourceAccount: user, perimeter, knownCount: selection?.length ?? null };
        emit({ status: 'ready', preparation }); return { ...preparation };
      } catch {
        if (epoch === version) { await Promise.allSettled([source?.cancel(),destination?.cancel()]); source = null; destination = null; emit({ status: 'error', errorCode: 'unavailable' }); }
        throw unavailable();
      }
    },
    async confirmStart() {
      const user = owner(), version = epoch, generation = deps.getOwnerGeneration();
      if (state.status !== 'ready' || state.preparation?.sourceAccount !== user || preparedOwnerGeneration !== generation || !source || !destination) throw unavailable();
      const journal = source, lucid = destination, guard = () => check(version,user,generation);
      emit({ status: 'importing', progress: null, errorCode: null });
      try {
        if (selection?.length === 0) { const snapshot = await engine.inspect(`user:${user}`); guard(); emit({ status: 'complete', snapshot }); return copy(snapshot); }
        const raw = await request(journal,'journal','/rest/v1/rpc/create_journal_import_grant',
          { p_destination_client_id: deps.lucidClientId, p_selected_ids: selection },guard) as Record<string,unknown>;
        if (!raw || !uuid(raw.grantId) || !uuid(raw.cursor) || typeof raw.expiresAt !== 'string' ||
          !Number.isFinite(Date.parse(raw.expiresAt)) || Date.parse(raw.expiresAt) <= deps.now().getTime() || raw.scope !== (selection === null ? 'all' : 'selected')) throw unavailable();
        activeGrant = raw.grantId;
        const confirmation: ConfirmedJournalImportGrant = { confirmed: true, grantId: raw.grantId, cursor: raw.cursor,
          expiresAt: raw.expiresAt, scope: selection === null ? 'all' : 'selected', sourceAccount: user, destinationScope: `user:${user}`, destinationClientId: deps.lucidClientId };
        readPage = createLucidJournalImportReader({ confirmation, now: deps.now,
          getSessionAuthority: () => { const identity = lucid.getAuthority(); return identity?.product === 'lucid' ? { ...identity, product: 'lucid', destinationScope: `user:${user}` } : null; },
          client: { async rpc(_name,args) {
            try { const data = await request(lucid,'lucid','/rest/v1/rpc/read_journal_import_page',args,guard); return { data,error:null }; }
            catch { return { data:null,error:{message:'Import unavailable'} }; }
          } },
        });
        const snapshot = await engine.start(confirmation); guard(); emit({ status: 'complete', snapshot }); return copy(snapshot);
      } catch { if (epoch === version && !disposed) emit({ status: 'error', errorCode: 'unavailable' }); throw unavailable(); }
    },
    inspectLocal: () => local(scope => engine.inspect(scope)),
    updateCopy: (identity,action) => local(scope => engine.updateCopy(scope,identity,action)),
    async deleteAll() { try { await stop(false); } catch { /* Local erasure remains available when remote cleanup fails. */ } return local(scope => engine.deleteAllCopies(scope)); },
    cancel: () => stop(false),
    ownerChanged: () => stop(true),
    async dispose() { disposed = true; listeners.clear(); await stop(true); },
  };
  return runtime;
}

/** Explicit native entry point. Configuration and storage construction perform no network work. */
export async function createNativeLucidJournalImportRuntime(owner: {
  getOwner(): string | null; getOwnerGeneration(): string;
  projectUrl?: string; publicKey?: string;
}): Promise<LucidJournalImportRuntime> {
  const journalClientId = process.env.EXPO_PUBLIC_JOURNAL_IMPORT_JOURNAL_CLIENT_ID;
  const lucidClientId = process.env.EXPO_PUBLIC_JOURNAL_IMPORT_LUCID_CLIENT_ID;
  const [crypto,browser,{ createProductOAuthNativeStorage },
    { createProductOAuthHttpTransport },{ createLucidJournalImportStorage }] = await Promise.all([
    import('expo-crypto'),import('expo-web-browser'),import('./productOAuthNativeStorage'),
    import('./productOAuthSession'),import('./lucidJournalImportStorage'),
  ]);
  const configuration = () => {
    if (!owner.projectUrl || !owner.publicKey) throw unavailable();
    const base = new URL(owner.projectUrl);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw unavailable();
    return { projectUrl: base.origin, publicKey: owner.publicKey };
  };
  const now = () => Date.now();
  const base64url = (value: Uint8Array) => {
    let binary=''; for (const byte of value) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  };
  return createLucidJournalImportRuntime({ ...owner,journalClientId:journalClientId??'',lucidClientId:lucidClientId??'',
    storage:createLucidJournalImportStorage(),now:()=>new Date(now()),
    async createSession(product) {
      const config=configuration();
      const transport=createProductOAuthHttpTransport({...config,fetch,now});
      const clientId=product==='journal'?journalClientId:lucidClientId;
      if (!uuid(clientId)) throw unavailable();
      return createProductOAuthSession({authorizationEndpoint:config.projectUrl+'/auth/v1/oauth/authorize',clientId,product,
        redirectUri:LUCID_JOURNAL_IMPORT_CALLBACK,getExpectedOwner:owner.getOwner,getOwnerGeneration:owner.getOwnerGeneration,
        storage:await createProductOAuthNativeStorage({issuerOrigin:config.projectUrl,clientId}),transport,now,
        randomBase64Url:count=>base64url(crypto.getRandomBytes(count)),
        sha256Base64Url:async value=>(await crypto.digestStringAsync(crypto.CryptoDigestAlgorithm.SHA256,value,{encoding:crypto.CryptoEncoding.BASE64})).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''),
      });
    },
    openAuthSession:(url,redirect)=>browser.openAuthSessionAsync(url,redirect),
    async request({accessToken,path,body}) {
      // Paths are fixed by this module; caller data never chooses an origin.
      if (!path.startsWith('/rest/v1/')) throw unavailable();
      const config=configuration();
      const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),10_000);
      try {
        const response=await fetch(config.projectUrl+path,{method:body?'POST':'GET',signal:abort.signal,redirect:'error',
          headers:{apikey:config.publicKey,Authorization:`Bearer ${accessToken}`,...(body?{'Content-Type':'application/json'}:{})},
          body:body?JSON.stringify(body):undefined});
        if (!response.ok) throw unavailable();return await response.json();
      } catch {throw unavailable();} finally {clearTimeout(timer);}
    },
  });
}
