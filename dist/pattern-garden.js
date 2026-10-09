import {initForge, openForge, openCollection} from './commerce.js';
const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const palettes = {
  dawn: {bg:'#203e34',tile:'#2b503e',ink:'#f0bd71',ring:'#df987e',wave:'#8ab8b2',river:'#426d72'},
  lagoon: {bg:'#152f40',tile:'#214657',ink:'#e6c361',ring:'#75c6bb',wave:'#8cabdc',river:'#51759b'},
  dusk: {bg:'#342c49',tile:'#4c3c62',ink:'#e6b87c',ring:'#c78eae',wave:'#a6b3d7',river:'#69649a'},
};
const seeds = ['ring','sun','wave'], names = {ring:'Orbit',sun:'Flare',wave:'Tide'};
const STORAGE = 'pattern-garden-v1';
const fresh = () => ({id:crypto.randomUUID(),palette:'dawn',tiles:Array(25).fill(null),river:[1,0,1,1,0],events:[],startedAt:new Date().toISOString()});
let selected = 'ring', state = fresh(), collection = [], history = [], artifact = null, revealTurn = 0, sound = false, audio, noticeTimer, storageAvailable = true;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
  if (saved?.state && palettes[saved.state.palette] && saved.state.tiles?.length === 25 && saved.state.river?.length === 5 && saved.state.tiles.every(t => t === null || (seeds.includes(t.type) && Number.isInteger(t.rotation))) && saved.state.river.every(Number.isInteger) && Array.isArray(saved.state.events)) state = saved.state;
  if (Array.isArray(saved?.collection)) collection = saved.collection.filter(a => a?.design && typeof a.fingerprint === 'string' && typeof a.svg === 'string' && typeof a.title === 'string' && Array.isArray(a.story));
} catch { /* A malformed draft must not prevent a fresh garden. */ }
const stream = i => i >= 10 && i <= 14;
const flowing = () => state.river.every(n => n % 2 === 0);
const planted = () => state.tiles.filter(Boolean).length;
const varieties = () => new Set(state.tiles.filter(Boolean).map(t => t.type)).size;
const ready = () => planted() >= 6 && varieties() === 3 && flowing();
function notify(message) { $('notice').textContent = message; $('notice').classList.add('visible'); clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('notice').classList.remove('visible'), 5000); }
function persist() {
  try { localStorage.setItem(STORAGE, JSON.stringify({state,collection})); storageAvailable = true; return true; }
  catch { storageAvailable = false; notify('Browser storage is full or unavailable. Download your artwork to keep it.'); return false; }
}
function tone(n = 0) {
  if (!sound) return;
  try { audio ||= new AudioContext(); audio.resume(); const osc = audio.createOscillator(), gain = audio.createGain(); osc.type = 'sine'; osc.frequency.value = [261.63,329.63,392,523.25,659.25][n%5]; gain.gain.setValueAtTime(.04,audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.5); osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(audio.currentTime+.5); } catch { sound=false; $('sound').textContent='Sound unavailable'; $('sound').setAttribute('aria-pressed','false'); }
}
function mutate(event, change) {
  history.push(structuredClone(state)); if (history.length > 100) history.shift();
  const wasReady = ready(); change(); state.events.push({...event,at:new Date().toISOString()}); persist(); render();
  tone(event.patch || 0);
  if (!wasReady && ready()) { notify('Your garden is in bloom. Reveal the artwork you grew.'); tone(3); }
}
function motif(ctx,type,x,y,size,p,rotation=0) {
  ctx.save(); ctx.translate(x,y); ctx.rotate(rotation*Math.PI/2); ctx.strokeStyle=type==='ring'?p.ring:type==='sun'?p.ink:p.wave; ctx.lineWidth=size*.065; ctx.lineCap='round';
  if(type==='ring') { for(const r of [.16,.3,.44]) {ctx.beginPath();ctx.arc(0,0,size*r,0,Math.PI*2);ctx.stroke();} }
  else if(type==='sun') { for(let j=0;j<12;j++) {const a=j*Math.PI/6;ctx.beginPath();ctx.moveTo(Math.cos(a)*size*.2,Math.sin(a)*size*.2);ctx.lineTo(Math.cos(a)*size*.43,Math.sin(a)*size*.43);ctx.stroke();}ctx.beginPath();ctx.arc(0,0,size*.1,0,Math.PI*2);ctx.stroke(); }
  else { for(let k=-1;k<=1;k++) {ctx.beginPath();ctx.moveTo(-size*.4,k*size*.22);ctx.bezierCurveTo(-size*.18,k*size*.22-size*.24,size*.15,k*size*.22+size*.24,size*.4,k*size*.22);ctx.stroke();} }
  ctx.restore();
}
function drawGarden() {
  const canvas=$('garden'),ctx=canvas.getContext('2d'),p=palettes[state.palette],w=canvas.width,start=w*.08,cell=w*.168;
  ctx.fillStyle=p.bg;ctx.fillRect(0,0,w,w);
  for(let i=0;i<25;i++) {
    const x=start+(i%5)*cell,y=start+Math.floor(i/5)*cell; ctx.fillStyle=p.tile;ctx.fillRect(x+3,y+3,cell-6,cell-6);
    if(stream(i)) {ctx.save();ctx.translate(x+cell/2,y+cell/2);ctx.rotate(state.river[i-10]*Math.PI/2);ctx.fillStyle=p.river;ctx.fillRect(-cell/2+3,-cell*.15,cell-6,cell*.3);ctx.strokeStyle=p.wave;ctx.lineWidth=3;for(let a=-1;a<=1;a++){ctx.beginPath();ctx.moveTo(-cell/2+5,a*cell*.075);ctx.lineTo(cell/2-5,a*cell*.075);ctx.stroke();}ctx.restore();}
    else if(state.tiles[i]) {const t=state.tiles[i];motif(ctx,t.type,x+cell/2,y+cell/2,cell*(flowing()?.8:.45),p,t.rotation);}
    else {ctx.fillStyle=p.wave+'55';ctx.beginPath();ctx.arc(x+cell/2,y+cell/2,3,0,Math.PI*2);ctx.fill();}
  }
  ctx.strokeStyle=p.ink+'77';ctx.lineWidth=2;ctx.strokeRect(w*.045,w*.045,w*.91,w*.91);
}
function svgMotif(type,size,p) {
  const color=type==='ring'?p.ring:type==='sun'?p.ink:p.wave;let content='';
  if(type==='ring')content=[.16,.3,.44].map(r=>`<circle r="${size*r}"/>`).join('');
  else if(type==='sun')content=Array.from({length:12},(_,j)=>{const a=j*Math.PI/6;return `<path d="M${Math.cos(a)*size*.2} ${Math.sin(a)*size*.2} L${Math.cos(a)*size*.43} ${Math.sin(a)*size*.43}"/>`;}).join('')+`<circle r="${size*.1}"/>`;
  else content=[-1,0,1].map(k=>`<path d="M${-size*.4} ${k*size*.22} C${-size*.18} ${k*size*.22-size*.24} ${size*.15} ${k*size*.22+size*.24} ${size*.4} ${k*size*.22}"/>`).join('');
  return `<g fill="none" stroke="${color}" stroke-width="${size*.065}" stroke-linecap="round">${content}</g>`;
}
function makeSvg(design) {
  const p=palettes[design.palette],tiles=design.tiles,parts=[`<rect width="1000" height="1000" fill="${p.bg}"/>`];
  for(let i=0;i<25;i++) {
    const x=80+(i%5)*168,y=80+Math.floor(i/5)*168;parts.push(`<rect x="${x+3}" y="${y+3}" width="162" height="162" fill="${p.tile}"/>`);
    if(stream(i))parts.push(`<g transform="translate(${x+84} ${y+84}) rotate(${design.river[i-10]*90})"><rect x="-81" y="-25.2" width="162" height="50.4" fill="${p.river}"/><path d="M-79 -12.6H79 M-79 0H79 M-79 12.6H79" fill="none" stroke="${p.wave}" stroke-width="3"/></g>`);
    else if(tiles[i])parts.push(`<g transform="translate(${x+84} ${y+84}) rotate(${tiles[i].rotation*90})">${svgMotif(tiles[i].type,134.4,p)}</g>`);
    else parts.push(`<circle cx="${x+84}" cy="${y+84}" r="3" fill="${p.wave}" opacity=".33"/>`);
  }
  parts.push(`<rect x="45" y="45" width="910" height="910" fill="none" stroke="${p.ink}" opacity=".47" stroke-width="2"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000"><title>Pattern Garden artwork</title>${parts.join('')}</svg>`;
}
function render() {
  drawGarden();const complete=ready();$('planted-count').textContent=`${planted()} / 6 seeds planted`;$('variety-count').textContent=`${varieties()} / 3 varieties`;$('flow-status').textContent=flowing()?'Water is flowing':'Waiting for water';$('reveal').disabled=!complete;$('undo').disabled=!history.length;
  $('quest').textContent=complete?'Your garden is in bloom. Reveal the artwork you grew.':planted()<6?'Plant six seeds. Mix Orbit, Flare, and Tide.':varieties()<3?'Discover all three seed varieties. Plant the missing shapes.':'Turn the blue patches until the stream reaches the pond.';
  $('quest-icon').textContent=complete?'✳':'✧';$('season-name').textContent=complete?'Full bloom':planted()?'Taking root':'First light';$('season-detail').textContent=complete?'A small world, ready to become a keepsake.':flowing()?'The water has found its way.':'Your next choice changes the pattern.';
  $('garden-status').textContent=complete?'In bloom. Keep composing, or reveal your artwork.':flowing()?'Water is flowing. Plant more shapes to fill your garden.':'Choose a seed to plant. Tap blue patches to rotate the stream.';
  $('collection-count').textContent=collection.length;
  document.querySelectorAll('[data-palette]').forEach(b=>{const on=b.dataset.palette===state.palette;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on);});
  for(let i=0;i<25;i++) {const b=$('patches').children[i];b.setAttribute('aria-label',stream(i)?`Stream ${i-9}, ${state.river[i-10]%2?'vertical':'horizontal'}. Rotate`:`Patch ${i+1}, ${state.tiles[i]?names[state.tiles[i].type]:'empty'}. ${state.tiles[i]?'Rotate':'Plant '+names[selected]}`);}
}
async function fingerprint(design) {const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(design)));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
function download(content,filename,type) {const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function keep() {
  const existing=collection.find(a=>a.fingerprint===artifact.fingerprint);
  if(existing) artifact=existing;
  else {collection.unshift(artifact);}
  const stored=persist(); render(); return stored;
}
function metadata(a) {return {name:a.title,description:a.storyText,image:'data:image/svg+xml;base64,'+btoa(a.svg),attributes:[{trait_type:'Palette',value:a.design.palette},{trait_type:'Seeds planted',value:a.design.tiles.filter(Boolean).length},{trait_type:'Game',value:'Pattern Garden'}],properties:{designFingerprint:a.fingerprint,sourceEventId:a.gardenId,rendererVersion:1,createdAt:a.createdAt,events:a.story,collectible:a.collectible||null,chain:null,contract:null,simulated:true,physicalRedemptionIncluded:false}};}
function paintArtifact(a) {const image=new Image();image.onload=()=>{if(artifact?.fingerprint===a.fingerprint)$('artwork').getContext('2d').drawImage(image,0,0,1000,1000);};image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(a.svg);}
function showArtifact(a) {
  artifact=a;paintArtifact(a);$('art-title').textContent=a.title;$('art-story').textContent=a.storyText;$('art-edition').textContent=`ORIGINAL DESIGN / ${a.fingerprint.slice(0,12).toUpperCase()}`;
  const saved=collection.some(x=>x.fingerprint===a.fingerprint);
  $('artifact-actions').innerHTML=`<div class="action-stack"><button id="keep-art" class="primary">${saved?'Saved in your collection':'Keep this artwork'}</button><button id="mint-art">${a.collectible?'View demo collectible':'Mint collectible / demo'}</button><label class="format-label" for="physical-format">Bring it into your world</label><select id="physical-format"><option value="scarf">A patterned scarf</option><option value="rug">A woven rug</option><option value="pillow">A pillow cover</option></select><button id="physical-art">Preview physical keepsake</button><div class="download-actions"><button id="download-art">Download artwork</button><button id="download-metadata">Design record</button></div></div>${a.collectible?`<div class="collectible-status"><strong>Demo collectible claimed</strong><br>${escape(a.collectible.tokenId)}<br><small>Saved in this browser. No wallet, blockchain transaction, or redemption entitlement.</small></div>`:'<p class="caption">Minting is an optional simulation. No wallet or crypto required.</p>'}<details class="provenance"><summary>The story behind this piece</summary><dl><dt>Created</dt><dd>${escape(new Date(a.createdAt).toLocaleString())}</dd><dt>Palette</dt><dd>${escape(a.design.palette)}</dd><dt>Seeds</dt><dd>${a.design.tiles.filter(Boolean).length} planted · 3 varieties</dd><dt>Choices</dt><dd>${a.story.length} recorded</dd><dt>Design ID</dt><dd>${escape(a.fingerprint)}</dd><dt>Saved</dt><dd>${saved&&storageAvailable?'This browser':'Download to preserve a copy'}</dd></dl><ol class="story-events">${a.story.slice(-8).map(e=>`<li>${escape(e.event==='plant'?`Planted ${names[e.seed]} in patch ${e.patch+1}`:e.event==='rotate-stream'?`Turned stream patch ${e.patch-9}`:e.event==='rotate-seed'?`Rotated patch ${e.patch+1}`:e.event==='palette'?`Chose the ${e.palette} palette`:'Revealed the artwork')}</li>`).join('')}</ol></details>`;
  $('keep-art').onclick=()=>{if(keep())notify('Artwork saved in this browser’s collection.');showArtifact(artifact);};
  $('mint-art').onclick=()=>{if(!artifact.collectible)artifact.collectible={tokenId:'DEMO-PG-'+artifact.fingerprint.slice(0,12).toUpperCase(),claimedAt:new Date().toISOString(),simulated:true};const stored=keep();showArtifact(artifact);notify(stored?'Demo collectible claimed. No blockchain transaction occurred.':'Demo collectible created for this session. Download its design record to keep it.');};
  $('download-art').onclick=()=>download(artifact.svg,'pattern-garden-'+artifact.fingerprint.slice(0,8)+'.svg','image/svg+xml');
  $('download-metadata').onclick=()=>download(JSON.stringify(metadata(artifact),null,2),'pattern-garden-'+artifact.fingerprint.slice(0,8)+'.json','application/json');
  $('physical-art').onclick=()=>{const a=artifact,type=$('physical-format').value;keep();$('artifact-dialog').close();openForge({type,title:a.title+' / '+(type==='pillow'?'pillow cover':type),sourceEventId:a.gardenId+'-'+a.fingerprint.slice(0,16),design:{...structuredClone(a.design),referenceSvg:a.svg,artworkFingerprint:a.fingerprint},story:structuredClone(a.story),prompt:`Create a ${type==='pillow'?'pillow cover':type} using this exact geometric garden composition: ${a.design.palette} palette, concentric circles, twelve-ray flares and flowing waves. Preserve the planted positions, rotations, and central stream. Use the attached design reference.`});};
  if(!$('artifact-dialog').open)$('artifact-dialog').showModal();
}
async function reveal() {
  if(!ready())return;
  const turn=++revealTurn;const design={rendererVersion:1,palette:state.palette,tiles:structuredClone(state.tiles),river:[...state.river]},gardenId=state.id,events=structuredClone(state.events);
  $('reveal').disabled=true;$('reveal').textContent='Preserving your garden…';
  try {const hash=await fingerprint(design);if(turn!==revealTurn)return;const existing=collection.find(a=>a.fingerprint===hash);showArtifact(existing||{fingerprint:hash,gardenId,design,svg:makeSvg(design),title:`${design.palette[0].toUpperCase()+design.palette.slice(1)} / ${hash.slice(0,4).toUpperCase()}`,createdAt:new Date().toISOString(),story:[...events,{event:'artwork-revealed',at:new Date().toISOString()}],storyText:`You planted ${design.tiles.filter(Boolean).length} seeds, brought three kinds of shapes together, and found a path for the water. This ${design.palette} composition grew from your choices.`});tone(4);}
  catch {notify('Could not preserve the artwork. Your garden is still here; try again.');}
  finally {$('reveal').textContent='Grow your artwork';render();}
}
for(let i=0;i<25;i++) {const b=document.createElement('button');b.onclick=()=>{if(stream(i))mutate({event:'rotate-stream',patch:i},()=>state.river[i-10]=(state.river[i-10]+1)%4);else if(state.tiles[i])mutate({event:'rotate-seed',patch:i},()=>state.tiles[i].rotation=(state.tiles[i].rotation+1)%4);else mutate({event:'plant',patch:i,seed:selected},()=>state.tiles[i]={type:selected,rotation:0});};$('patches').append(b);}
$('patches').addEventListener('keydown',e=>{const i=[...$('patches').children].indexOf(document.activeElement);if(i<0)return;const offset={ArrowRight:1,ArrowLeft:-1,ArrowDown:5,ArrowUp:-5}[e.key];if(offset){e.preventDefault();$('patches').children[Math.max(0,Math.min(24,i+offset))].focus();}});
 document.querySelectorAll('[data-seed]').forEach(b=>b.onclick=()=>{selected=b.dataset.seed;document.querySelectorAll('[data-seed]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',x===b);});render();});
 document.querySelectorAll('[data-palette]').forEach(b=>b.onclick=()=>{if(state.palette!==b.dataset.palette)mutate({event:'palette',palette:b.dataset.palette},()=>state.palette=b.dataset.palette);});
