import {feedback} from './tactile.js';
import {pieceSvg} from './chess-pieces.js';
import {Chess,chooseMove} from './chess-engine.js';
import {matchArtwork} from './chess-art.js';
import {initForge,openForge,openCollection,supportedFormats} from './commerce.js';
const $=id=>document.getElementById(id);
const chess=new Chess();let selected=null,busy=false,paused=false,nativePaused=false,pending=null,aiTimer,matchId,mode='computer';
try{const saved=JSON.parse(localStorage.getItem('nexus-chess-match'));if(saved?.pgn)chess.loadPgn(saved.pgn);matchId=saved?.id;mode=saved?.mode==='friend'?'friend':'computer';}catch{chess.reset();}
matchId ||= crypto.randomUUID();$('mode').value=mode;
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
  $('match-preview').innerHTML=matchArtwork(history);$('move-count').textContent=history.length+' moves';
  $('keep-match').disabled=history.length<4;$('keep-match').innerHTML=history.length<4?'Play 4 moves to make your keepsake <span>↗</span>':'Make my match keepsake <span>↗</span>';
  $('history-empty').hidden=history.length>0;$('undo').disabled=history.length===0||busy;
  $('history').innerHTML=Array.from({length:Math.ceil(history.length/2)},(_,i)=>`<li><span>${i+1}.</span><span>${history[i*2]?.san||''}</span><span>${history[i*2+1]?.san||'—'}</span></li>`).join('');$('history').scrollTop=$('history').scrollHeight;
  persist();
}
function tap(square){
  if(busy||paused||nativePaused||chess.isGameOver()||mode==='computer'&&chess.turn()==='b')return;
  const options=selected?chess.moves({square:selected,verbose:true}).filter(m=>m.to===square):[];
  if(options.length){if(options.some(m=>m.promotion)){pending={from:selected,to:square};$('promotion-options').innerHTML=['q','r','b','n'].map(p=>`<button data-promote="${p}" aria-label="Promote to ${{q:'queen',r:'rook',b:'bishop',n:'knight'}[p]}">${pieceSvg(p,chess.turn(),'promotion-'+p)}</button>`).join('');document.querySelectorAll('[data-promote]').forEach(b=>b.onclick=()=>{$('promotion').close();play({...pending,promotion:b.dataset.promote});pending=null;});$('promotion').showModal();return;}play({from:selected,to:square});return;}
  const piece=chess.get(square);selected=piece?.color===chess.turn()?(selected===square?null:square):null;render();
}
function performMove(move) {
  const source=document.querySelector(`[data-square="${move.from}"] .piece`),rect=source?.getBoundingClientRect(),ghost=source?.cloneNode(true);
  const result=chess.move(move);selected=null;busy=mode==='computer'&&chess.turn()==='b'&&!chess.isGameOver();render();
  feedback(chess.isCheckmate()?'success':result.captured?'medium':'light');
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
$('undo').onclick=()=>{clearTimeout(aiTimer);chess.undo();if(mode==='computer'&&chess.turn()==='b')chess.undo();selected=null;busy=false;render();scheduleComputer();};
$('new-game').onclick=()=>$('reset-match').showModal();$('reset-cancel').onclick=()=>$('reset-match').close();$('reset-confirm').onclick=()=>{clearTimeout(aiTimer);chess.reset();matchId=crypto.randomUUID();selected=null;busy=false;$('reset-match').close();render();};
$('mode').onchange=()=>{mode=$('mode').value;render();scheduleComputer();};
$('saved').onclick=openCollection;
$('export-match').onclick=()=>{const data=chess.pgn(),name='chess-atelier-'+matchId.slice(0,8)+'.pgn';if(window.webkit?.messageHandlers?.nexusExport){const base64=btoa(data);window.webkit.messageHandlers.nexusExport.postMessage({filename:name,base64});return;}const url=URL.createObjectURL(new Blob([data],{type:'application/x-chess-pgn'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
initForge({gameId:'chess-atelier',pause(){paused=true;clearTimeout(aiTimer);busy=false;},resume(){paused=false;scheduleComputer();},preview(){return matchArtwork(chess.history({verbose:true}));}});
$('keep-match').onclick=async()=>{const history=chess.history({verbose:true});if(history.length<4)return;try{const formats=await supportedFormats(),type=!formats||formats.includes('scarf')?'scarf':formats.includes('pillow')?'pillow':formats[0];await openForge({type,title:'Chess Atelier / '+history.length+' moves',sourceEventId:'match-'+matchId+'-'+history.length,prompt:'An elegant geometric chess-inspired textile using the attached match artwork: ivory and muted terracotta curved paths on espresso brown, delicate brass framing, an abstract checkerboard. The paths are the actual moves of this match. Preserve the composition, no logos or extra text.',design:{referenceSvg:matchArtwork(history),pgn:chess.pgn(),fen:chess.fen(),moves:history.map(m=>({from:m.from,to:m.to,color:m.color,san:m.san}))},story:[{event:'chess-match',moves:history.length,result:chess.isCheckmate()?'checkmate':chess.isDraw()?'draw':'in-progress'}]});}catch(error){$('status').textContent=error.message;}};
addEventListener('nexus-native-pause',e=>{nativePaused=!!e.detail.paused;if(nativePaused){clearTimeout(aiTimer);busy=false;}else scheduleComputer();});
render();scheduleComputer();
