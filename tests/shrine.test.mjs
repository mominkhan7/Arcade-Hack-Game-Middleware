import test from 'node:test';
import assert from 'node:assert/strict';
import {shrineHeight,sigils,sigilPaths} from '../dist/sigils.js';
test('player footing follows each actual shrine platform top',()=>{for(const [radius,height]of [[0,1.005],[.8,.88],[1.3,.66],[1.8,.43],[2.2,.19]])assert.equal(shrineHeight(radius,0),height);assert.equal(shrineHeight(0,-1.3),.66);assert.ok(shrineHeight(.8,0)>shrineHeight(1.8,0));});
test('every playable sigil has its own outfit, world, and engraving',()=>{assert.deepEqual(Object.keys(sigils),['sun','moon','mountain','ocean']);assert.equal(new Set(Object.values(sigils).map(s=>s.world)).size,4);assert.equal(new Set(Object.values(sigils).map(s=>s.coat)).size,4);for(const key of Object.keys(sigils))assert.ok(sigilPaths[key].length>30);});
