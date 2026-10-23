import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEarnedRewards} from '../dist/earned-rewards.js';
import {CraftKitClient} from '../dist/craftkit-client.js';
const reward=()=>({sourceEventId:'run-1-milestone-3',offering:'achievement-emblem',type:'pendant',title:'Sun pendant',design:{referenceSvg:'<svg/>',emblem:'sun',coins:3}});
test('earned rewards survive reload and keep original artwork after customization or another unlock',()=>{
 const saved=new Map(),storage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
 const pack=createEarnedRewards(storage),input=reward();pack.add(input);input.design.emblem='moon';
 pack.add({...reward(),sourceEventId:'run-1-milestone-10',design:{referenceSvg:'<svg>ornate</svg>',coins:10}});
 const reloaded=createEarnedRewards(storage);assert.equal(reloaded.list().length,2);assert.equal(reloaded.list()[1].design.emblem,'sun');assert.equal(reloaded.list()[1].design.coins,3);
 const copy=reloaded.list();copy[1].design.emblem='ocean';assert.equal(reloaded.list()[1].design.emblem,'sun');
});
test('repeated unlocks do not replace or duplicate earned snapshots',()=>{
 const pack=createEarnedRewards();pack.add(reward());pack.add({...reward(),design:{referenceSvg:'changed'}});assert.equal(pack.list().length,1);assert.equal(pack.list()[0].design.referenceSvg,'<svg/>');
});
test('blocked or damaged browser storage does not prevent earning or shopping in the session',()=>{
 const pack=createEarnedRewards({getItem:()=>'{broken',setItem(){throw Error('quota')}});pack.add(reward());assert.equal(pack.list().length,1);assert.throws(()=>pack.add({type:'pendant'}));
});
test('an expired non-JSON demo connection gives actionable recovery instead of a Safari parsing error',async()=>{
 const client=new CraftKitClient({gameId:'relic-island',fetcher:async()=>new Response('Open this demo from the CraftKit iOS app.',{status:401})});
 await assert.rejects(client.listKeepsakes(),e=>e.status===401&&/connection expired/.test(e.message));
});
