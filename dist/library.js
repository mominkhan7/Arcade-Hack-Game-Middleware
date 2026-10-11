import {NexusClient} from './nexus-client.js';
import {initForge,openSavedKeepsake} from './commerce.js';
const games=[['relic-island','Relic Island'],['pattern-garden','Pattern Garden'],['chess-atelier','Chess Atelier']];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search),game=games.find(g=>g[0]===params.get('game'))?.[0];
async function load(){
  const results=await Promise.allSettled(games.map(async([id,title])=>({id,title,records:await new NexusClient({gameId:id}).listKeepsakes()})));
  document.getElementById('library-list').innerHTML=results.map((result,i)=>{const [id,title]=games[i];if(result.status==='rejected')return `<h2>${title}</h2><p class="empty">Couldn’t load keepsakes. Reload to try again.</p>`;return `<h2>${title}</h2>`+(result.value.records.length?result.value.records.map(r=>`<a class="saved-card" href="library.html?game=${id}&id=${encodeURIComponent(r.id)}">${r.product?.imageUrl?`<img src="${escape(r.product.imageUrl)}" alt="Arcade keepsake preview">`:r.design?.referenceSvg?`<img src="data:image/svg+xml;charset=utf-8,${escape(encodeURIComponent(r.design.referenceSvg))}" alt="Your saved design">`:''}<div><strong>${escape(r.title)}</strong><small>${escape((r.simulated ? 'Demo · ' : '')+(r.order?.status||r.phase))} · ${new Date(r.createdAt).toLocaleDateString()}</small></div><span>↗</span></a>`).join(''):'<p class="empty">Your next story starts in Play.</p>');}).join('');
  document.querySelectorAll('.saved-card img').forEach(image=>image.addEventListener('error',()=>{const placeholder=document.createElement('div');placeholder.className='thumbnail-fallback';placeholder.textContent='✧';image.replaceWith(placeholder);},{once:true}));
}
await load();
if(game&&params.get('id')){initForge({gameId:game,pause(){},resume(){location.replace('library.html');},preview(){return ''}});await openSavedKeepsake(params.get('id'));}
