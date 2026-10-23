import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import {productMockup,productPreview} from '../dist/product-mockup.js';
import {createEarnedRewards} from '../dist/earned-rewards.js';
import {sigilSvg} from '../dist/sigils.js';

test('real vendor previews take precedence; simulations stay explicitly illustrative',()=>{
 const design={referenceSvg:'<svg xmlns="http://www.w3.org/2000/svg"/>'};
 const real=productPreview({recipe:'scarf',design,simulated:false,product:{imageUrl:'https://example.com/actual.png'}});
 assert.ok(real.includes('https://example.com/actual.png'));assert.ok(real.includes('Actual Arcade product preview'));assert.ok(!real.includes('mockup-scarf.png'));
 const demo=productPreview({recipe:'scarf',design,simulated:true,product:{imageUrl:'https://example.com/fixture.png'}});
 assert.ok(demo.includes('mockup-scarf.png'));assert.ok(demo.includes('Illustrative mockup'));assert.ok(!demo.includes('fixture.png'));
});
test('each supported product uses its photographic base and embeds artwork as an inert image',()=>{
 const svg='<svg xmlns="http://www.w3.org/2000/svg"><text>&lt;my design&gt;</text></svg>';
 for(const type of ['pendant','scarf','pillow']){
  const scene=productMockup(type,svg,'moon');assert.ok(scene.includes(`mockup-${type}.png`));
  assert.ok(existsSync(new URL(`../dist/assets/mockup-${type}.png`,import.meta.url)));
  if(type!=='pendant')assert.ok(scene.includes(encodeURIComponent(svg)));
 }
 const a=productMockup('scarf',svg),b=productMockup('scarf',svg);assert.notEqual(a.match(/id="([^"]+)/)[1],b.match(/id="([^"]+)/)[1]);
});
test('manufacturing references remain flat artwork without mockup photography, and preserve the selected engraving',()=>{
 const source=readFileSync(new URL('../dist/keepsakes.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'');
 const context=vm.createContext({sigilSvg,createEarnedRewards,document:{getElementById(){}}});vm.runInContext(source,context);
 for(const type of ['scarf','pillow','woven']){
  const svg=vm.runInContext(`printArtwork('${type}')`,context);assert.ok(svg.startsWith('<svg'));assert.ok(!svg.includes('mockup-'));assert.ok(!svg.includes('<image'));
 }
 assert.notEqual(vm.runInContext("printArtwork('pendant','sun')",context),vm.runInContext("printArtwork('pendant','moon')",context));
 const before=vm.runInContext("printArtwork('scarf')",context);vm.runInContext("appearance.scarf='#123456'",context);const after=vm.runInContext("printArtwork('scarf')",context);assert.notEqual(before,after);assert.ok(!before.includes('#123456'));
});

test('ornate pendant previews remain distinct through saved design records',()=>{
 const classic=productMockup('pendant','','moon');const ornate=productPreview({recipe:'pendant',design:{emblem:'moon',pendantStyle:'ornate'},simulated:true});
 assert.notEqual(classic,ornate);assert.match(ornate,/stroke-dasharray/);assert.match(ornate,/Moon sigil/);assert.doesNotMatch(classic,/stroke-dasharray/);
});
