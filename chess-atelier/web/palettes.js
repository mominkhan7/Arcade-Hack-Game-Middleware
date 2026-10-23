// Ink sets for the drawing. Each names the paper and the four inks the pieces draw with.
export const PALETTES = [
  {id: 'atelier', name: 'Atelier', paper: '#EFE4CF', white: '#A65A44', whitePawn: '#C9A45C', black: '#3A2A22', blackPawn: '#7D8C6E'},
  {id: 'harbor', name: 'Harbor', paper: '#F4EFE6', white: '#C8553D', whitePawn: '#E9C46A', black: '#1F3A5F', blackPawn: '#2A9D8F'},
  {id: 'lapis', name: 'Lapis & Gold', paper: '#F3EEE2', white: '#D4A63A', whitePawn: '#8FB3E0', black: '#1C3F8C', blackPawn: '#14213D'},
  {id: 'oxblood', name: 'Oxblood', paper: '#F2E8DF', white: '#A3442D', whitePawn: '#9C8A78', black: '#5E1A1D', blackPawn: '#2E2A28'},
  {id: 'sakura', name: 'Sakura', paper: '#FBF2F2', white: '#F2B8C6', whitePawn: '#7E9A64', black: '#C2456A', blackPawn: '#5B2A47'},
  {id: 'verdigris', name: 'Verdigris', paper: '#EEF1EA', white: '#B5653A', whitePawn: '#A9D3C2', black: '#4E9A8A', blackPawn: '#7A5A2E'},
  {id: 'noir', name: 'Noir', paper: '#ECEAE6', white: '#8E8E8E', whitePawn: '#C9C7C3', black: '#1A1A1A', blackPawn: '#4A4A4A'},
  {id: 'midnight', name: 'Midnight', paper: '#0F1626', white: '#F2E9DC', whitePawn: '#3A6EA5', black: '#E0B354', blackPawn: '#D9643A'},
];

export const paletteById = id => PALETTES.find(p => p.id === id) || PALETTES[0];

/** The ink a piece draws with. */
export const inkOf = (palette, color, type) =>
  color === 'w' ? (type === 'p' ? palette.whitePawn : palette.white) : (type === 'p' ? palette.blackPawn : palette.black);

/** The colors Arcade should stay within, paper first. */
export const paletteColors = p => [p.paper, p.white, p.whitePawn, p.black, p.blackPawn];

/** True for dark paper, so the grid and frame can adapt. */
export const isDark = p => {
  const n = parseInt(p.paper.slice(1), 16);
  return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) < 110;
};
