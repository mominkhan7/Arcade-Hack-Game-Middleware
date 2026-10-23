// The look of a game: the board (the paper of the artwork), one color per side
// (the pieces and their ink), and the medium that turns movement into marks.

export const BOARDS = [
  {id: 'ivory', name: 'Ivory', hex: '#F3EBDD'},
  {id: 'linen', name: 'Linen', hex: '#E7DCC8'},
  {id: 'sage', name: 'Sage', hex: '#DCE3D2'},
  {id: 'blush', name: 'Blush', hex: '#F3E0DA'},
  {id: 'slate', name: 'Slate', hex: '#4A5866'},
  {id: 'terracotta', name: 'Terracotta', hex: '#B9694F'},
  {id: 'charcoal', name: 'Charcoal', hex: '#24211F'},
  {id: 'midnight', name: 'Midnight', hex: '#0F1626'},
];

/** Piece colors: [white side, black side]. */
export const PIECES = [
  {id: 'terracotta-espresso', name: 'Terracotta & Espresso', white: '#B5583F', black: '#2F241E'},
  {id: 'gold-navy', name: 'Gold & Navy', white: '#D4A63A', black: '#1F3A5F'},
  {id: 'coral-teal', name: 'Coral & Teal', white: '#E0745A', black: '#1F7A72'},
  {id: 'rose-plum', name: 'Rose & Plum', white: '#D9798F', black: '#5B2A47'},
  {id: 'sage-oxblood', name: 'Sage & Oxblood', white: '#7D9C7A', black: '#6A1E22'},
  {id: 'silver-ink', name: 'Silver & Ink', white: '#A8B0B8', black: '#1A1A1A'},
  {id: 'bone-gold', name: 'Bone & Gold', white: '#F2E9DC', black: '#E0B354'},
  {id: 'sky-saffron', name: 'Sky & Saffron', white: '#8FB3E0', black: '#E8A12E'},
];

export const MEDIUMS = [
  {id: 'lines', name: 'Lines', blurb: 'Fine curved lines; knights trace their L'},
  {id: 'brush', name: 'Brush', blurb: 'Calligraphy strokes that swell and lift'},
  {id: 'watercolor', name: 'Watercolor', blurb: 'Soft washes that pool where pieces land'},
  {id: 'constellation', name: 'Constellation', blurb: 'Every square a star, joined by light'},
  {id: 'string', name: 'String art', blurb: 'Taut threads between pins on every square'},
];

export const DEFAULT_STYLE = {board: '#F3EBDD', white: '#B5583F', black: '#2F241E', medium: 'lines'};

const hexOk = h => typeof h === 'string' && /^#[0-9A-Fa-f]{6}$/.test(h);
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const hex = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();

/** Mixes a toward b by t (0 = a, 1 = b). */
export const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
/** Lightens (t > 0) or darkens (t < 0). */
export const shade = (h, t) => mix(h, t > 0 ? '#FFFFFF' : '#000000', Math.abs(t));
export const luminance = h => { const [r, g, b] = rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
export const isDark = h => luminance(h) < 0.45;

/** A complete, validated style (anything missing or malformed falls back to the default). */
export function cleanStyle(s = {}) {
  return {
    board: hexOk(s.board) ? s.board.toUpperCase() : DEFAULT_STYLE.board,
    white: hexOk(s.white) ? s.white.toUpperCase() : DEFAULT_STYLE.white,
    black: hexOk(s.black) ? s.black.toUpperCase() : DEFAULT_STYLE.black,
    medium: MEDIUMS.some(m => m.id === s.medium) ? s.medium : DEFAULT_STYLE.medium,
  };
}

/** The inks a style paints with. Pawns paint in a softer tint of their side's color. */
export function inksOf(style) {
  const {board, white, black} = cleanStyle(style);
  return {paper: board, white, black, whitePawn: mix(white, board, 0.38), blackPawn: mix(black, board, 0.38),
    contrast: isDark(board) ? '#FFFFFF' : '#000000'};
}

export const inkOf = (inks, color, type) => color === 'w' ? (type === 'p' ? inks.whitePawn : inks.white) : (type === 'p' ? inks.blackPawn : inks.black);

/** The colors Arcade should stay within, paper first. */
export const styleColors = style => { const i = inksOf(style); return [i.paper, i.white, i.whitePawn, i.black, i.blackPawn]; };

export const mediumName = id => MEDIUMS.find(m => m.id === id)?.name ?? 'Lines';
