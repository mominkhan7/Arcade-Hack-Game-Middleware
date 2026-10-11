import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {CraftKitService} from '../craftkit/service.js';
import {D1Store} from '../craftkit/stores/d1.js';
import {handleCraftKit} from '../craftkit/api.js';
import {CraftKitClient} from '../dist/craftkit-client.js';
function setup(){
  const sqlite=new DatabaseSync(':memory:');
  for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')))sqlite.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  const db={prepare(sql){return{bind(...values){return{async first(){return sqlite.prepare(sql).get(...values)||null;},async all(){return{results:sqlite.prepare(sql).all(...values)};},async run(){return{meta:sqlite.prepare(sql).run(...values)};}};}};}};
  const store=new D1Store(db);let time=10000;
  const service=new CraftKitService(store,{now:()=>time});
  return{service,store,advance:ms=>time+=ms};
}
const input=()=>({recipe:'scarf',sourceEventId:'run-1',title:'Ocean scarf',prompt:'Preserve the ocean pattern.',story:[{event:'loom-solved'}],design:{colors:['blue','gold'],referenceSvg:'<svg xmlns="http://www.w3.org/2000/svg"/>'}});
const owner='player-a',game='relic-island';
async function quoted(s){const r=await s.service.create(owner,game,input());await s.service.act(owner,game,r.id,'generate');s.advance(2500);return s.service.get(owner,game,r.id);}
test('repeated unlocks deduplicate, freeze snapshots, and isolate players and games',async()=>{
  const s=setup(),config=input(),r=await s.service.create(owner,game,config);
  config.design.colors[0]='red';assert.equal((await s.service.get(owner,game,r.id)).design.colors[0],'blue');
  assert.equal((await s.service.create(owner,game,input())).id,r.id);
  assert.notEqual((await s.service.create(owner,'signal-garden',input())).id,r.id);
  assert.notEqual((await s.service.create(owner,game,config)).id,r.id);
  await assert.rejects(s.service.get('player-b',game,r.id),e=>e.status===404);
  await assert.rejects(s.service.get(owner,'signal-garden',r.id),e=>e.status===404);
  assert.equal((await s.service.list(owner,'signal-garden')).length,1);
});
test('generation resumes from persisted state after service restart',async()=>{
  const s=setup(),r=await s.service.create(owner,game,input());
  await s.service.act(owner,game,r.id,'generate');s.advance(1400);
  assert.equal((await s.service.get(owner,game,r.id)).phase,'product');
  const restarted=new CraftKitService(s.store,{now:()=>14000});
  const ready=await restarted.get(owner,game,r.id);
  assert.equal(ready.phase,'quote');assert.equal(ready.product.patternId,ready.patternId);
  assert.equal((await restarted.act(owner,game,r.id,'generate')).productId,ready.productId);
});
test('checkout and payment retries produce one persisted order with stable attribution',async()=>{
  const s=setup(),q=await quoted(s);const c=await s.service.act(owner,game,q.id,'checkout');
  assert.equal((await s.service.act(owner,game,q.id,'checkout')).checkout.id,c.checkout.id);
  const [first,second]=await Promise.allSettled([s.service.act(owner,game,q.id,'pay-demo'),s.service.act(owner,game,q.id,'pay-demo')]);
  assert.ok([first,second].some(r=>r.status==='fulfilled'));
  const order=await s.service.get(owner,game,q.id);assert.equal(order.phase,'order');
  assert.equal((await s.service.act(owner,game,q.id,'pay-demo')).order.orderId,order.order.orderId);
  assert.deepEqual(order.attribution,{gameId:game,sourceEventId:'run-1',settlement:'unconfigured'});
  assert.equal((await s.service.list(owner,game)).length,1);
});
test('options invalidate old product and quote, quantities reprice, expiry blocks payment',async()=>{
  const s=setup(),q=await quoted(s);
  const quantity=await s.service.act(owner,game,q.id,'options',{selections:q.selections,quantity:3});
  assert.equal(quantity.quote.subtotal.amount,'264.00');assert.equal(quantity.productId,q.productId);
  await assert.rejects(s.service.act(owner,game,q.id,'options',{selections:{...q.selections,size:'fake'},quantity:1}));
  const changed=await s.service.act(owner,game,q.id,'options',{selections:{...q.selections,size:q.item.options.size[1]},quantity:3});
  assert.equal(changed.phase,'draft');assert.equal(changed.quote,null);assert.notEqual(changed.productId,q.productId);
  await assert.rejects(s.service.act(owner,game,q.id,'checkout'));
  await s.service.act(owner,game,q.id,'generate');s.advance(2500);await s.service.get(owner,game,q.id);
  await s.service.act(owner,game,q.id,'checkout');s.advance(16*60000);
  await assert.rejects(s.service.act(owner,game,q.id,'pay-demo'),e=>e.status===409);
  await s.service.act(owner,game,q.id,'refresh-quote');await s.service.act(owner,game,q.id,'checkout');
  const paid=await s.service.act(owner,game,q.id,'pay-demo');assert.equal(paid.order.total.amount,'351.44');
  await assert.rejects(s.service.act(owner,game,q.id,'options',{selections:q.selections,quantity:1}));
});
test('fulfillment fast-forward retries do not skip stages',async()=>{
  const s=setup(),q=await quoted(s);await s.service.act(owner,game,q.id,'checkout');await s.service.act(owner,game,q.id,'pay-demo');
  const first=await s.service.act(owner,game,q.id,'advance-demo',{expectedStatus:'ordered'});
  const retry=await s.service.act(owner,game,q.id,'advance-demo',{expectedStatus:'ordered'});
  assert.equal(first.order.status,'inProduction');assert.equal(retry.order.status,'inProduction');
});
test('failed and timed-out jobs retain saved designs',async()=>{
  const s=setup(),config=input();config.design.demoFailure=true;
  const r=await s.service.create(owner,game,config);await s.service.act(owner,game,r.id,'generate');
  assert.equal((await s.service.get(owner,game,r.id)).phase,'failed');
  const t=input();t.design.demoTimeout=true;const timeout=await s.service.create(owner,game,t);await s.service.act(owner,game,timeout.id,'generate');s.advance(61000);
  assert.equal((await s.service.get(owner,game,timeout.id)).phase,'failed');
  assert.equal((await s.service.get(owner,game,timeout.id)).design.referenceSvg,t.design.referenceSvg);
});
test('API rejects missing identity, cross-origin mutations, and malformed data',async()=>{
  const {store}=setup();const headers={'X-CraftKit-Game':game,'Content-Type':'application/json'};
  assert.equal((await handleCraftKit(new Request('https://game.test/api/craftkit/keepsakes',{headers}),store,null)).status,401);
  assert.equal((await handleCraftKit(new Request('https://game.test/api/craftkit/keepsakes',{method:'POST',headers:{...headers,Origin:'https://evil.test'},body:'{}'}),store,owner)).status,403);
  assert.equal((await handleCraftKit(new Request('https://game.test/api/craftkit/keepsakes',{method:'POST',headers,body:'null'}),store,owner)).status,400);
});
test('two SDK clients use the same API with separate game records',async()=>{
  const {store}=setup();const fetcher=(url,options)=>handleCraftKit(new Request('https://game.test'+url,options),store,owner);
  const relic=new CraftKitClient({gameId:game,fetcher}),signal=new CraftKitClient({gameId:'signal-garden',fetcher});
  const a=await relic.createKeepsake(input()),b=await signal.createKeepsake(input());
  assert.notEqual(a.id,b.id);assert.equal((await relic.listKeepsakes()).length,1);assert.equal((await signal.listKeepsakes()).length,1);
  await assert.rejects(signal.getKeepsake(a.id),e=>e.status===404);
});

// Exercise the rename against persisted pre-CraftKit records and old integrations.
test('CraftKit preserves legacy records, SDK imports, and API headers', async () => {
  const s=setup(), record=await s.service.create(owner,game,input());
  delete record.requestNamespace;
  await s.store.update(record,record.version);
  assert.equal((await s.service.create(owner,game,input())).requestNamespace,undefined);
  assert.equal((await s.service.list(owner,game)).length,1);
  const response=await handleCraftKit(new Request('https://game.example/api/nexus/keepsakes', {
    headers:{'X-Nexus-Game':game}
  }),s.store,owner);
  assert.equal(response.status,200);
  assert.equal((await response.json())[0].id,record.id);
  const {NexusClient}=await import('../dist/nexus-client.js');
  const client=new NexusClient({gameId:game,fetcher:async(url,options)=>
    handleCraftKit(new Request('https://game.example'+url,options),s.store,owner)});
  assert.equal((await client.listKeepsakes())[0].id,record.id);
  assert.equal((await s.service.create(owner,game,{...input(),sourceEventId:'new-run'})).requestNamespace,'craftkit');
});
