// Preserve the game’s own design as a real uploadable PNG; no prompt entry.
export async function rasterizeDesign(svg) {
  const url = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
  try {
    const image = new Image();
    await new Promise((resolve,reject) => {image.onload=resolve; image.onerror=()=>reject(new Error('Your design could not be prepared.')); image.src=url;});
    const ratio = image.naturalWidth / image.naturalHeight || 1;
    const canvas = document.createElement('canvas');
    canvas.width = ratio >= 1 ? 768 : Math.round(768 * ratio);
    canvas.height = ratio >= 1 ? Math.round(768 / ratio) : 768;
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/png');
  } finally {URL.revokeObjectURL(url);}
}
