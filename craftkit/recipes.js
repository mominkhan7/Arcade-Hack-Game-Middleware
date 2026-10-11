import {products} from './providers/demo-model.js';

// Recipes constrain physical output. Catalog values remain fixtures until Arcade access.
export const recipes = Object.fromEntries(Object.entries(products).map(([type, item]) => [type, {
  id: type, version: 1, type, item,
  availability: ['pendant', 'plush', 'trophy'].includes(type) ? 'unverified' : 'demo',
}]));
export const games = new Set(['relic-island', 'signal-garden', 'pattern-garden', 'chess-atelier']);
export function validateOptions(recipe, selections, quantity) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) throw new Error('Choose 1 to 5 items.');
  if (!selections || Object.keys(selections).length !== Object.keys(recipe.item.options).length) throw new Error('Choose all product options.');
  for (const [key, value] of Object.entries(selections)) {
    if (!recipe.item.options[key]?.includes(value)) throw new Error('Unsupported product option.');
  }
}
