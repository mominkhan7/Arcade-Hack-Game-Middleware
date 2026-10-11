import {feedback} from './tactile.js';
import {pieceSvg} from './chess-pieces.js';
import {Chess,chooseMove} from './chess-engine.js';
import {matchArtwork} from './chess-art.js';
import {initForge,openForge,openCollection,supportedFormats} from './commerce.js';
import {initBoardStudio,loadBoard,boardImage,boardLook} from './board-studio.js';
import {initMatchCheckout} from './match-checkout.js';
import {MoveArt,CLASSICS} from './move-art.js';
import {PALETTES,paletteById} from './marbling.js';
const $=id=>document.getElementById(id);
const chess=new Chess();let selected=null,busy=false,paused=false,nativePaused=false,pending=null,aiTimer,matchId,mode='computer';
try{const saved=JSON.parse(localStorage.getItem('nexus-chess-match'));if(saved?.pgn)chess.loadPgn(saved.pgn);matchId=saved?.id;mode=saved?.mode==='friend'?'friend':'computer';}catch{chess.reset();}
matchId ||= crypto.randomUUID();$('mode').value=mode;
// The player's poured board (Board Studio): shown under play, and carried into the keepsake.
let board=null,boardArt=null;
function applyBoard(next){
  board=next;boardArt=null;const el=$('chess-board'),frame=document.querySelector('.board-frame');
  try{if(board){const look=boardLook(board);
    el.style.setProperty('--board-image',`url(${boardImage(board,1024)})`);el.style.setProperty('--light-tint',look.lightTint);el.style.setProperty('--dark-tint',look.darkTint);el.style.setProperty('--board-filter',look.filter);
    frame.style.setProperty('--frame-bg',look.frameBg);boardArt={image:boardImage(board,640),look};}}catch{board=null;}
  $('design-board').textContent=board?'Repour your board':'Design your board';applySurface();
}
// The board surface: painted live by the match's own moves (the hero), the player's pour, or classic wood.
const store=(key,value)=>{try{value===undefined?0:localStorage.setItem(key,value);return localStorage.getItem(key);}catch{return null;}};
let surface=store('nexus-chess-surface')||'painted';
// The match's inks: a palette id, or the player's own colors (saved as JSON).
const savedInks=(()=>{const v=store('nexus-chess-art-palette');try{return v?.startsWith('{')?JSON.parse(v):v;}catch{return null;}})();
const art=new MoveArt(savedInks||'atelier');
try{art.attach($('board-art'));art.attach($('match-art-canvas'));}catch{surface=surface==='painted'?'classic':surface;}
function applySurface(next){
  if(next==='poured'&&!board){studio.open();return;}
  if(next)surface=store('nexus-chess-surface',next);
  if(surface==='poured'&&!board)surface='painted';
  const el=$('chess-board'),frame=document.querySelector('.board-frame');
  el.classList.toggle('painted',surface==='painted');el.classList.toggle('marbled',surface==='poured');
  frame.classList.toggle('custom-frame',surface==='poured');frame.classList.toggle('surface-painted',surface==='painted');
  document.querySelectorAll('[data-surface]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.surface===surface));
}
document.querySelectorAll('[data-surface]').forEach(b=>b.onclick=()=>{applySurface(b.dataset.surface);feedback('light');});
const studio=initBoardStudio({onApply(next){applyBoard(next);applySurface(next?'poured':surface==='poured'?'painted':surface);render();}});
// The art panel: painted (live marbling) or lines (the original move-path drawing), in any palette.
let artStyle='painted';
function setArtStyle(next){artStyle=next;$('match-art-canvas').hidden=next!=='painted';$('match-preview').hidden=next==='painted';document.querySelectorAll('[data-art]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.art===next));}
document.querySelectorAll('[data-art]').forEach(b=>b.onclick=()=>{setArtStyle(b.dataset.art);feedback('light');});
document.querySelector('.art-palettes').innerHTML=PALETTES.map(p=>`<button data-art-palette="${p.id}" aria-label="${p.name} inks" title="${p.name}" style="background:conic-gradient(${p.inks.slice(0,4).map(([,h],i)=>`${h} ${i*25}% ${(i+1)*25}%`).join(',')})"></button>`).join('');
const markPalette=()=>{
  document.querySelectorAll('[data-art-palette]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.artPalette===art.palette.id));
  const [blackPieces,whitePieces,whitePawns,blackPawns]=art.palette.inks.map(([,h])=>h);
  $('ink-colors').querySelector('i').style.background=`conic-gradient(${whitePieces} 0 25%,${whitePawns} 0 50%,${blackPieces} 0 75%,${blackPawns} 0)`;
};
function setInks(palette){art.setPalette(palette);store('nexus-chess-art-palette',art.palette.id==='custom'?JSON.stringify(art.palette):art.palette.id);markPalette();inkSheet?.sync();}
document.querySelectorAll('[data-art-palette]').forEach(b=>b.onclick=()=>{setInks(b.dataset.artPalette);feedback('light');});
// Ink colors: choose a palette or pick each side's ink, previewed live on this match.
const INK_ROLES=[['White pieces',1],['White pawns',2],['Black pieces',0],['Black pawns',3],['Capture splash',4],['Paper','paper']];
let inkSheet=null;
function openInkSheet(){
  if(!inkSheet){
    const d=document.createElement('dialog');d.id='ink-sheet';d.setAttribute('aria-label','Ink colors');
    d.innerHTML=`<div class="studio-card"><div class="studio-head"><div><span class="chess-eyebrow">INK COLORS</span><h2>Choose your inks.</h2></div><button class="studio-close" data-close aria-label="Close">×</button></div>
      <p class="studio-lede">Each piece paints with its side's ink as it moves. Changes repaint your match right away.</p>
      <div class="ink-preview"><canvas aria-label="Your match in these inks" role="img"></canvas></div>
      <span class="studio-label">YOUR INKS <small>Tap a color to pick your own.</small></span>
      <div class="studio-custom ink-roles">${INK_ROLES.map(([name,key])=>`<label class="custom-color"><input type="color" data-ink="${key}" aria-label="${name} ink"><span>${name}</span></label>`).join('')}</div>
      <span class="studio-label">PALETTES</span>
      <div class="studio-palettes">${PALETTES.map(p=>`<button data-ink-palette="${p.id}"><span class="chips" style="background:${p.paper}">${p.inks.slice(0,4).map(([,h])=>`<i style="background:${h}"></i>`).join('')}</span><span>${p.name}</span></button>`).join('')}</div>
      <button class="keep-button" data-close>Done <span>✓</span></button></div>`;
    document.body.append(d);
    try{art.attach(d.querySelector('.ink-preview canvas'));}catch{d.querySelector('.ink-preview').hidden=true;}
    d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());
    d.querySelectorAll('[data-ink-palette]').forEach(b=>b.onclick=()=>{setInks(b.dataset.inkPalette);feedback('light');});
    d.querySelectorAll('[data-ink]').forEach(input=>input.oninput=()=>{
      const p=art.palette,custom={id:'custom',name:'Your inks',paper:p.paper,inks:p.inks.map(([n,h])=>[n,h])};
      if(input.dataset.ink==='paper')custom.paper=input.value.toUpperCase();else custom.inks[Number(input.dataset.ink)][1]=input.value.toUpperCase();
      setInks(custom);
    });
    inkSheet={dialog:d,sync(){
      d.querySelectorAll('[data-ink]').forEach(input=>{const key=input.dataset.ink,value=(key==='paper'?art.palette.paper:art.palette.inks[Number(key)][1]).toLowerCase();if(document.activeElement!==input)input.value=value;});
      d.querySelectorAll('[data-ink-palette]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.inkPalette===art.palette.id));
    }};
  }
  inkSheet.sync();inkSheet.dialog.showModal();art.draw();
}
$('ink-colors').onclick=()=>{openInkSheet();feedback('light');};
markPalette();
$('art-replay').onclick=()=>{setArtStyle('painted');art.replay(chess.history({verbose:true}),{msPerMove:Math.min(380,Math.max(140,9000/Math.max(1,chess.history().length)))});feedback('light');};
const result=()=>chess.isCheckmate()?'checkmate':chess.isStalemate()?'stalemate':chess.isDraw()?'draw':'in-progress';
function artSvg(){return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720"><image href="${art.image(768)}" width="720" height="720" preserveAspectRatio="none"/></svg>`;}
function keepsakeFor(kind){
  const history=chess.history({verbose:true}),n=history.length;
  return {title:'Chess Atelier / '+n+' moves, painted',sourceEventId:'match-'+matchId+'-'+n+'-painted',
    prompt:'Hand-marbled paper whose ink trails were made by the moves of a chess match: every piece began as a drop of ink and dragged its color across the water each time it moved. Keep the composition, the trails, the drops and the colors of the attached reference. Real pigment on paper with fine feathered detail. No chessboard, no chess pieces, no logos or text.',
    design:{referenceSvg:artSvg(),pgn:chess.pgn(),fen:chess.fen(),moves:history.map(m=>({from:m.from,to:m.to,color:m.color,san:m.san})),modelId:'nonpareil-hand-marbled',colors:art.palette.inks.map(([,h])=>h),artPalette:art.palette.name},
    story:[{event:'chess-match',moves:n,result:result(),painted:true}]};
}
let sheetArt=null;
const matchCheckout=initMatchCheckout({gameId:'chess-atelier',pause(){paused=true;clearTimeout(aiTimer);busy=false;},resume(){paused=false;scheduleComputer();}});
function openKeep(outcome){
  const n=chess.history().length;if(n<4)return;
  const history=chess.history({verbose:true});
  matchCheckout.open({matchKey:matchId+'-'+n+'-'+art.palette.id,result:outcome,subtitle:`${Math.ceil(n/2)} moves, painted by the pieces themselves. Keep it as something real.`,keepsake:keepsakeFor,
    paint(canvas){sheetArt||=(()=>{const a=new MoveArt(art.palette);a.attach(canvas);return a;})();sheetArt.setPalette(art.palette);return sheetArt.replay(history,{msPerMove:Math.min(380,Math.max(120,8000/n))});}});
}
$('design-board').onclick=()=>studio.open();
applyBoard(loadBoard());
const persist=()=>{try{localStorage.setItem('nexus-chess-match',JSON.stringify({id:matchId,pgn:chess.pgn(),mode}));}catch{}};
function render(){
  const history=chess.history({verbose:true}),last=history.at(-1),legal=selected?chess.moves({square:selected,verbose:true}):[];
  $('chess-board').innerHTML=chess.board().flatMap((row,r)=>row.map((p,c)=>{const square=String.fromCharCode(97+c)+(8-r),allowed=legal.some(m=>m.to===square);return `<button data-square="${square}" class="square ${(r+c)%2?'dark':''} ${selected===square?'selected':''} ${last&&(last.from===square||last.to===square)?'last':''} ${allowed?'legal':''} ${p?.type==='k'&&p.color===chess.turn()&&chess.isCheck()?'check':''}" aria-label="${square}${p?', '+(p.color==='w'?'white':'black')+' '+({p:'pawn',k:'king',q:'queen',r:'rook',b:'bishop',n:'knight'})[p.type]:', empty'}${allowed?', legal destination':''}" aria-pressed="${selected===square}">${p?`<span class="piece ${p.color==='w'?'white':'black'}" aria-hidden="true">${pieceSvg(p.type,p.color,square)}</span>`:''}${c===0?`<span class="coord" style="top:3px;bottom:auto">${8-r}</span>`:''}${r===7?`<span class="coord" style="left:auto;right:4px">${String.fromCharCode(97+c)}</span>`:''}</button>`;})).join('');
  document.querySelectorAll('[data-square]').forEach(b=>b.onclick=()=>tap(b.dataset.square));
  let status=busy?'The Atelier is thinking…':chess.turn()==='w'?'Your move. Tap a piece, then a highlighted square.':mode==='friend'?'Black to move. Pass the board.':'The Atelier to move.';
  if(chess.isCheckmate())status=`Checkmate. ${chess.turn()==='w'?'Black':'White'} wins. Your match is ready to keep.`;
  else if(chess.isStalemate())status='Stalemate. A shared ending, a unique pattern.';
  else if(chess.isDraw())status='Match drawn. Your moves still made something unique.';
  else if(chess.isCheck())status+=(chess.turn()==='w'?' White':' Black')+' is in check.';
  $('status').textContent=status;$('opponent').textContent=mode==='computer'?'The Atelier':'Your friend';$('opponent-detail').textContent=mode==='computer'?'Computer · a gentle challenge':'Pass & play · black pieces';
  $('match-preview').innerHTML=matchArtwork(history,boardArt);art.sync(history);$('move-count').textContent=Math.ceil(history.length/2)+(history.length>2?' moves':' move');
  $('keep-match').disabled=history.length<4;$('keep-match').innerHTML=history.length<4?'Play 2 moves each to make your keepsake <span>↗</span>':'Keep this painting <span>↗</span>';
  $('finish-match').disabled=history.length<4;$('finish-match').textContent=chess.isGameOver()?'Keep this match ↗':'Finish & keep ↗';
  $('history-empty').hidden=history.length>0;$('undo').disabled=history.length===0||busy;
  $('history').innerHTML=Array.from({length:Math.ceil(history.length/2)},(_,i)=>`<li><span>${i+1}.</span><span>${history[i*2]?.san||''}</span><span>${history[i*2+1]?.san||'—'}</span></li>`).join('');$('history').scrollTop=$('history').scrollHeight;
  persist();
}
function tap(square){
  if(replaying||busy||paused||nativePaused||chess.isGameOver()||mode==='computer'&&chess.turn()==='b')return;
  const options=selected?chess.moves({square:selected,verbose:true}).filter(m=>m.to===square):[];
  if(options.length){if(options.some(m=>m.promotion)){pending={from:selected,to:square};$('promotion-options').innerHTML=['q','r','b','n'].map(p=>`<button data-promote="${p}" aria-label="Promote to ${{q:'queen',r:'rook',b:'bishop',n:'knight'}[p]}">${pieceSvg(p,chess.turn(),'promotion-'+p)}</button>`).join('');document.querySelectorAll('[data-promote]').forEach(b=>b.onclick=()=>{$('promotion').close();play({...pending,promotion:b.dataset.promote});pending=null;});$('promotion').showModal();return;}play({from:selected,to:square});return;}
  const piece=chess.get(square);selected=piece?.color===chess.turn()?(selected===square?null:square):null;render();
}
function performMove(move) {
  const source=document.querySelector(`[data-square="${move.from}"] .piece`),rect=source?.getBoundingClientRect(),ghost=source?.cloneNode(true);
  const result=chess.move(move);selected=null;busy=mode==='computer'&&chess.turn()==='b'&&!chess.isGameOver();render();
  feedback(chess.isCheckmate()?'success':result.captured?'medium':'light');
  if(chess.isGameOver())setTimeout(()=>openKeep(chess.isCheckmate()?'checkmate':chess.isStalemate()?'stalemate':'draw'),900);
  if(!ghost||!rect||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const target=document.querySelector(`[data-square="${move.to}"] .piece`),end=target?.getBoundingClientRect();if(!end)return;
  ghost.classList.remove('piece');ghost.classList.add('flying-piece');Object.assign(ghost.style,{position:'fixed',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
  document.body.append(ghost);target.style.opacity='0';
  const animation=ghost.animate([{transform:'translate(0,0) scale(1)'},{transform:`translate(${(end.left-rect.left)*.6}px,${(end.top-rect.top)*.6-6}px) scale(1.08)`,offset:.55},{transform:`translate(${end.left-rect.left}px,${end.top-rect.top}px) scale(1)`}],{duration:280,easing:'cubic-bezier(.2,.8,.25,1)'});
  animation.finished.catch(()=>{}).finally(()=>{ghost.remove();target.style.opacity='';});
}
function play(move){performMove(move);scheduleComputer(true);}
function scheduleComputer(skipRender=false){
  clearTimeout(aiTimer);if(mode!=='computer'||chess.turn()!=='b'||chess.isGameOver()||paused||nativePaused){busy=false;return;}
  busy=true;if(!skipRender)render();aiTimer=setTimeout(()=>{const move=chooseMove(chess,2);if(move)performMove(move);else{busy=false;render();}},650);
}
$('undo').onclick=()=>{clearTimeout(aiTimer);stopReplay();chess.undo();if(mode==='computer'&&chess.turn()==='b')chess.undo();selected=null;busy=false;render();scheduleComputer();};
$('new-game').onclick=()=>$('reset-match').showModal();$('reset-cancel').onclick=()=>$('reset-match').close();$('reset-confirm').onclick=()=>{clearTimeout(aiTimer);stopReplay();chess.reset();matchId=crypto.randomUUID();selected=null;busy=false;$('reset-match').close();render();};
$('mode').onchange=()=>{mode=$('mode').value;render();scheduleComputer();};
$('saved').onclick=openCollection;
$('export-match').onclick=()=>{const data=chess.pgn(),name='chess-atelier-'+matchId.slice(0,8)+'.pgn';if(window.webkit?.messageHandlers?.nexusExport){const base64=btoa(data);window.webkit.messageHandlers.nexusExport.postMessage({filename:name,base64});return;}const url=URL.createObjectURL(new Blob([data],{type:'application/x-chess-pgn'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
initForge({gameId:'chess-atelier',pause(){paused=true;clearTimeout(aiTimer);busy=false;},resume(){paused=false;scheduleComputer();},preview(){return matchArtwork(chess.history({verbose:true}),boardArt);}});
$('keep-match').onclick=()=>openKeep(result());
$('finish-match').onclick=()=>openKeep(chess.isGameOver()?result():'resigned');
let replaying=false,replayRun=0;
function stopReplay(){replayRun++;replaying=false;}
const classics=document.createElement('dialog');classics.id='classics';
classics.innerHTML=`<div class="studio-card"><div class="studio-head"><div><span class="chess-eyebrow">REPLAY A CLASSIC</span><h2>Watch a game paint itself.</h2></div><button class="studio-close" data-close aria-label="Close">×</button></div><p class="studio-lede">A famous game plays out on the board while its moves paint the ink beneath. It replaces your current match.</p>${CLASSICS.map(c=>`<button class="classic-option" data-classic="${c.id}"><strong>${c.name}</strong><small>${c.detail}</small></button>`).join('')}</div>`;
document.body.append(classics);
classics.querySelector('[data-close]').onclick=()=>classics.close();
$('replay-classic').onclick=()=>classics.showModal();
classics.querySelectorAll('[data-classic]').forEach(b=>b.onclick=async()=>{
  const game=CLASSICS.find(c=>c.id===b.dataset.classic),sans=new Chess();sans.loadPgn(game.pgn);
  const moves=sans.history();classics.close();clearTimeout(aiTimer);
  const run=++replayRun;replaying=true;mode='friend';$('mode').value=mode;chess.reset();matchId=crypto.randomUUID();selected=null;busy=false;
  applySurface('painted');setArtStyle('painted');render();document.querySelector('.board-frame').scrollIntoView({behavior:'smooth',block:'center'});
  await new Promise(r=>setTimeout(r,900));
  for(const san of moves){
    if(run!==replayRun)return;
    const move=chess.moves({verbose:true}).find(m=>m.san===san);if(!move)break;
    performMove({from:move.from,to:move.to,promotion:move.promotion});
    await new Promise(r=>setTimeout(r,520));
  }
  if(run===replayRun)replaying=false;render();
});
addEventListener('nexus-native-pause',e=>{nativePaused=!!e.detail.paused;if(nativePaused){clearTimeout(aiTimer);busy=false;}else scheduleComputer();});
render();scheduleComputer();
