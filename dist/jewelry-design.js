const motifs={
 sun:'An asymmetric solar crown: sculpted flame-shaped rays surround a hammered convex heart, with deeply carved sun channels and a molten, hand-forged surface.',
 moon:'A sculpted crescent embraces an open constellation. Pierced star windows, crater-like stippling, softly beveled lunar edges and tiny celestial relief details.',
 mountain:'Three faceted peaks rise in layered relief. Chiseled rock strata, deep negative-space valleys, engraved topographic contours and contrasting polished ridgelines.',
 ocean:'A curling wave wraps around an open spiral. Flowing shell-like ridges, deeply incised tidal channels, frosted sea-spray texture and polished curling crests.'
};
export function jewelryPrompt(emblem='sun',style='classic'){
 const motif=motifs[emblem]||motifs.sun;
 const evolution=style==='ornate'?'Collector evolution: a layered openwork filigree halo, braided bezel, miniature scrollwork, beaded granulation and a carved ornamental bail. Preserve the original motif; make it visibly more elaborate.':'First relic: bold sculptural silhouette, one intricate focal motif, finely finished edges and a small integrated bail.';
 return `A wearable sculptural ${emblem} talisman pendant with the character of a museum artifact and contemporary artisan jewelry. ${motif} ${evolution} Deep bas-relief, tactile tooling, recessed shadows and burnished highlights; balanced dimensional metalwork. The motif shapes the object itself, rather than an icon printed on a flat circle. Comfortable wearable scale, smooth back, connected castable forms and secure chain loop. Use only the selected catalog material; no invented gems, enamel, plated finish or unsupported metal. No text or logos.`;
}
