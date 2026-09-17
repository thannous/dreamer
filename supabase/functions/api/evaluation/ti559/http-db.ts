/** Local disposable-stack qualification. Provider responses are synthetic, not Gemini evidence. */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { handleChat } from '../../routes/chat.ts';
const OUTPUT='/private/tmp/ti559-http-db-run-8';
const config=JSON.parse(await Deno.readTextFile('/private/tmp/ti528-local-status.json'));
if(config.API_URL!=='http://127.0.0.1:55321') throw new Error('Only the named disposable local stack is allowed');
await Deno.mkdir(OUTPUT,{mode:0o700});
const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const fixtureId=crypto.randomUUID();
async function actor(suffix:string) {
 const email=`ti559-${fixtureId}-${suffix}@example.test`, password=crypto.randomUUID()+'Aa1!';
 const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});
 if(error||!data.user) throw new Error('Could not create isolated local actor');
 const client=createClient(config.API_URL,config.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const login=await client.auth.signInWithPassword({email,password});
 if(login.error||!login.data.session) throw new Error('Could not authenticate local actor');
 return {id:data.user.id,token:login.data.session.access_token,client};
}
const owner=await actor('owner'), other=await actor('other');
const transcript='Je me souviens seulement d’une porte bleue.';
const interpretation='Piste proposée : la porte pourrait évoquer une transition, si cela vous correspond.';
// Seed only our newly created synthetic actor. Runtime chat remains authenticated/RLS scoped.
const literal=(value:string)=>"'"+value.replaceAll("'","''")+"'";
const seed=new Deno.Command('docker',{args:['exec','-i','supabase_db_noctalia-ti528-disposable','psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],stdin:'piped',stdout:'piped',stderr:'piped'}).spawn();
const writer=seed.stdin.getWriter();
await writer.write(new TextEncoder().encode(`insert into public.dreams(user_id,transcript,title,interpretation,shareable_quote,dream_type,is_analyzed,analysis_status) values (${literal(owner.id)},${literal(transcript)},'Fixture TI559',${literal(interpretation)},'','Unknown',true,'done') returning id; insert into public.subscription_state(user_id,tier,is_active,source,source_updated_at) values (${literal(owner.id)},'plus',true,'ti559-local-synthetic',now());`));
await writer.close();
const seeded=await seed.output();
if(!seeded.success)throw new Error('Synthetic seed failed; no unrelated data changed');
const dreamId=Number(new TextDecoder().decode(seeded.stdout).split('\n')[0]);
if(!Number.isSafeInteger(dreamId)||dreamId<=0)throw new Error('Invalid synthetic identity');
let providerCalls=0;
const requests:{turn:number;thoughts:number;hasUserAssociation:boolean}[]=[];
const realFetch=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input));
 if(url.hostname==='generativelanguage.googleapis.com') {
  providerCalls++;
  if(providerCalls>20) throw new Error('Synthetic provider cap exceeded');
  const body=JSON.parse(typeof init?.body==='string'?init.body:await (input as Request).text());
  const steps=body.input;
  assertEquals(body.store,false);
  const thoughts=steps.filter((s:any)=>s.type==='thought');
  if(providerCalls>1) assert(thoughts.length>0,'Persisted signed history must be replayed');
  requests.push({turn:providerCalls,thoughts:thoughts.length,hasUserAssociation:JSON.stringify(steps).includes('ma grand-mère')});
  const answer=`Votre association reste votre point de vue personnel. Réponse synthétique ${providerCalls}.`;
  const events=[
   {event_type:'step.start',index:0,step:{type:'thought'}},
   {event_type:'step.delta',index:0,delta:{type:'thought_signature',signature:`synthetic-signature-${providerCalls}`}},
   {event_type:'step.stop',index:0},
   {event_type:'step.start',index:1,step:{type:'model_output'}},
   {event_type:'step.delta',index:1,delta:{type:'text',text:answer}},
   {event_type:'step.stop',index:1},
   {event_type:'interaction.completed',interaction:{id:`synthetic-${providerCalls}`,status:'completed',object:'interaction',model:'gemini-3.5-flash-lite'}},
  ];
  return new Response(events.map(e=>`event: ${e.event_type}\ndata: ${JSON.stringify(e)}\n\n`).join(''),{headers:{'Content-Type':'text/event-stream'}});
 }
 if(url.hostname!=='127.0.0.1') throw new Error('Unexpected network destination');
 return realFetch(input,init);
};
Deno.env.set('GEMINI_API_KEY','synthetic-provider-fixture');
const server=Deno.serve({hostname:'127.0.0.1',port:0,onListen:()=>{}},async req=>{
 const auth=req.headers.get('Authorization')??'';
 const client=createClient(config.API_URL,config.ANON_KEY,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await client.auth.getUser(auth.replace(/^Bearer /,''));
 if(error||!data.user)return new Response('Unauthorized',{status:401});
 return handleChat({req,supabase:client,user:data.user,supabaseUrl:config.API_URL,supabaseServiceRoleKey:config.SERVICE_ROLE_KEY,storageBucket:'dream-images'});
});
const url=`http://127.0.0.1:${server.addr.port}/chat`;
const association='Cette piste ne me correspond pas. Pour moi, la porte évoque ma grand-mère, pas une transition.';
const turns:any[]=[];
async function turn(token:string,message:string,requestId:string) {
 const response=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({dreamId:String(dreamId),message,lang:'fr',clientRequestId:requestId,stream:true})});
 const text=await response.text();
 if(response.status!==200)return {status:response.status};
 const events=text.split('\n\n').filter(Boolean).map(line=>JSON.parse(line.replace(/^data: /,'')));
 assert(!events.some(e=>e.error), 'No route error permitted');
 const done=events.find(e=>e.done);assert(done,'Completed event required');
 return {status:response.status,done};
}
try {
 for(let i=0;i<20;i++) {
  const id=crypto.randomUUID();
  const result=await turn(owner.token,i===0?association:`Suite de mon échange ${i+1}, sans modifier mon récit.`,id);
  assertEquals(result.status,200);turns.push({id,messageId:result.done.message.id});
 }
 const beforeDuplicate=providerCalls;
 const duplicate=await turn(owner.token,association,turns[0].id);
 assertEquals(duplicate.done.message.id,turns[0].messageId);assertEquals(providerCalls,beforeDuplicate);
 const forbidden=await turn(other.token,'Lecture interdite',crypto.randomUUID());
 assertEquals(forbidden.status,404);assertEquals(providerCalls,20);
 // Fresh client emulates a new request process reading persisted state, not a JS cache.
 const fresh=createClient(config.API_URL,config.ANON_KEY,{global:{headers:{Authorization:`Bearer ${owner.token}`}},auth:{persistSession:false,autoRefreshToken:false}});
 const stored=await fresh.from('dreams').select('transcript,interpretation').eq('id',dreamId).single();
 assertEquals(stored.error,null);assertEquals(stored.data,{transcript,interpretation});
 const history=await fresh.from('dreams').select('chat_history').eq('id',dreamId).single();
 assertEquals(history.error,null);
 const messages=history.data!.chat_history;
 assertEquals(messages.length,40);
 assert(messages.some((message:any)=>message.role==='user'&&message.text===association));
 assertEquals(messages.filter((message:any)=>message.role==='model'&&message.parts?.some((p:any)=>p.thoughtSignature)).length,20);
 assert(requests.every(r=>r.hasUserAssociation));
 await Deno.writeTextFile(`${OUTPUT}/results.json`,JSON.stringify({fixtureId,dreamId:dreamId,provider:'synthetic SSE fixture',turns:20,persistedMessages:40,signedModelMessages:20,requests,duplicateNoProvider:true,otherAccountDenied:true,transcriptUnchanged:true,analysisUnchanged:true,associationStoredAsUserMessage:true,auth:'real local password login + getUser',database:'local Postgres and real admission/completion RPC',limitations:['No real Gemini quality proof','No Android UI proof']},null,2),{mode:0o600});
 console.log('HTTP/local DB qualification passed: 20 turns, 40 messages; no real provider call.');
} finally {await server.shutdown();globalThis.fetch=realFetch;}
