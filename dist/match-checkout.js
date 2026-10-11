// From the end of a match to Arcade checkout in one sheet. Arcade starts making the
// product the moment the match ends, so by the time the player has looked at their
// board the real preview and price are usually waiting. One tap opens checkout.
import {CraftKitClient} from './craftkit-client.js';
import {rasterizeDesign} from './design-reference.js';
import {openSavedKeepsake, supportedFormats} from './commerce.js';
import {productPreview} from './product-mockup.js';
import {feedback} from './tactile.js';

const escape = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const usd = m => m ? new Intl.NumberFormat(undefined, {style: 'currency', currency: m.currency}).format(Number(m.amount)) : '';
const NAMES = {scarf: 'Scarf', pillow: 'Pillow', pendant: 'Pendant'};
const HEADLINES = {checkmate: 'Checkmate.', stalemate: 'Stalemate.', draw: 'A draw.', resigned: 'Match finished.', 'in-progress': 'Your match, so far.'};

export function initMatchCheckout({gameId, pause = () => {}, resume = () => {}}) {
  const client = new CraftKitClient({gameId});
  const dialog = document.createElement('dialog');
  dialog.id = 'match-checkout';
  dialog.setAttribute('aria-label', 'Your match keepsake');
  dialog.innerHTML = `
    <div class="mc-card">
      <div class="mc-head">
        <div><span class="chess-eyebrow mc-eyebrow">MATCH COMPLETE</span><h2 class="mc-title"></h2><p class="mc-sub"></p></div>
        <button class="studio-close" data-act="close" aria-label="Close">×</button>
      </div>
      <div class="mc-art"><img class="mc-design" alt="Your match"><canvas class="mc-canvas" role="img" aria-label="Your match, painting itself"></canvas><div class="mc-product" aria-label="Physical product preview"></div><div class="mc-sheen"></div></div>
      <div class="mc-formats" role="group" aria-label="Make it as"></div>
      <div class="mc-status" role="status" aria-live="polite"><span class="mc-dot"></span><span class="mc-status-text"></span></div>
      <div class="mc-price" hidden><div><strong class="mc-amount"></strong><small class="mc-detail"></small></div><small class="mc-maker"></small></div>
      <button class="keep-button mc-primary" data-act="primary"></button>
      <div class="mc-secondary">
        <button class="quiet-button" data-act="options">Change options</button>
        <button class="quiet-button" data-act="close">Not now</button>
      </div>
      <p class="mc-note">Live Arcade checkout. You review shipping and tax before paying, and your digital match is yours either way.</p>
    </div>`;
  document.body.append(dialog);
  const $ = sel => dialog.querySelector(sel);

  let config = null, type = null, formats = [], runs = {}, timer = null, opened = 0;

  function show() {
    const run = runs[type] || {};
    const record = run.record, phase = record?.phase || (run.error ? 'failed' : 'saving');
    const name = (NAMES[type] || type || 'keepsake').toLowerCase();
    dialog.querySelectorAll('[data-format]').forEach(b => b.setAttribute('aria-pressed', b.dataset.format === type));
    const ready = record && ['quote', 'checkout', 'order'].includes(phase);
    const image = ready && ['quote','checkout','order'].includes(phase);
    $('.mc-product').classList.toggle('shown', !!image);
    if(image){const previewKey=record.id+'-'+record.revision+'-'+(record.product?.imageUrl||'mockup');if($('.mc-product').dataset.previewKey!==previewKey){$('.mc-product').innerHTML=productPreview(record);$('.mc-product').dataset.previewKey=previewKey;}}
    $('.mc-art').classList.toggle('working', !ready && phase !== 'failed');
    const elapsed = run.started ? Math.round((Date.now() - run.started) / 1000) : 0;
    const status = {
      saving: 'Saving your match…',
      draft: 'Starting Arcade…',
      pattern: `Arcade is turning your match into a ${name} pattern · ${elapsed}s`,
      product: `A maker is preparing your ${name} · ${elapsed}s`,
      quote: `Your ${name} is ready.`,
      checkout: 'Finish your purchase in Arcade checkout.',
      order: `Ordered. ${record?.order?.orderNumber || ''}`,
      failed: run.error || record?.error || 'Arcade could not make this one.',
    }[phase] || 'Working…';
    $('.mc-status-text').textContent = status;
    $('.mc-note').textContent=record?.simulated?'Demo product and sample price. No real payment or order.':'Review shipping and tax in Arcade checkout before paying. Your digital match stays yours.';
    $('.mc-status').dataset.state = ready ? 'ready' : phase === 'failed' ? 'failed' : 'working';
    $('.mc-price').hidden = !ready;
    if (ready) {
      $('.mc-amount').textContent = usd(record.quote?.subtotal || record.product?.unitPrice);
      $('.mc-detail').textContent = record.product?.selectionLabel || Object.values(record.selections || {}).join(' · ');
      $('.mc-maker').textContent = record.product?.maker?.name ? `Made by ${record.product.maker.name}` : '';
    }
    const primary = $('.mc-primary');
    primary.disabled = !ready && phase !== 'failed';
    primary.innerHTML = phase === 'failed' ? 'Try again <span>↻</span>'
      : phase === 'quote' ? `${record.simulated?'Buy now / demo':'Buy now'} · ${usd(record.quote?.subtotal)} <span>↗</span>`
      : phase === 'checkout' ? 'Continue to checkout <span>↗</span>'
      : phase === 'order' ? 'Ordered ✓'
      : `Preparing your ${name}…`;
    if (phase === 'order') primary.disabled = true;
    $('[data-act="options"]').disabled = !record;
  }

  async function prepare(kind) {
    const run = runs[kind] ||= {};
    if (run.promise) return run.promise;
    run.error = null; run.started = Date.now();
    run.promise = (async () => {
      const keepsake = config.keepsake(kind);
      const design = {...keepsake.design};
      const catalog = await client.catalog();
      if (catalog.mode === 'live') design.referencePng = await rasterizeDesign(design.referenceSvg);
      // Every keepsake comes from a shared CraftKit offering (e.g. move-art, match-victory).
      let record = await client.createFromOffering(keepsake.offering, {...keepsake, type: kind, design});
      record = await client.getKeepsake(record.id);
      run.record = record; if (kind === type) show();
      if (['draft', 'failed'].includes(record.phase)) { record = await client.generateProduct(record.id); run.record = record; if (kind === type) show(); }
      if (['pattern', 'product'].includes(record.phase)) {
        record = await client.waitForProduct(record.id, {onUpdate: r => { run.record = r; if (kind === type) show(); }});
      }
      run.record = record;
      if (kind === type) { show(); if (record.phase === 'quote') feedback('success'); }
      return record;
    })().catch(error => { run.error = error.message; run.promise = null; if (kind === type) show(); });
    return run.promise;
  }

  function openCheckoutUrl(url) {
    if (!url || new URL(url).protocol !== 'https:') return;
    if (window.webkit?.messageHandlers?.craftkitCheckout) window.webkit.messageHandlers.craftkitCheckout.postMessage(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function primary() {
    const run = runs[type], record = run?.record;
    if (!record || run.error || record.phase === 'failed') { if (run) { run.promise = null; run.error = null; } prepare(type); show(); return; }
    if (record.simulated) { close(false); openSavedKeepsake(record.id); return; }
    $('.mc-primary').disabled = true;
    try {
      if (record.phase === 'quote') {
        let next;
        try { next = await client.openCheckout(record.id); }
        catch (error) { if (error.status !== 409) throw error; await client.refreshQuote(record.id); next = await client.openCheckout(record.id); }
        run.record = next; feedback('medium');
        openCheckoutUrl(next.checkout?.url);
      } else if (record.phase === 'checkout') openCheckoutUrl(record.checkout?.url);
    } catch (error) { run.error = error.message; }
    show();
  }

  async function refresh() {
    const run = runs[type];
    if (!run?.record) return;
    try { run.record = await client.getKeepsake(run.record.id); } catch {}
    show();
  }

  function close(resumeGame = true) {
    clearInterval(timer); timer = null; opened++;
    if (dialog.open) dialog.close();
    if (resumeGame) resume();
  }

  dialog.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'close') close();
    if (act === 'primary') primary();
    if (act === 'options' && runs[type]?.record) { const id = runs[type].record.id; close(false); openSavedKeepsake(id); }
  });
  dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
  // The iOS app tells the page when Arcade checkout closes; the web page checks when it regains focus.
  window.addEventListener('craftkit-payment-return', () => { if (dialog.open) refresh(); });
  window.addEventListener('focus', () => { if (dialog.open && runs[type]?.record?.phase === 'checkout') refresh(); });

  return {
    async open(next) {
      const turn = ++opened;
      if (config?.matchKey !== next.matchKey) runs = {};
      config = next; pause();
      $('.mc-eyebrow').textContent = next.result === 'in-progress' ? 'YOUR MATCH' : 'MATCH COMPLETE';
      $('.mc-title').textContent = HEADLINES[next.result] || HEADLINES['in-progress'];
      $('.mc-sub').textContent = next.subtitle;
      $('.mc-product').classList.remove('shown');
      // A game that can paint itself replays its own painting while Arcade works.
      const painting = typeof next.paint === 'function';
      $('.mc-canvas').hidden = !painting; $('.mc-design').hidden = painting;
      if (!painting) $('.mc-design').src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(next.keepsake('scarf').design.referenceSvg);
      if (!dialog.open) dialog.showModal();
      if (painting) try { next.paint($('.mc-canvas')); } catch { $('.mc-canvas').hidden = true; $('.mc-design').hidden = false; $('.mc-design').src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(next.keepsake('scarf').design.referenceSvg); }
      try { formats = (await supportedFormats())?.filter(f => ['scarf','pillow'].includes(f)) ?? ['scarf', 'pillow']; } catch(error) {if(turn!==opened)return;$('.mc-status-text').textContent=error.message;$('.mc-primary').textContent='Keepsakes unavailable';$('.mc-primary').disabled=true;return;}
      if (turn !== opened) return;
      if (!formats.length){type=null;$('.mc-formats').innerHTML='';$('.mc-status-text').textContent='Physical keepsakes are unavailable right now. Your digital match is yours to keep.';$('.mc-primary').textContent='Keepsakes unavailable';$('.mc-primary').disabled=true;$('.mc-price').hidden=true;return;}
      type = formats.includes(next.preferred) ? next.preferred : formats.includes(type) ? type : formats[0];
      $('.mc-formats').innerHTML = formats.map(f => `<button data-format="${f}">${escape(NAMES[f] || f)}</button>`).join('');
      $('.mc-formats').querySelectorAll('[data-format]').forEach(b => b.onclick = () => { type = b.dataset.format; prepare(type); show(); feedback('light'); });
      show(); prepare(type);
      clearInterval(timer); timer = setInterval(() => dialog.open && show(), 1000);
    },
  };
}
