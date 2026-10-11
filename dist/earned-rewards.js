// Earned designs stay purchasable after the next chapter, with the original artwork.
export function createEarnedRewards(storage, key='craftkit-relic-pack-v1') {
  let records=[];
  try {const saved=JSON.parse(storage?.getItem(key)||'[]');if(Array.isArray(saved))records=saved.filter(r=>r?.sourceEventId&&r?.offering&&r?.design?.referenceSvg&&r?.title&&r?.type);} catch {}
  return {
    list:()=>structuredClone(records),
    add(config){
      if(!config?.sourceEventId||!config.offering||!config.design?.referenceSvg)throw Error('An earned reward needs its source and original artwork.');
      if(!records.some(r=>r.sourceEventId===config.sourceEventId)){
        records.unshift(structuredClone(config));
        try {storage?.setItem(key,JSON.stringify(records));} catch {}
      }
      return structuredClone(records.find(r=>r.sourceEventId===config.sourceEventId));
    }
  };
}
