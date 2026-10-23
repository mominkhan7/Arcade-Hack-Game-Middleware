import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {jewelryPrompt} from '../dist/jewelry-design.js';
import {webcrypto} from 'node:crypto';

function game(formats=['pendant','scarf','pillow']) {
  const elements=new Map();
  const node=()=>({textContent:'',innerHTML:'',hidden:false,open:false,disabled:false,value:'demo',style:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},replaceChildren(){},addEventListener(){},focus(){},showModal(){this.open=true},close(){this.open=false}});
  const element=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id)};
  const keepsakes=readFileSync(new URL('../dist/keepsakes.js',import.meta.url),'utf8');
  const milestoneCode=keepsakes.slice(keepsakes.indexOf('export const milestones='),keepsakes.indexOf('\nexport let appearance')).replace('export const','globalThis.milestones =');
  const milestones=vm.runInNewContext(milestoneCode.replace('globalThis.milestones = milestones=','globalThis.milestones ='));
  const timers=[];let forgeConfig,forgeCallbacks;
  const context=vm.createContext({
    console,jewelryPrompt,structuredClone,crypto:webcrypto,performance:{now:()=>0},setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout(){},requestAnimationFrame(){},addEventListener(){},window:{addEventListener(){}},
    document:{getElementById:element,querySelector:element,querySelectorAll:()=>[],createElement:node,addEventListener(){}},
    player:{position:{x:0,y:0,z:0},rotation:{y:0}},milestones,
    sigils:Object.fromEntries(['sun','moon','mountain','ocean'].map(name=>[name,{name,world:name}])),sigilSvg:()=>'<svg/>',feedback(){},burst(){},setWorldTheme(){},applySigilOutfit(){},updateTrail(){},resetPlayer(){},createCoins(){},canWalk:()=>true,render(){},shrineScreenPosition:()=>({visible:false}),
    appearance:{scarf:'#123456',coat:'#654321',pattern:'stars'},rug:{palette:'lagoon',tiles:Array(9).fill(0)},
    printArtwork:type=>`<svg>${type}</svg>`,productMockup:type=>`<svg>${type}</svg>`,productSvg:type=>`<svg>${type}</svg>`,openLoom(){},openStudio(){},prompt(){},forgeSnapshot:()=>null,
    openEarnedCollection(){},recordEarnedReward(c){context.lastEarned=structuredClone(c);},initKeepsakes(){},initForge:c=>{forgeCallbacks=c},openOffering:(id,c)=>{forgeConfig=c;forgeConfig.offering=id;forgeCallbacks.pause()},openForge:c=>{forgeConfig=c;forgeCallbacks.pause()},supportedFormats:async()=>formats
  });
  vm.runInContext(readFileSync(new URL('../dist/game.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,''),context);
  const run=code=>vm.runInContext(code,context);
  const settle=async()=>{await Promise.resolve();await Promise.resolve()};
  return {elements,element,run,settle,timers,milestones,get forgeConfig(){return forgeConfig},get forgeCallbacks(){return forgeCallbacks}};
}

test('each earned chapter offers a supported category after celebration and never starts commerce itself',async()=>{
 const g=game();
 assert.deepEqual(Array.from(g.milestones,m=>m.type),['pendant','scarf','pillow','pendant','scarf']);
 for(let tier=0;tier<5;tier++){
  g.run(`state={...state,phase:'playing',tier:${tier},collected:milestones[${tier}].coins,target:milestones[${tier}].coins,puzzleSolved:true,earned:false};awaken()`);
  g.timers.at(-1)();await g.settle();
  assert.equal(g.element('reward-dialog').open,true);
  assert.equal(g.element('continue').hidden,false);
  assert.equal(g.element('reward-offer').hidden,false);
  assert.equal(g.forgeConfig,undefined);
 }
});
test('unavailable or empty catalogs retain the reward without a purchase offer',async()=>{
 for(const formats of [[],['scarf','pillow']]){
  const g=game(formats);g.run("state={...state,phase:'playing',collected:3,target:3,puzzleSolved:true};awaken()");g.timers.at(-1)();await g.settle();
  assert.equal(g.element('reward-dialog').open,true);assert.equal(g.element('reward-offer').hidden,true);
 }
});
test('declining or closing an opted-in preview returns to exploration and does not repeat the offer',async()=>{
 const g=game();g.run("state={...state,phase:'playing',collected:3,target:3,puzzleSolved:true};awaken()");g.timers.at(-1)();await g.settle();
 g.element('arcade-forge').onclick();assert.equal(g.forgeConfig.type,'pendant');
 g.forgeCallbacks.resume();assert.equal(g.run('state.phase'),'playing');assert.equal(g.run('state.target'),6);assert.equal(g.element('reward-dialog').open,false);
 g.run("state={...state,phase:'reward',tier:4,collected:12,target:12,earned:true};continueJourney()");
 assert.equal(g.run('state.phase'),'playing');assert.equal(g.run('ready()'),false);assert.equal(g.element('reward-dialog').open,false);
});

test('ten coins unlock an ornate pendant with a distinct design brief and stable achievement source',async()=>{
 const g=game();g.run("state={...state,phase:'playing',tier:3,collected:10,target:10,puzzleSolved:true,earned:false};awaken()");g.timers.at(-1)();await g.settle();
 assert.equal(g.element('arcade-forge').textContent,'Buy ornate sigil pendant');g.element('arcade-forge').onclick();
 assert.equal(g.forgeConfig.design.pendantStyle,'ornate');assert.equal(g.forgeConfig.design.emblem,'sun');assert.match(g.forgeConfig.sourceEventId,/-milestone-10$/);assert.match(g.forgeConfig.prompt,/filigree/);assert.match(g.forgeConfig.prompt,/sculptural/);assert.equal(g.forgeConfig.design.designLanguageVersion,2);assert.doesNotMatch(g.forgeConfig.prompt,/platinum/i);
});

test('an earned product remains identified by its original milestone before the next chapter',async()=>{
 const g=game();g.run("state={...state,phase:'playing',collected:3,target:3,puzzleSolved:true};awaken()");g.timers.at(-1)();await g.settle();
 assert.equal(g.run('lastEarned.type'),'pendant');assert.equal(g.run('lastEarned.design.coins'),3);
 g.element('continue').onclick();assert.equal(g.run('state.target'),6);assert.equal(g.run('lastEarned.design.coins'),3);assert.equal(g.run('lastEarned.offering'),'achievement-emblem');
});
