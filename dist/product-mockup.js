import {sigilSvg} from './sigils.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const artworkUrl=svg=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg||'<svg xmlns="http://www.w3.org/2000/svg"/>');
let serial=0;
// Presentation only. Never upload this illustrative scene as the manufacturing reference.
export function productMockup(type,referenceSvg,emblem='sun',pendantStyle='classic'){
  type=type==='woven'?'scarf':type;
  if(!['scarf','pillow','pendant'].includes(type))return `<img alt="Saved artwork" src="${escape(artworkUrl(referenceSvg))}">`;
  const id='product-mask-'+(++serial),asset=new URL(`assets/mockup-${type}.png`,import.meta.url).href;
  let overlay='';
  if(type==='pendant')overlay=`<g opacity=".77" style="mix-blend-mode:multiply">${pendantStyle==='ornate'?'<circle cx="50" cy="60.5" r="15.8" fill="none" stroke="#68440f" stroke-width=".45"/><circle cx="50" cy="60.5" r="14.6" fill="none" stroke="#68440f" stroke-width="1.5" stroke-dasharray=".3 1.8"/>'+Array.from({length:16},(_,i)=>`<path d="M49.3 44.2L50 42.8l.7 1.4L50 45.6Z" transform="rotate(${i*22.5} 50 60.5)" fill="none" stroke="#68440f" stroke-width=".3"/>`).join(''):''}${sigilSvg(emblem,'#68440f','x="38" y="48.5" width="24" height="24"')}</g>`;
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
