import {sigilSvg,sigilPaths} from './sigils.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const artworkUrl=svg=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg||'<svg xmlns="http://www.w3.org/2000/svg"/>');
let serial=0;
// Presentation only. Never upload this illustrative scene as the manufacturing reference.
export function productMockup(type,referenceSvg,emblem='sun',pendantStyle='classic'){
  type=type==='woven'?'scarf':type;
  if(!['scarf','pillow','pendant'].includes(type))return `<img alt="Saved artwork" src="${escape(artworkUrl(referenceSvg))}">`;
  const id='product-mask-'+(++serial),asset=new URL(`assets/mockup-${type}.png`,import.meta.url).href;
  let overlay='';
  if(type==='pendant'){
    const relief=`${id}-relief`,shade=`${id}-shade`;
    const sun=Array.from({length:20},(_,i)=>`<path d="M48.8 53.6Q48.2 49 50 47Q51.8 49 51.2 53.6Z" transform="rotate(${i*18} 50 60.5)"/>`).join('')+'<circle cx="50" cy="60.5" r="7.6"/>';
    const motif=emblem==='sun'?sun:`<g transform="translate(37.5 48) scale(.39)"><path d="${sigilPaths[emblem]||sigilPaths.sun}"/></g>`;
    const halo=pendantStyle==='ornate'?'<circle cx="50" cy="60.5" r="15.4" fill="none" stroke-width=".7"/><circle cx="50" cy="60.5" r="14.4" fill="none" stroke-width="1.4" stroke-dasharray=".4 1.4"/>'+Array.from({length:16},(_,i)=>`<path d="M49.3 44.8Q46.8 42.7 48.3 41.9Q50 41 50 43.7Q50 41 51.7 41.9Q53.2 42.7 50.7 44.8" transform="rotate(${i*22.5} 50 60.5)" fill="none" stroke-width=".65"/>`).join(''):'';
    overlay=`<defs><linearGradient id="${relief}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff0b6"/><stop offset=".3" stop-color="#cf9d41"/><stop offset=".55" stop-color="#f8d777"/><stop offset="1" stop-color="#8d6126"/></linearGradient><filter id="${shade}" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx=".25" dy=".45" stdDeviation=".22" flood-color="#533315" flood-opacity=".85"/></filter></defs><g fill="url(#${relief})" stroke="#9b702f" stroke-width=".28" filter="url(#${shade})" role="img" aria-label="${emblem[0].toUpperCase()+emblem.slice(1)} sigil in sculpted relief">${motif}${halo}</g>`;
  }
  else{
    const shape=type==='scarf'?'<rect x="13.3" y="12.1" width="73.4" height="74.6" rx=".7"/>':'<path d="M12 15 Q28 21 50 20 Q72 21 89 15 Q85 34 85 51 Q83 69 91 86 Q70 83 50 84 Q29 83 9 86 Q17 67 16 51 Q16 32 12 15Z"/>';
    overlay=`<defs><clipPath id="${id}">${shape}</clipPath></defs><g clip-path="url(#${id})" style="mix-blend-mode:multiply"><image href="${escape(artworkUrl(referenceSvg))}" x="${type==='scarf'?13.3:12}" y="${type==='scarf'?12.1:15}" width="${type==='scarf'?73.4:78}" height="${type==='scarf'?74.6:71}" preserveAspectRatio="none" opacity=".94"/></g>`;
  }
  return `<figure class="product-scene"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Illustrative ${type} mockup with your design"><image href="${escape(asset)}" width="100" height="100"/>${overlay}</svg><figcaption>Illustrative mockup · actual product shown before purchase</figcaption></figure>`;
}
export function productPreview(record){
  if(!record.simulated&&record.product?.imageUrl)return `<figure class="product-scene actual-product"><img src="${escape(record.product.imageUrl)}" alt="Actual Arcade product preview"><figcaption>Arcade product preview</figcaption></figure>`;
  return productMockup(record.recipe,record.design?.printArtworkSvg||record.design?.referenceSvg,record.design?.emblem||record.design?.sigil||'sun',record.design?.pendantStyle);
}
