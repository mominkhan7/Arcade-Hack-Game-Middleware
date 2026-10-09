import {recipes, games, validateOptions} from './recipes.js';
import {DemoProvider} from './providers/demo.js';

export class NexusError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const copy = value => structuredClone(value);
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
export class NexusService {
  constructor(store, {provider = new DemoProvider(), now = Date.now} = {}) {
    this.store = store; this.provider = provider; this.now = now;
  }
  async create(owner, gameId, input) {
    if (!games.has(gameId)) throw new NexusError('Unknown game.');
    const recipe = Object.hasOwn(recipes, input.recipe) ? recipes[input.recipe] : null;
    if (!recipe) throw new NexusError('Unknown keepsake recipe.');
    if (typeof input.sourceEventId !== 'string' || !input.sourceEventId.length || input.sourceEventId.length > 160) throw new NexusError('A source event is required.');
    if (!input.design || typeof input.design !== 'object' || Array.isArray(input.design)) throw new NexusError('A design snapshot is required.');
    if (JSON.stringify(input.design).length > 90000) throw new NexusError('Design reference is too large.');
    if (typeof input.design.referenceSvg !== 'string' || !input.design.referenceSvg.startsWith('<svg')) throw new NexusError('A design reference is required.');
    if (typeof input.title !== 'string' || input.title.length > 160 || typeof input.prompt !== 'string' || input.prompt.length > 1000) throw new NexusError('Provide a short title and design brief.');
    const design = copy(input.design), fingerprint = await digest(design);
    const id = 'ks_' + await digest([owner, gameId, input.sourceEventId, recipe.id, fingerprint]);
    const session = await this.provider.initialize(recipe.type, input);
    const record = {...session, id, owner, gameId, recipe: recipe.id, recipeVersion: recipe.version,
      sourceEventId: input.sourceEventId, design, fingerprint, story: copy(input.story || []),
      simulated: true, availability: recipe.availability, version: 0, createdAt: this.now(), updatedAt: this.now(),
      product: null, quote: null, checkout: null, error: null};
    // Unique IDs prevent repeat unlocks / repeated network submissions duplicating records.
    return this.store.insert(record);
  }
  async get(owner, gameId, id) {
    const record = await this.store.get(id);
    if (!record || record.owner !== owner || record.gameId !== gameId) throw new NexusError('Keepsake not found.', 404);
    if (await this.provider.reconcile(record, this.now())) return this.save(record);
    return record;
  }
  async list(owner, gameId) {
    return this.store.list(owner, gameId);
  }
  async save(record) {
    const version = record.version; record.version++; record.updatedAt = this.now();
    if (!await this.store.update(record, version)) throw new NexusError('Keepsake changed. Refresh and try again.', 409);
    return record;
  }
  async act(owner, gameId, id, action, input = {}) {
    const record = await this.get(owner, gameId, id);
    const now = this.now();
    if (action === 'generate') {
      if (['pattern', 'product', 'quote', 'checkout', 'order'].includes(record.phase)) return record;
      await this.provider.start(record, now);
    } else if (action === 'options') {
      if (['pattern', 'product', 'order'].includes(record.phase)) throw new NexusError('Options are locked for this keepsake.');
      try { validateOptions(recipes[record.recipe], input.selections, input.quantity); }
      catch (error) { throw new NexusError(error.message); }
      if (canonical(record.selections) === canonical(input.selections) && record.quantity === input.quantity) return record;
      const changedDesignOptions = canonical(record.selections) !== canonical(input.selections);
      record.selections = copy(input.selections); record.quantity = input.quantity;
      record.checkout = null;
      if (changedDesignOptions) {
        record.revision++; record.productId = 'demo_product_' + record.token + '_' + record.revision;
        record.patternId = 'demo_pattern_' + record.token + '_' + record.revision;
        record.product = null; record.quote = null; record.phase = 'draft';
      } else if (record.product) { record.phase = 'quote'; await this.provider.quote(record, now); }
    } else if (action === 'checkout') {
      if (record.phase === 'order') return record;
      if (!record.quote || record.quote.designRevision !== record.revision || record.quote.expiresAt <= now) throw new NexusError('Quote expired. Refresh the quote before checkout.', 409);
      if (record.phase === 'checkout') return record;
      if (record.phase !== 'quote') throw new NexusError('Generate a product before checkout.');
      await this.provider.checkout(record);
    } else if (action === 'refresh-quote') {
      if (!record.product || record.phase === 'order') throw new NexusError('Generate a product first.');
      record.phase = 'quote'; record.checkout = null; await this.provider.quote(record, now);
    } else if (action === 'pay-demo') {
      if (record.phase === 'order') return record;
      if (this.provider.mode !== 'simulated' || record.phase !== 'checkout') throw new NexusError('Demo checkout is required.');
      if (record.quote.expiresAt <= now) throw new NexusError('Quote expired. Refresh the quote before payment.', 409);
      await this.provider.pay(record);
      record.attribution = {gameId, sourceEventId: record.sourceEventId, settlement: 'unconfigured'};
    } else if (action === 'advance-demo') {
      if (this.provider.mode !== 'simulated' || !record.order) throw new NexusError('A demo order is required.');
      // Expected status makes a retried fast-forward request idempotent.
      if (input.expectedStatus !== record.order.status) return record;
      await this.provider.advance(record);
    } else throw new NexusError('Unknown keepsake action.');
    return this.save(record);
  }
}
