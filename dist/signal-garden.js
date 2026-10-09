import {initForge,openForge} from './commerce.js';
const $=id=>document.getElementById(id);
const colors={lagoon:['#091b2d','#78f0da','#ffc66d'],ember:['#27132a','#ff9b68','#ffe398'],violet:['#211c42','#b5a2ff','#83edeb']};
// Ports: north, east, south, west. The intended path snakes through all tiles.
const bases=[[1,3],[1,3],[2,3],[1,2],[1,3],[0,3],[0,1],[1,3],[1,3]];
let turns=[],moves=0,runId,paused=false,palette='lagoon',solved=false;
const ports=i=>bases[i].map(p=>(p+turns[i])%4);
function circuit(){
  const visited=new Set();let tile=0,entry=3;
  while(tile>=0&&tile<9&&!visited.has(tile)){
    const ps=ports(tile);if(!ps.includes(entry))break;visited.add(tile);
    const exit=ps.find(p=>p!==entry);
    if(tile===8&&exit===1)return {lit:visited,solved:visited.size===9};
    const row=Math.floor(tile/3),col=tile%3;
    if((exit===0&&row===0)||(exit===1&&col===2)||(exit===2&&row===2)||(exit===3&&col===0))break;
    tile+= [-3,1,3,-1][exit];entry=(exit+2)%4;
  }
  return {lit:visited,solved:false};
}
function tileSvg(i,lit){const ps=ports(i),points=[[50,0],[100,50],[50,100],[0,50]],c=colors[palette];return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M${points[ps[0]].join(' ')} L50 50 L${points[ps[1]].join(' ')}" fill="none" stroke="${lit?c[1]:'#46617b'}" stroke-width="12" stroke-linejoin="round"/><circle cx="50" cy="50" r="7" fill="${lit?c[2]:'#6a8298'}"/></svg>`;}
function reference(){const c=colors[palette];return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><rect width="300" height="300" fill="${c[0]}"/>${Array.from({length:9},(_,i)=>`<svg x="${i%3*100}" y="${Math.floor(i/3)*100}" width="100" height="100">${tileSvg(i,true).replace(/^<svg[^>]*>|<\/svg>$/g,'')}</svg>`).join('')}</svg>`;}
function draw(){const result=circuit();solved=result.solved;$('signal-board').innerHTML=Array.from({length:9},(_,i)=>`<button class="signal-tile ${result.lit.has(i)?'lit':''}" data-tile="${i}" aria-label="Rotate tile ${i+1}" ${paused?'disabled':''}>${tileSvg(i,result.lit.has(i))}</button>`).join('');document.querySelectorAll('[data-tile]').forEach(b=>b.onclick=()=>rotate(Number(b.dataset.tile)));$('signal-status').textContent=solved?`Circuit connected / ${moves} turns. This pattern is yours.`:`${result.lit.size} / 9 tiles lit · ${moves} turns`;$('signal-keepsake').disabled=!solved||paused;$('signal-keepsake').textContent=solved?'Keep this pattern / scarf':'Connect the circuit to unlock your scarf';}
function rotate(i){if(paused||!Number.isInteger(i)||i<0||i>8)return;turns[i]=(turns[i]+1)%4;moves++;draw();}
function reset(){runId=crypto.randomUUID();turns=Array.from({length:9},()=>Math.floor(Math.random()*4));if(turns.every(n=>n===0))turns[0]=1;moves=0;draw();}
function craft(){if(!solved)return;openForge({type:'scarf',title:'Signal Garden / '+palette+' scarf',sourceEventId:runId,design:{turns:[...turns],palette,referenceSvg:reference()},story:[{event:'circuit-connected',moves,tiles:9}],prompt:`Scarf with the exact connected circuit pattern in the reference, ${palette} colors ${colors[palette].join(', ')}. Preserve all nine tiles and their connecting lines.`});}
initForge({gameId:'signal-garden',pause:()=>{paused=true;draw();},resume:()=>{paused=false;draw();},preview:reference});
$('signal-reset').onclick=reset;$('signal-palette').onchange=e=>{palette=e.target.value;draw();};$('signal-keepsake').onclick=craft;
if(document.modelContext?.registerTool){for(const tool of [{name:'read_circuit',description:'Read the circuit puzzle.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({turns,moves,palette,solved})},{name:'rotate_circuit_tile',description:'Rotate a circuit tile clockwise.',inputSchema:{type:'object',properties:{tile:{type:'integer',minimum:0,maximum:8}},required:['tile'],additionalProperties:false},execute:({tile})=>{rotate(tile);return {turns,solved};}}])try{Promise.resolve(document.modelContext.registerTool(tool)).catch(()=>{});}catch{}}
reset();