$('undo').onclick=()=>{if(history.length){state=history.pop();persist();render();}};
$('reset').onclick=()=>{revealTurn++;history.push(structuredClone(state));state=fresh();persist();render();notify('A fresh garden. Your saved artworks are still in your collection.');};
$('sound').onclick=()=>{sound=!sound;$('sound').textContent=sound?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',sound);tone(0);};
$('reveal').onclick=reveal;$('artifact-close').onclick=()=>$('artifact-dialog').close();
$('collection').onclick=()=>{
  $('collection-list').innerHTML=collection.length?collection.map((a,i)=>`<button class="collection-item" data-artifact="${i}"><img alt="${escape(a.title)} artwork" src="data:image/svg+xml;charset=utf-8,${escape(encodeURIComponent(a.svg))}"><span><strong>${escape(a.title)}</strong><small>${a.collectible?'Demo collectible':'Saved artwork'} · ${escape(new Date(a.createdAt).toLocaleDateString())}</small></span></button>`).join(''):'<p>Your collection begins with a garden. Plant six seeds, find the water, and reveal your first artwork.</p>';
  document.querySelectorAll('[data-artifact]').forEach(b=>b.onclick=()=>{$('collection-dialog').close();showArtifact(collection[Number(b.dataset.artifact)]);});$('collection-dialog').showModal();
};
$('collection-close').onclick=()=>$('collection-dialog').close();
initForge({gameId:'pattern-garden',preview:()=>artifact?.svg||makeSvg({palette:state.palette,tiles:state.tiles,river:state.river}),pause:()=>{},resume:()=>{}});
$('physical-orders').onclick=openCollection;
render();
