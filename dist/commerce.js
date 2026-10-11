import {buildOffering} from './craftkit-offerings.js';
import {productPreview} from './product-mockup.js';
import {rasterizeDesign} from './design-reference.js';
import {CraftKitClient} from './craftkit-client.js';
const $ = id => document.getElementById(id);
const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const usd = m => m ? new Intl.NumberFormat(undefined,{style:'currency',currency:m.currency}).format(Number(m.amount)) : 'Pricing pending';
function openCheckoutUrl() { const url=session.checkout?.url; if (!url || new URL(url).protocol!=='https:') return; if(window.webkit?.messageHandlers?.craftkitCheckout)window.webkit.messageHandlers.craftkitCheckout.postMessage(url);else window.open(url,'_blank','noopener,noreferrer'); }
const fulfillment = ['ordered','inProduction','inReview','approved','shipped','delivered'];
const labels = {ordered:'Order placed',inProduction:'Maker in production',inReview:'Quality review',approved:'Ready to ship',shipped:'On its way',delivered:'Delivered'};
let callbacks, client, session, observer, opening = 0;
function preview(svg) { return `<img alt="Saved game design reference" src="data:image/svg+xml;charset=utf-8,${escape(encodeURIComponent(svg))}">`; }
function frame(body) {
  $('forge-body').innerHTML = body;
  $('forge-trace').textContent = JSON.stringify({keepsakeId:session.id, game:session.gameId, recipe:session.recipe, designFingerprint:session.fingerprint, designRevision:session.revision, sourceEventId:session.sourceEventId, story:session.story, provider: session.simulated ? 'simulated' : 'live', requests:session.trace},null,2);
  $('forge-name').textContent = session.title;
  $('forge-phase').textContent = ({draft:'01 / DESIGN',pattern:'01 / DESIGN',product:'02 / PRODUCT',quote:'02 / QUOTE',checkout:'03 / CHECKOUT',order:'04 / ORDER',failed:'GENERATION FAILED'})[session.phase];
  $('forge-image').innerHTML=productPreview(session);
  document.querySelector('.simulation-banner').textContent = session.simulated ? 'SIMULATED EXPERIENCE · NO REAL CHARGE OR ORDER' : 'ARCADE PRODUCT PREVIEW';
  $('forge-reference').hidden=!session.product?.imageUrl||session.simulated;
  if(!$('forge-reference').hidden)$('forge-comparison').innerHTML=preview(session.design.referenceSvg);
  $('forge-image').classList.toggle('generating',['pattern','product'].includes(session.phase));
  const step = ({draft:0,pattern:0,product:1,quote:1,checkout:2,order:3,failed:0})[session.phase];
  $('forge-steps').innerHTML = ['DESIGN','PRODUCT','CHECKOUT','ORDER'].map((s,i)=>`<span class="${i<=step?'done':''}">${s}</span>`).join('');
}
function warning() { if (!session.simulated) return `<p class="category-note">${session.world==='jewelry'?'Jewelry is inspired by your sigil; engraving may differ.':'Review the generated design before purchase.'}</p>`; return `<p class="category-note">${session.availability==='unverified'?'Concept category. Availability needs confirmation with Arcade.':'Sample catalog and product options. Live Arcade access is not connected.'}</p>`; }
function options() { return '<details class="recipe"><summary>Size, material & quantity</summary>' + `<div class="forge-options">${Object.entries(session.item.options).map(([key,values])=>`<label>${escape(key)}<select data-option="${escape(key)}">${values.map(v=>`<option ${session.selections[key]===v?'selected':''}>${escape(v)}</option>`).join('')}</select></label>`).join('')}<label>Quantity<select id="forge-quantity">${[1,2,3,4,5].map(n=>`<option ${n===session.quantity?'selected':''}>${n}</option>`).join('')}</select></label></div>` + '</details>'; }
function attachOptions() {
  document.querySelectorAll('[data-option],#forge-quantity').forEach(el=>el.onchange=()=>perform(async()=>{
    const selections = Object.fromEntries([...document.querySelectorAll('[data-option]')].map(el=>[el.dataset.option,el.value]));
    return client.setOptions(session.id,selections,Number($('forge-quantity').value));
  }));
}
function showError(error) {
  if (error.name==='AbortError' || !$('forge-dialog').open) return;
  $('forge-error').textContent = error.message; $('forge-error').hidden = false;
  if (session) render();
}
async function perform(action) {
  const current = opening;
  $('forge-error').hidden = true;
  $('forge-body').querySelectorAll('button,select').forEach(el=>el.disabled=true);
  try { const record = await action(); if(current!==opening)return; session=record; render(); }
  catch(error) { if(current===opening)showError(error); }
}
function render() {
  if (!session) return;
  if (['pattern','product'].includes(session.phase)) {
    frame(`<div class="job-state"><span class="forge-spinner"></span><strong>${session.phase==='pattern'?'Preparing your keepsake design':'Preparing your product preview'}</strong><p>Your design is saved. Keep playing while the preview is prepared.</p></div>`); return;
  }
  if (session.phase==='draft'||session.phase==='failed') {
    frame(`<p class="forge-description">Your design is saved. Product options are ready.</p>${options()}${warning()}${session.error?`<p role="status">${escape(session.error)}</p>`:''}<button id="forge-generate" class="primary">${session.phase==='failed'?'Retry generation':session.simulated ? 'Generate product / demo' : 'Make my keepsake'}</button><p class="caption">Purchase is optional.</p>`);
    attachOptions(); $('forge-generate').onclick=generate; return;
  }
  if (session.phase==='quote') {
    const product=session.product,quote=session.quote;
    frame(`<div class="quote-heading"><span>${session.simulated ? 'EXAMPLE QUOTE' : 'ARCADE PRICE'}</span><strong>${usd(product.unitPrice)} <small>/ item</small></strong></div><div class="maker-line"><span>Made by</span><strong>${escape(product.maker.name)}</strong><small>${session.simulated ? 'Fictional maker for this simulation' : 'Arcade maker'}</small></div>${!session.simulated ? `<p class="caption">${escape(product.selectionLabel)}</p>` : ''}${options()}${session.quantity>1?`<div class="price-line"><span>Items × ${session.quantity}</span><strong>${usd(quote.subtotal)}</strong></div>`:''}<p class="caption">${session.simulated ? 'Sample pricing.' : 'Shipping, tax, service fees, and applicable discounts appear in Arcade checkout.'}</p>${warning()}<button id="forge-checkout" class="primary">${session.simulated ? 'Open demo checkout' : 'Bring it home'}</button><details class="recipe"><summary>Quote details</summary><p class="caption">Valid until ${new Date(quote.expiresAt).toLocaleTimeString()}.</p><button id="forge-refresh" class="secondary">Refresh quote</button></details>`);
    attachOptions(); $('forge-checkout').onclick=()=>perform(async()=>{const record=await client.openCheckout(session.id);session=record;if(!record.simulated)openCheckoutUrl();return record;}); $('forge-refresh').onclick=()=>perform(()=>client.refreshQuote(session.id)); return;
  }
  if (session.phase==='checkout' && !session.simulated) {
    frame(`<p class="forge-description">Your keepsake is ready. Confirm the final total and delivery details to bring it home.</p><div class="price-line"><span>Items × ${session.quantity}</span><strong>${usd(session.quote.subtotal)}</strong></div><button id="forge-live-checkout" class="primary">Continue purchase</button><button id="forge-sync-order" class="secondary">Refresh order</button><p class="caption">CraftKit confirms your order with Arcade after payment.</p>`);
    $('forge-live-checkout').onclick=openCheckoutUrl;
    $('forge-sync-order').onclick=()=>perform(()=>client.getKeepsake(session.id)); return;
  }
  if (session.phase==='checkout') {
    const totals=session.quote;
    frame(`<div class="checkout-title"><strong>Physical checkout</strong><span>SIMULATED</span></div><p class="forge-description">A live integration opens Arcade’s hosted checkout. This demo collects no payment details.</p><div class="checkout-item"><strong>${escape(session.title)}</strong><small>${escape(Object.values(session.selections).join(' / '))} · Qty ${session.quantity}</small></div><div class="demo-address"><span>DEMO SHIPPING DESTINATION</span><strong>Demo Explorer</strong><small>San Francisco, CA · United States</small></div>${['subtotal','shipping','tax','total'].map(key=>`<div class="price-line ${key==='total'?'total':''}"><span>${key==='tax'?'Tax / sample':key==='shipping'?'Shipping / sample':key}</span><strong>${usd(totals[key])}</strong></div>`).join('')}<div class="demo-payment">DEMO PAYMENT · No charge or real order</div><button id="forge-pay" class="primary">Complete demo payment / ${usd(totals.total)}</button><button id="forge-back" class="secondary">Back / refresh quote</button>`);
    $('forge-pay').onclick=()=>perform(()=>client.completeDemoPayment(session.id)); $('forge-back').onclick=()=>perform(()=>client.refreshQuote(session.id)); return;
  }
  if (session.phase==='order' && !session.simulated) {
    const order=session.order;
    frame(`<div class="order-heading"><span>${escape(order.orderNumber)}</span><strong>${escape(labels[order.status]||order.status)}</strong><p>Confirmed by Arcade.</p></div><div class="price-line"><span>Order total</span><strong>${usd(order.total)}</strong></div>${order.tracking.map(t=>`<p>${escape(t.company||'Carrier')} · ${escape(t.number||'Tracking pending')}</p>`).join('')}<button id="forge-sync-order" class="secondary">Refresh order</button>`);
    $('forge-sync-order').onclick=()=>perform(()=>client.getKeepsake(session.id)); return;
  }
  if (session.phase==='order') {
    const order=session.order,index=fulfillment.indexOf(order.status);
    frame(`<div class="order-heading"><span>${escape(order.orderNumber)} / DEMO</span><strong>${labels[order.status]}</strong><p>Your order stays in your keepsake collection.</p></div><ol class="order-timeline">${fulfillment.map((status,i)=>`<li class="${i<=index?'complete':''} ${i===index?'current':''}"><span>${i<index?'✓':i+1}</span><strong>${labels[status]}</strong></li>`).join('')}</ol>${order.tracking.length?'<div class="demo-address"><span>SIMULATED TRACKING</span><strong>Demo carrier / DEMO-TRACKING-001</strong></div>':''}<div class="price-line"><span>Demo order total</span><strong>${usd(order.total)}</strong></div><p class="caption">No payment, manufacturing request, or shipment occurred. Fulfillment is fast-forwarded.</p>${index<fulfillment.length-1?`<button id="forge-advance" class="primary">Fast-forward / ${labels[fulfillment[index+1]]}</button>`:'<button id="forge-finish" class="primary">Back to game</button>'}`);
    if($('forge-advance'))$('forge-advance').onclick=()=>perform(()=>client.advanceDemoOrder(session.id,order.status));
    if($('forge-finish'))$('forge-finish').onclick=closeForge;
  }
}
async function observe() {
  observer?.abort(); observer=new AbortController(); const signal=observer.signal,current=opening;
  try { const record=await client.waitForProduct(session.id,{signal,onUpdate:r=>{if(current===opening){session=r;render();}}}); if(current===opening){session=record;render();} }
  catch(error){if(current===opening)showError(error);}
}
async function generate() {
  await perform(()=>client.generateProduct(session.id));
  if(session&&['pattern','product'].includes(session.phase)&&$('forge-dialog').open)observe();
}
function closeForge(){opening++;observer?.abort();$('forge-dialog').close();callbacks.resume();}
export function initForge(c) {
  window.addEventListener('craftkit-payment-return',async event=>{
    if(!session || session.simulated || session.phase!=='checkout')return;
    if(event.detail?.status==='failed')showError(new Error('Payment could not be opened. Please try again.'));
    else await perform(()=>client.getKeepsake(session.id));
  });
  window.addEventListener('craftkit-open-collection',openCollection);
  callbacks=c;client=new CraftKitClient({gameId:c.gameId||'relic-island'});
  document.body.insertAdjacentHTML('beforeend',`<dialog id="forge-dialog"><div class="sheet"><div class="sheet-heading"><span class="eyebrow">CRAFTKIT / YOUR KEEPSAKE</span><button id="forge-close" class="close" aria-label="Close keepsake forge">×</button></div><div class="simulation-banner">SIMULATED EXPERIENCE · NO REAL CHARGE OR ORDER</div><div id="forge-steps"></div><span id="forge-phase" class="eyebrow"></span><h2 id="forge-name">Your keepsake</h2><div id="forge-image" class="product-preview"></div><details id="forge-reference" class="recipe" hidden><summary>Your original design</summary><div id="forge-comparison" class="design-comparison"></div></details><p id="forge-error" class="category-note" role="alert" hidden></p><div id="forge-body"></div><button id="forge-keep-playing" class="secondary">Keep playing</button><details class="recipe integration-trace"><summary>How this keepsake was made</summary><pre id="forge-trace"></pre></details></div></dialog><dialog id="craftkit-collection"><div class="sheet"><div class="sheet-heading"><h2>Saved keepsakes</h2><button id="craftkit-collection-close" class="close" aria-label="Close saved keepsakes">×</button></div><p class="caption">Your designs and orders, saved for this game.</p><div id="craftkit-collection-list"></div></div></dialog>`);
  $('forge-close').onclick=closeForge;$('forge-keep-playing').onclick=closeForge;$('forge-dialog').addEventListener('cancel',e=>{e.preventDefault();closeForge();});
  const closeCollection=()=>{opening++;$('craftkit-collection').close();callbacks.resume();};
  $('craftkit-collection-close').onclick=closeCollection;$('craftkit-collection').addEventListener('cancel',e=>{e.preventDefault();closeCollection();});
  if($('start-keepsakes'))$('start-keepsakes').onclick=openCollection;
  const actions=document.querySelector('.header-actions')||$('craftkit-actions');
  if(actions){const button=document.createElement('button');button.textContent='▣';button.className='icon-button';button.title='Saved keepsakes';button.setAttribute('aria-label','Saved keepsakes');button.onclick=openCollection;actions.append(button);}
}
export async function openForge(config) {
  const current=++opening;observer?.abort();callbacks.pause();session=null;
  document.querySelector('.simulation-banner').textContent='PREPARING YOUR KEEPSAKE';
  $('forge-error').hidden=true;$('forge-name').textContent=config.title;$('forge-body').textContent='Saving your design…';$('forge-trace').textContent='';$('forge-image').innerHTML='';$('forge-reference').hidden=true;$('forge-steps').innerHTML='';$('forge-phase').textContent='DESIGN';
  if(!$('forge-dialog').open)$('forge-dialog').showModal();
  const design={...structuredClone(config.design||{}),emblem:config.emblem||config.design?.emblem||config.design?.sigil||'sun',metal:config.metal||'#d4a742',referenceSvg:config.design?.referenceSvg||callbacks.preview(config.type,config.emblem,config.metal)};
  try {
    const catalog = await client.catalog();
    if (catalog.mode === 'live' && config.type !== 'pendant') design.referencePng = await rasterizeDesign(design.referenceSvg);
    const record=await client.createKeepsake({recipe:config.type,title:config.title,prompt:config.prompt,sourceEventId:config.sourceEventId||'studio-'+config.type,story:config.story||[],design});
    if(current!==opening)return;session=await client.getKeepsake(record.id);if(current!==opening)return;render();
    if (!session.simulated && session.phase==='draft') { await generate(); return; }
    if(['pattern','product'].includes(session.phase))observe();
  }catch(error){if(current!==opening)return;showError(error);$('forge-body').innerHTML='<button id="forge-retry" class="primary">Try saving again</button>';$('forge-retry').onclick=()=>openForge(config);}
}
export async function openCollection() {
  const current=++opening;callbacks.pause();$('craftkit-collection').showModal();$('craftkit-collection-list').textContent='Loading saved keepsakes…';
  try { const records=await client.listKeepsakes();if(current!==opening)return;
    $('craftkit-collection-list').innerHTML=records.length?records.map((r,i)=>`<button data-keepsake="${i}" class="secondary craftkit-saved"><strong>${escape(r.title)}</strong><small>${r.order?labels[r.order.status]:escape(r.phase)} / ${new Date(r.createdAt).toLocaleDateString()}</small></button>`).join(''):'No keepsakes yet. Design something or reach a milestone.';
    document.querySelectorAll('[data-keepsake]').forEach(button=>button.onclick=async()=>{const selected=records[Number(button.dataset.keepsake)],turn=++opening;$('craftkit-collection').close();session=null;$('forge-dialog').showModal();$('forge-body').textContent='Loading keepsake…';$('forge-error').hidden=true;
      try{const record=await client.getKeepsake(selected.id);if(turn!==opening)return;session=record;render();if(['pattern','product'].includes(session.phase))observe();}catch(error){if(turn===opening)showError(error);}});
  }catch(error){if(current===opening)$('craftkit-collection-list').textContent=error.message;}
}
export function forgeSnapshot(){return session?{simulated:session.simulated,keepsakeId:session.id,gameId:session.gameId,phase:session.phase,type:session.type,quantity:session.quantity,orderStatus:session.order?.status||null}:null;}

export async function supportedFormats() {
  const catalog=await client.catalog();
  if(catalog.mode!=='live') return null;
  const match={scarf:/^scarves$/i,pillow:/^decorative pillows$/i,pendant:/^pendant necklace$/i,rug:/^rugs?$/i,plush:/^plush/i,trophy:/^troph/i};
  return Object.keys(match).filter(type=>catalog.categories.items.some(category=>match[type].test(category.name)));
}

export async function openSavedKeepsake(id) {
  const current=++opening;callbacks.pause();session=null;
  $('forge-error').hidden=true;$('forge-dialog').showModal();$('forge-body').textContent='Loading keepsake…';
  try{const record=await client.getKeepsake(id);if(current!==opening)return;session=record;render();if(['pattern','product'].includes(record.phase))observe();}
  catch(error){if(current===opening)showError(error);}
}

export function openOffering(id,input){return openForge(buildOffering(id,input));}
