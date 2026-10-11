import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ArcadeProvider} from '../nexus/providers/arcade.js';
import {NexusService} from '../nexus/service.js';
import {configuredProvider} from '../nexus/providers/index.js';
function setup({world='print',unpaid=true,price='89.95'}={}) {
  const calls=[]; let fail=false;
  const fetcher=async(url,options)=>{
    const endpoint=new URL(url).pathname.replace('/v1','');
    if(options.method==='PUT'){assert.equal(options.headers.Authorization,undefined);return new Response('');}
    const body=JSON.parse(options.body); calls.push({endpoint,body});
    if(fail)return Response.json({}, {status:503});
    const category={categoryId:'cat-live',name:world==='print'?'Scarves':'Pendant Necklace',world};
    const selection={fabric:'silk'};
    const responses={
      '/categories/list':{items:[category]},
      '/categories/get':{...category,options:[{key:'fabric',values:[{value:'silk',available:true}]}],selections:selection,canManufacture:true},
      '/references/createUpload':{uploadId:'upload',uploadUrl:'https://upload.example/image',requiredHeaders:{'Content-Type':'image/png'}},
      '/references/create':{referenceId:'ref-live'},
      '/patterns/create':{jobId:'job-pattern',status:'running'},
      '/products/create':{jobId:'job-product',status:'running'},
      '/jobs/get':{jobId:body.jobId,status:'succeeded',result:body.jobId==='job-pattern'?{patternId:'pat-live',...(world==='jewelry'?{productId:'prod-live'}:{})}:{productId:'prod-live'}},
      '/products/get':{productId:'prod-live',patternId:'pat-live',selections:selection,unitPrice:price?{amount:price,currency:'USD'}:null,images:[{url:'https://preview.example/image'}],imageUrl:'https://preview.example/image',maker:{name:'Real maker'}},
      '/checkouts/create':{checkoutId:'12345',checkoutUrl:'https://checkout.example/12345'},
      '/orders/get':{orderId:'12345',status:'ordered',lines:[{productId:'prod-live',quantity:1}]},
    };
    return endpoint==='/orders/get' && unpaid?Response.json({}, {status:404}):Response.json(responses[endpoint]);
  };
  const provider=new ArcadeProvider({apiKey:'test-secret',fetcher});
  const records=new Map();const store={async insert(r){if(!records.has(r.id))records.set(r.id,structuredClone(r));return this.get(r.id);},async get(id){return structuredClone(records.get(id));},async update(r,v){if(records.get(r.id).version!==v)return false;records.set(r.id,structuredClone(r));return true;},async list(){return [...records.values()];}};
  const service=new NexusService(store,{provider,now:()=>1000});
  const input={recipe:world==='print'?'scarf':'pendant',sourceEventId:'run-live',title:'My keepsake',prompt:'Preserve my ocean sigil.',design:{emblem:'ocean',referenceSvg:'<svg/>',referencePng:'data:image/png;base64,iVBORw0KGgo='}};
  return {service,provider,input,calls,fail:()=>{fail=true;}};
}
test('live print uses actual upload, catalog defaults, jobs, preview, and money',async()=>{
 const s=setup();let r=await s.service.create('player','relic-island',s.input);
 assert.equal(r.simulated,false);assert.deepEqual(r.selections,{fabric:'silk'});
 await s.service.act('player','relic-island',r.id,'generate');
 r=await s.service.get('player','relic-island',r.id);assert.equal(r.phase,'product');
 r=await s.service.get('player','relic-island',r.id);assert.equal(r.phase,'quote');assert.equal(r.quote.subtotal.amount,'89.95');assert.equal(r.product.productId,'prod-live');
 assert.deepEqual(s.calls.find(c=>c.endpoint==='/patterns/create').body.referenceIds,['ref-live']);
 assert.equal(s.calls.find(c=>c.endpoint==='/products/create').body.selections.fabric,'silk');
 r=await s.service.act('player','relic-island',r.id,'checkout');assert.equal(r.checkout.url,'https://checkout.example/12345');
 assert.equal((await s.service.get('player','relic-island',r.id)).phase,'checkout');
 await assert.rejects(s.service.act('player','relic-island',r.id,'pay-demo'));
 await assert.rejects(s.service.act('player','relic-island',r.id,'advance-demo'));
 assert.equal(s.calls.filter(c=>c.endpoint==='/checkouts/create').length,1);
});
test('live jewelry goes directly through patterns.create with no unsupported reference',async()=>{
 const s=setup({world:'jewelry'});const r=await s.service.create('player','relic-island',s.input);
 await s.service.act('player','relic-island',r.id,'generate');
 assert.equal((await s.service.get('player','relic-island',r.id)).phase,'quote');
 const input=s.calls.find(c=>c.endpoint==='/patterns/create').body;
 assert.equal(input.categoryId,'cat-live');assert.equal(input.referenceIds,undefined);assert.match(input.prompt,/ocean/);
 assert.equal(s.calls.some(c=>c.endpoint==='/products/create'),false);
});
test('only upstream paid order advances live checkout; failures never fall back to demo',async()=>{
 const s=setup({unpaid:false});const r=await s.service.create('player','relic-island',s.input);await s.service.act('player','relic-island',r.id,'generate');await s.service.get('player','relic-island',r.id);await s.service.get('player','relic-island',r.id);await s.service.act('player','relic-island',r.id,'checkout');
 const paid=await s.service.get('player','relic-island',r.id);assert.equal(paid.phase,'order');assert.equal(paid.order.orderId,'12345');
 s.fail();await assert.rejects(s.provider.catalog());
 assert.throws(()=>configuredProvider({NEXUS_PROVIDER:'live'}));
});
test('null vendor pricing blocks checkout rather than inventing a price',async()=>{
 const s=setup({price:null});const r=await s.service.create('player','relic-island',s.input);await s.service.act('player','relic-island',r.id,'generate');await s.service.get('player','relic-island',r.id);const pending=await s.service.get('player','relic-island',r.id);
 assert.equal(pending.quote,null);await assert.rejects(s.service.act('player','relic-island',r.id,'checkout'));
});
test('stable request ids make retrying an uncertain generation safe',async()=>{
 const s=setup();const r=await s.service.create('player','relic-island',s.input);
 await s.provider.start(r,1000);const first=s.calls.find(c=>c.endpoint==='/patterns/create').body.requestId;await s.provider.start(r,1000);
 assert.equal(s.calls.filter(c=>c.endpoint==='/patterns/create')[1].body.requestId,first);assert.ok(first.length<=128);
 r.phase='failed';await s.provider.start(r,1000);assert.notEqual(s.calls.filter(c=>c.endpoint==='/patterns/create')[2].body.requestId,first);
});
