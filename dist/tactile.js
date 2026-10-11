// Shared touch feedback. Payment and game state remain in their existing owners.
export function feedback(kind='selection') {
  window.webkit?.messageHandlers?.nexusHaptic?.postMessage(kind);
}
let lastFeedback=0;
document.addEventListener('pointerdown',event=>{
  const control=event.target.closest('button,select,summary,[role="button"]');
  if(!control||control.disabled)return;
  const now=performance.now();if(now-lastFeedback>70){feedback();lastFeedback=now;}
  control.classList.add('touch-down');
  const release=()=>{control.classList.remove('touch-down');window.removeEventListener('pointerup',release);window.removeEventListener('pointercancel',release);window.removeEventListener('blur',release);};
  window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);window.addEventListener('blur',release);
},{passive:true});
// Animate opened sheets, including sheets injected by the shared commerce SDK.
let knownOpen=new WeakSet();
const observer=new MutationObserver(()=>{
  for(const dialog of document.querySelectorAll('dialog[open]')) {
    if(knownOpen.has(dialog))continue;knownOpen.add(dialog);
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)dialog.animate([{opacity:0},{opacity:1}],{duration:320,easing:'cubic-bezier(.2,.85,.25,1)'});
    const forget=()=>knownOpen.delete(dialog);dialog.addEventListener('close',forget,{once:true});
  }
});observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});

addEventListener('nexus-game-menu',event=>{if(event.detail==='keepsakes'){window.dispatchEvent(new Event('nexus-open-collection'));return;}if(['wardrobe','collection'].includes(event.detail))document.getElementById(event.detail)?.click();});
