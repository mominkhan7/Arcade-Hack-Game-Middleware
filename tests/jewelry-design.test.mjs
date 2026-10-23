import {test} from 'node:test';
import assert from 'node:assert/strict';
import {jewelryPrompt} from '../dist/jewelry-design.js';
import {buildOffering} from '../dist/craftkit-offerings.js';

test('each sigil has a distinct sculptural jewelry direction that fits the vendor prompt budget',()=>{
 const prompts=['sun','moon','mountain','ocean'].map(s=>jewelryPrompt(s));assert.equal(new Set(prompts).size,4);
 for(const sigil of ['sun','moon','mountain','ocean'])for(const style of ['classic','ornate']){
  const prompt=jewelryPrompt(sigil,style);assert.ok(prompt.length<900);assert.match(prompt,/relief/);assert.match(prompt,/selected catalog material/);assert.doesNotMatch(prompt,/platinum|diamonds/i);
 }
 assert.match(prompts[0],/flame-shaped/);assert.match(prompts[1],/crescent/);assert.match(prompts[2],/faceted peaks/);assert.match(prompts[3],/curling wave/);
});
test('the higher milestone preserves its motif and adds an explicit collector evolution',()=>{
 const base=buildOffering('achievement-emblem',{sourceEventId:'level-1',design:{sigil:'moon',referenceSvg:'<svg/>'}});
 const ornate=buildOffering('achievement-evolution',{sourceEventId:'level-10',design:{sigil:'moon',referenceSvg:'<svg/>'}});
 assert.match(base.prompt,/crescent/);assert.match(ornate.prompt,/crescent/);assert.match(ornate.prompt,/filigree|granulation/);assert.notEqual(base.prompt,ornate.prompt);assert.equal(ornate.design.pendantStyle,'ornate');
});
