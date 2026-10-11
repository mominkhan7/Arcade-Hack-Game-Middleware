import {matchArtwork} from './chess-art.js';
import {journeyArt} from './garden-art.js';
import {sigilSvg,sigils} from './sigils.js';
// Game-ready design templates, independent of the vendor catalog and prices.
const template=(id,category,title,trigger,transformation,formats,renderer,game)=>Object.freeze({id,category,title,trigger,transformation,formats:Object.freeze(formats),renderer,game});
export const offerings=Object.freeze([
 template('achievement-emblem','accomplishment','Achievement emblem','A quest, level or personal milestone is completed.','The achievement becomes an engraved personal symbol.',['pendant'],'emblem','relic-island'),
 template('achievement-evolution','accomplishment','Evolving relic','A meaningful higher milestone is reached.','The same symbol gains intricate engraving as its story grows.',['pendant'],'emblem','relic-island'),
 template('match-victory','accomplishment','Match remembered','A match ends in a win, draw or hard-earned finish.','Actual moves become a composition that remembers the match.',['scarf','pillow'],'moves','chess-atelier'),
 template('collection-pattern','accomplishment','Collection mosaic','A collection or exploration chapter is completed.','Collected symbols become a repeating textile pattern.',['scarf','pillow'],'mosaic','relic-island'),
 template('personal-best','accomplishment','Personal best','The player beats their own best performance.','Their route becomes a unique flowing composition.',['scarf','pillow'],'journey','pattern-garden'),
 template('move-art','play','Every move, a mark','The player chooses to preserve a match in progress.','Move coordinates draw paths, captures and layered geometry.',['scarf','pillow'],'moves','chess-atelier'),
 template('journey-art','play','Journey into art','The player reveals the path they have painted through play.','Movement, discovered colors and gestures shape original art.',['scarf','pillow'],'journey','pattern-garden'),
 template('avatar-portrait','play','Your character, your keepsake','The player finishes customizing a character.','Their appearance becomes a portrait or signature textile.',['pillow','scarf'],'reference','relic-island'),
 template('crafted-pattern','play','Made by your hands','A puzzle, loom or building composition is finished.','The exact player-made arrangement becomes the print.',['scarf','pillow'],'reference','relic-island'),
 template('shared-journey','play','A shared story','Players choose to preserve a cooperative session.','Their combined paths become one composition.',['scarf','pillow'],'journey','pattern-garden'),
]);
export function getOffering(id){const offering=offerings.find(o=>o.id===id);if(!offering)throw new Error('Unknown CraftKit offering.');return offering;}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function offeringArtwork(id,activity={}){
 const o=getOffering(id);
 if(o.renderer==='moves'){
  if(!Array.isArray(activity.moves)||!activity.moves.length||activity.moves.some(m=>!(/^[a-h][1-8]$/.test(m.from)&&/^[a-h][1-8]$/.test(m.to)&&['w','b'].includes(m.color))))throw new Error('Provide the actual match moves.');
  return matchArtwork(activity.moves);
 }
 if(o.renderer==='journey'){
  if(!Array.isArray(activity.trail)||activity.trail.length<2||activity.trail.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.z)||(p.hue!==undefined&&!Number.isFinite(p.hue))))throw new Error('Provide the recorded player route.');
  return journeyArt(activity);
 }
 if(o.renderer==='reference')throw new Error('This template needs the game’s original SVG artwork.');
 const emblem=activity.emblem||'sun';if(!Object.hasOwn(sigils,emblem))throw new Error('Choose a supported symbol, or supply your game’s SVG artwork.');
 if(o.renderer==='mosaic'){
  const motifs=activity.motifs;if(!Array.isArray(motifs)||!motifs.length||motifs.some(m=>!Object.hasOwn(sigils,m)))throw new Error('Provide the collected symbols.');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#142e31"/>${Array.from({length:16},(_,i)=>sigilSvg(motifs[i%motifs.length],'#ead4a0',`x="${i%4*150+25}" y="${Math.floor(i/4)*150+25}" width="100" height="100"`)).join('')}</svg>`;
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><rect width="300" height="300" fill="#142e31"/><circle cx="150" cy="140" r="100" fill="#dec27a"/>${o.id==='achievement-evolution'?'<circle cx="150" cy="140" r="89" fill="none" stroke="#675026" stroke-width="6" stroke-dasharray="2 8"/>':''}${sigilSvg(emblem,'#675026','x="90" y="80" width="120" height="120"')}<text x="150" y="270" text-anchor="middle" fill="#dec27a" font-family="Georgia" font-size="16">${esc(activity.label||'Your achievement')}</text></svg>`;
}
export function buildOffering(id,input){
 const o=getOffering(id),type=input.type||o.formats[0];if(!o.formats.includes(type))throw new Error('This output does not fit the CraftKit offering.');
 if(typeof input.sourceEventId!=='string'||!input.sourceEventId.trim())throw new Error('A stable gameplay event ID is required.');
 const design=structuredClone(input.design||{}),activity=structuredClone(input.activity||{});
 const referenceSvg=design.referenceSvg||offeringArtwork(id,activity);
 if(typeof referenceSvg!=='string'||!referenceSvg.startsWith('<svg'))throw new Error('Provide original SVG artwork.');
 return {...input,type,title:input.title||o.title,prompt:input.prompt||`${o.transformation} Preserve the supplied artwork and composition. Use available catalog materials.`,
  design:{...activity,...design,referenceSvg,craftkitOffering:{id,category:o.category,version:1},...(id==='achievement-evolution'?{pendantStyle:'ornate'}:{})},
  story:[...structuredClone(input.story||[]),{event:'craftkit-design-created',offering:id,category:o.category,sourceEventId:input.sourceEventId}]};
}
