import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { guardedFetch, validate } from './completion.ts';
import completionFixtures from './completion-fixtures.json' with { type: 'json' };
import originals from './followup-fixtures.json' with { type: 'json' };
Deno.test('completion corpus preserves historical cases and covers the real truncation boundary', () => {
 const fixtures = validate(completionFixtures);
 assertEquals(fixtures.slice(0,6), originals);
 assertEquals(fixtures.length,12);
});
Deno.test('completion budget reserves before dispatch and blocks retries, excess and other hosts', async () => {
 let slot=1, sends=0; const receipts:number[]=[];
 const send=guardedFetch((() => { assertEquals(receipts.length,sends+1); sends++; return Promise.resolve(new Response('ok')); }) as typeof fetch, async count => { receipts.push(count); }, () => slot);
 const url='https://generativelanguage.googleapis.com/v1beta/interactions';
 await send(url);
 await assertRejects(() => send(url));
 for(slot=2;slot<=24;slot++) await send(url);
 await assertRejects(() => send(url));
 assertEquals(sends,24);
 slot=1;
 const rejected=guardedFetch((() => { throw new Error('must not dispatch'); }) as typeof fetch,async()=>{},()=>slot);
 await assertRejects(() => rejected('https://example.com'));
 const failedReceipt=guardedFetch((() => { throw new Error('must not dispatch'); }) as typeof fetch,async()=>{throw new Error('disk failure');},()=>slot);
 await assertRejects(() => failedReceipt(url));
 await assertRejects(() => failedReceipt(url));
});
