// An original deterministic flow-field renderer. The flight supplies gesture, hue and seed.
export function journeyArt(design) {
  const route=design.trail||[];let seed=271828;
  for(const p of route)seed=(Math.imul(seed^Math.round(p.x*71+p.z*97+(p.hue||.5)*1000),1664525)+1013904223)>>>0;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const xs=route.map(p=>p.x),zs=route.map(p=>p.z),minX=Math.min(...xs,0),maxX=Math.max(...xs,1),minZ=Math.min(...zs,0),maxZ=Math.max(...zs,1),scale=Math.min(690/(maxX-minX||1),690/(maxZ-minZ||1));
  const points=route.map(p=>({x:500+(p.x-(minX+maxX)/2)*scale,y:500+(p.z-(minZ+maxZ)/2)*scale,hue:p.hue??.52}));
  if(points.length<2)points.push({x:450,y:500,hue:.52},{x:550,y:500,hue:.77});
  const phase=rand()*6.28,twist=rand()*4+2,parts=[],defs=[];
  const paper=design.palette==='dawn'?'#091c24':design.palette==='lagoon'?'#091525':'#151329';
  for(let n=0;n<48;n++) {
    const index=Math.floor(rand()*(points.length-1)),p=points[index],next=points[index+1];let x=p.x+(rand()-.5)*230,y=p.y+(rand()-.5)*230;
    const tangent=Math.atan2(next.y-p.y,next.x-p.x),offset=(rand()-.5)*2,hue=(p.hue+(rand()-.5)*.09+1)%1,width=16+rand()*90,line=[];
    let direction=tangent+offset;
    for(let k=0;k<40;k++) {
      line.push([Number(x.toFixed(1)),Number(y.toFixed(1))]);
      const curl=Math.sin(x*.005+phase)*Math.cos(y*.006+phase*.7)*twist+Math.sin((x+y)*.002+phase)+tangent*.23;
      direction+=Math.atan2(Math.sin(curl-direction),Math.cos(curl-direction))*.15;
      x+=Math.cos(direction)*(9+rand()*3);y+=Math.sin(direction)*(9+rand()*3);
    }
    const path=line.map(([x,y],i)=>(i?'L':'M')+x+' '+y).join(' '),id='ink'+n;
    const color=(h,l)=>`hsl(${Math.round(((h+1)%1)*360)},${56+Math.round(rand()*18)}%,${l}%)`;
    defs.push(`<path id="line${n}" d="${path}"/><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${color(hue,45)}"/><stop offset=".55" stop-color="${color(hue+.13,67)}"/><stop offset="1" stop-color="${color(hue-.09,48)}"/></linearGradient>`);
    parts.push(`<use href="#line${n}" fill="none" stroke="url(#${id})" stroke-width="${width.toFixed(1)}" opacity="${(.45+rand()*.4).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`);
    if(n%2===0)parts.push(`<use href="#line${n}" fill="none" stroke="${color(hue,82)}" stroke-width=".65" opacity=".42"/>`);
  }
  const grains=[];for(let i=0;i<90;i++)grains.push(`<circle cx="${(60+rand()*880).toFixed(1)}" cy="${(60+rand()*880).toFixed(1)}" r="${(.25+rand()*.45).toFixed(2)}" fill="#d6e8ec" opacity=".09"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000"><title>Nocturne: a flight through the Lumen Garden</title><defs><clipPath id="paper"><rect x="45" y="45" width="910" height="910"/></clipPath>${defs.join('')}<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="3" stitchTiles="stitch" seed="17"/><feColorMatrix type="saturate" values="0"/></filter></defs><rect width="1000" height="1000" fill="${paper}"/><g clip-path="url(#paper)">${parts.join('')}${grains.join('')}<rect x="45" y="45" width="910" height="910" filter="url(#grain)" opacity=".07" style="mix-blend-mode:soft-light"/></g></svg>`;
}
