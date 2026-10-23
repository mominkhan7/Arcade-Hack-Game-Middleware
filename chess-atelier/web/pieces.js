// Original vector chessmen. Consistent across WebKit, desktop, and exported previews.
const heads={
 p:'<circle cx="40" cy="21" r="10"/><path d="M29 34h22l-4 7H33z"/>',
 r:'<path d="M22 9h8v8h7V9h7v8h7V9h8v18l-8 6H30l-8-6z"/><path d="M30 33h20v10H30z"/>',
 n:'<path d="M26 44l4-15-10-3 13-13 10-7 2 10 10 7 4 18-8 8H28z"/><path d="M31 23l-8 7 8 4 10-7-5 13" fill="none"/><circle cx="41" cy="21" r="1.8" fill="currentColor" stroke="none"/>',
 b:'<path d="M40 7c-8 7-16 15-16 23 0 9 7 13 16 13s16-4 16-13c0-8-8-16-16-23z"/><path d="M35 17l9 13" stroke-width="3" fill="none"/>',
 q:'<path d="M22 19l8 10 4-15 6 14 6-14 4 15 8-10-6 23H28z"/><circle cx="21" cy="15" r="3"/><circle cx="34" cy="10" r="3"/><circle cx="46" cy="10" r="3"/><circle cx="59" cy="15" r="3"/><path d="M28 43h24v6H28z"/>',
 k:'<path d="M37 5h6v8h8v6h-8v9h-6v-9h-8v-6h8z"/><path d="M25 33q0-12 15-12t15 12l-6 12H31z"/><path d="M29 45h22v5H29z"/>'
};
export function pieceSvg(type,color,key='piece') {
  const id='cp-'+color+'-'+key,light=color==='w',stroke=light?'#8e7559':'#170f0d',base=light?'#d7bf91':'#34251e';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" x2=".8" y1="0" y2="1"><stop stop-color="${light?'#fff5dd':'#72513b'}"/><stop offset=".6" stop-color="${light?'#ecdbb5':'#3b291f'}"/><stop offset="1" stop-color="${base}"/></linearGradient></defs><ellipse cx="40" cy="72" rx="24" ry="4" fill="#271c1440"/><g fill="url(#${id})" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round" color="${stroke}">${heads[type]||heads.p}<path d="M32 42h16l-3 7 5 12H30l5-12z"/><path d="M25 60h30l4 8H21z"/><rect x="20" y="67" width="40" height="5" rx="2"/></g><path d="M27 64h25" stroke="${light?'#fff3d7':'#a57650'}" stroke-width="1" opacity=".6"/></svg>`;
}
