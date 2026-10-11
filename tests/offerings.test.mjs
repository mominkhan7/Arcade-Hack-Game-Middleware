import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {offerings,buildOffering,offeringArtwork} from '../dist/craftkit-offerings.js';
import {CraftKitClient} from '../dist/craftkit-client.js';
const moves=[{from:'e2',to:'e4',color:'w'},{from:'e7',to:'e5',color:'b'}];
test('game-ready templates turn actual gameplay into deterministic, distinct artwork',()=>{
 assert.equal(offerings.length,10);assert.deepEqual([...new Set(offerings.map(o=>o.category))],['accomplishment','play']);
 assert.equal(offeringArtwork('move-art',{moves}),offeringArtwork('move-art',{moves}));assert.notEqual(offeringArtwork('move-art',{moves}),offeringArtwork('move-art',{moves:moves.slice(0,1)}));
 const trail=[{x:0,z:0,hue:.4},{x:3,z:4,hue:.8}];assert.notEqual(offeringArtwork('journey-art',{trail}),offeringArtwork('journey-art',{trail:[...trail,{x:10,z:2,hue:.3}]}));
 assert.throws(()=>offeringArtwork('move-art',{moves:[{from:'invalid',to:'e4',color:'w'}]}));assert.throws(()=>offeringArtwork('journey-art',{trail:[]}));
});
test('offering snapshots preserve original artwork, source attribution and output boundaries',()=>{
 const input={sourceEventId:'run-42-shrine',type:'pendant',activity:{emblem:'moon'}};
 const config=buildOffering('achievement-evolution',input);input.activity.emblem='sun';assert.equal(config.design.emblem,'moon');assert.equal(config.design.pendantStyle,'ornate');assert.equal(config.design.craftkitOffering.category,'accomplishment');assert.equal(config.story.at(-1).sourceEventId,'run-42-shrine');
 const svg='<svg xmlns="http://www.w3.org/2000/svg"><path/></svg>';assert.equal(buildOffering('crafted-pattern',{sourceEventId:'loom-42',design:{referenceSvg:svg}}).design.referenceSvg,svg);
 assert.throws(()=>buildOffering('move-art',{sourceEventId:'42',type:'pendant',activity:{moves}}));assert.throws(()=>buildOffering('move-art',{activity:{moves}}));assert.throws(()=>buildOffering('avatar-portrait',{sourceEventId:'42'}));
});
test('SDK offering integration submits generated artwork and template provenance to the existing service',async()=>{
 let submitted;const client=new CraftKitClient({gameId:'chess-atelier',fetcher:async(url,init)=>{submitted=JSON.parse(init.body);return Response.json({id:'ks_test'});}});
 const record=await client.createFromOffering('move-art',{sourceEventId:'match-42',type:'pillow',activity:{moves}});assert.equal(record.id,'ks_test');assert.equal(submitted.recipe,'pillow');assert.ok(submitted.design.referenceSvg.startsWith('<svg'));assert.equal(submitted.design.craftkitOffering.id,'move-art');
});
test('the three featured games use shared offerings rather than isolated checkout requests',()=>{
 for(const [file,ids] of [['game.js',['achievement-evolution','achievement-emblem']],['keepsakes.js',['crafted-pattern','avatar-portrait']],['pattern-garden.js',['journey-art']],['chess-game.js',['match-victory','move-art']]]){
  const source=readFileSync(new URL('../dist/'+file,import.meta.url),'utf8');for(const id of ids)assert.ok(source.includes(id));
  // Chess Atelier's one-sheet checkout creates its keepsake through the shared offering SDK (createFromOffering).
  if(file==='chess-game.js'){assert.match(source,/matchCheckout\.open\(/);assert.match(readFileSync(new URL('../dist/match-checkout.js',import.meta.url),'utf8'),/client\.createFromOffering\(/);}
  else assert.match(source,/openOffering\(/);
 }
});
