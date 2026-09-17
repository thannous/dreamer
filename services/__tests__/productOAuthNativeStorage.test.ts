import { createHash } from 'node:crypto';
import { createProductOAuthNativeStorage } from '../productOAuthNativeStorage';
jest.mock('../lucidKeyValueStorage', () => ({ getLucidKeyValueStorage: jest.fn(), isLucidNativeKeyValueStorage: jest.fn() }));
jest.mock('../lucidTrainerSecureStorage', () => ({ isLucidTrainerEncryptedValue: jest.fn(), protectLucidTrainerStoredValue: jest.fn(), revealLucidTrainerStoredValue: jest.fn() }));
const tokens = { accessToken: 'access', refreshToken: 'refresh', expiresAt: 1234 };
function fixture() {
 const values = new Map<string,string>();
 const storage = { getItem: jest.fn(async (key:string)=>values.get(key)??null), setItem: jest.fn(async (key:string,value:string)=>{values.set(key,value);}), removeItem:jest.fn(async(key:string)=>{values.delete(key);}) };
 const deps = { storage,isNative:()=>true,hash:async(value:string)=>createHash('sha256').update(value).digest('hex'),protect:jest.fn(async(key:string,value:string)=>'protected:'+key+':'+value),reveal:jest.fn(async(key:string,value:string)=>{const prefix='protected:'+key+':';if(!value.startsWith(prefix))throw Error('bad authentication');return value.slice(prefix.length);}),isProtected:(value:string)=>value.startsWith('protected:') };
 const create=(issuerOrigin='https://one.test',clientId='client')=>createProductOAuthNativeStorage({issuerOrigin,clientId},deps);
 return { values,storage,deps,create };
}
it('round trips one protected token envelope and removes only its exact key', async()=>{
 const f=fixture(),store=await f.create();expect(await store.load()).toBeNull();await store.save(tokens);expect(f.values.size).toBe(1);expect([...f.values.values()][0]).toMatch(/^protected:/);expect(await store.load()).toEqual(tokens);await store.remove();expect(f.values.size).toBe(0);expect(f.storage.removeItem).toHaveBeenCalledWith(f.storage.setItem.mock.calls[0][0]);
});
it('separates issuer and client namespaces and normalizes equivalent origins',async()=>{
 const f=fixture();for(const args of [['https://one.test','client'],['https://two.test','client'],['https://one.test','other']])await(await f.create(...args as [string,string])).save(tokens);expect(f.values.size).toBe(3);expect(await(await f.create('https://one.test/')).load()).toEqual(tokens);
});
it('rejects plaintext, corruption, wrong scope and malformed tokens',async()=>{
 const f=fixture(),store=await f.create();await store.save(tokens);const key=[...f.values.keys()][0];
 for(const raw of ['plaintext','protected:broken','protected:'+key+':'+JSON.stringify({version:1,scope:'foreign',tokens}),'protected:'+key+':'+JSON.stringify({version:1,scope:JSON.stringify(['https://one.test','client']),tokens:{...tokens,expiresAt:null}})]){f.values.set(key,raw);await expect(store.load()).rejects.toThrow('Secure product session storage unavailable');}
});
it('rejects ciphertext copied from a different client',async()=>{
 const f=fixture(),one=await f.create(),two=await f.create('https://one.test','other');await one.save(tokens);await two.save(tokens);const keys=[...f.values.keys()];f.values.set(keys[1],f.values.get(keys[0])!);await expect(two.load()).rejects.toThrow();
});
it('fails explicitly on protection or KV errors without plaintext fallback',async()=>{
 const f=fixture(),store=await f.create();f.deps.protect.mockRejectedValueOnce(Error('secret detail'));await expect(store.save(tokens)).rejects.toThrow('Secure product session storage unavailable');expect(f.storage.setItem).not.toHaveBeenCalled();f.storage.getItem.mockRejectedValueOnce(Error('offline'));await expect(store.load()).rejects.toThrow();f.storage.setItem.mockRejectedValueOnce(Error('full'));await expect(store.save(tokens)).rejects.toThrow();f.storage.removeItem.mockRejectedValueOnce(Error('failed'));await expect(store.remove()).rejects.toThrow();
});
it('rejects a nonnative adapter before reading or writing',async()=>{
 const f=fixture();f.deps.isNative=()=>false;await expect(f.create()).rejects.toThrow();expect(f.storage.getItem).not.toHaveBeenCalled();
});
it('serializes save/remove between instances sharing a key',async()=>{
 const f=fixture(),one=await f.create(),two=await f.create();let release!:()=>void;const wait=new Promise<void>(done=>{release=done;});f.deps.protect.mockImplementationOnce(async(key,value)=>{await wait;return 'protected:'+key+':'+value;});const saving=one.save(tokens),removing=two.remove();await Promise.resolve();expect(f.storage.removeItem).not.toHaveBeenCalled();release();await saving;await removing;expect(await one.load()).toBeNull();
});
