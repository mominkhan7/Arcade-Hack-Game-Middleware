// Arcade commerce API: https://docs.arcade.ai/openapi.json
// Credentials only exist on the server. No mocked prices or paid states.
export class ArcadeError extends Error {
  constructor(message, status = 503) { super(message); this.status = status; }
}
const categoryNames = {scarf: /^scarves$/i, pillow: /^decorative pillows$/i, pendant: /^pendant necklace$/i, rug: /^rugs?$/i, plush: /^plush/i, trophy: /^troph/i};
const secureUrl = value => {const u = new URL(value); if (u.protocol !== 'https:') throw new ArcadeError('Arcade returned an insecure URL.'); return u.href;};
export class ArcadeProvider {
  mode = 'live';
  constructor({apiKey, fetcher = fetch, referenceGenerator} = {}) {
    if (!apiKey) throw new ArcadeError('Live Arcade is not configured.', 503);
    this.apiKey = apiKey; this.fetcher = fetcher; this.referenceGenerator = referenceGenerator;
  }
  async call(endpoint, input) {
    let response;
    try { response = await this.fetcher('https://platform.arcade.ai/v1' + endpoint, {
      method: 'POST', headers: {Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json', 'User-Agent': 'NexusKeepsakes/1.0'},
      body: JSON.stringify(input), signal: AbortSignal.timeout(25000), redirect: 'error',
    }); } catch { throw new ArcadeError('Arcade is temporarily unreachable. Your design is saved; retry to resume.'); }
    if (!response.ok) {
      // Never return upstream bodies, signed URLs, or credentials in errors.
      throw new ArcadeError(response.status === 401 ? 'Arcade authentication failed.' : response.status === 429 ? 'Arcade is busy. Try again shortly.' : `Arcade could not complete this step (HTTP ${response.status}).`, response.status === 404 ? 404 : [429,500,502,503,504].includes(response.status) ? 503 : response.status === 401 ? 502 : 422);
    }
    return response.json();
  }
  async catalog() { return this.call('/categories/list', {}); }
  async initialize(type, input) {
    const {items} = await this.catalog();
    const category = items.find(c => categoryNames[type]?.test(c.name));
    if (!category) throw new ArcadeError('This keepsake format is not in Arcade’s live catalog. Try a scarf, pillow, or pendant.', 422);
    const details = await this.call('/categories/get', {categoryId: category.categoryId, selections: {}});
    if (!details.canManufacture) throw new ArcadeError('This category has no manufacturable default right now.', 422);
    return {type, token: crypto.randomUUID(), title: input.title, prompt: input.prompt, quantity: 1, revision: 0, attempt: 0,
      phase: 'draft', selections: details.selections, world: category.world, categoryId: category.categoryId,
      item: {name: category.name, category: category.categoryId, options: this.options(details)}, trace: [], order: null};
  }
  options(details) { return Object.fromEntries(details.options.map(o => [o.key, o.values.filter(v => v.available).map(v => v.value)])); }
  async select(record, selections, quantity) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) throw new ArcadeError('Choose 1 to 5 items.', 400);
    const details = await this.call('/categories/get', {categoryId: record.categoryId, selections});
    if (!details.canManufacture) throw new ArcadeError('These options cannot be manufactured together.', 422);
    record.item.options = this.options(details);
    return details.selections;
  }
  requestId(record, stage) { return `nexus-${record.id.slice(3, 51)}-${record.revision}-${record.attempt || 0}-${stage}`; }
  async reference(record) {
    if (record.referenceId) return record.referenceId;
    // An app may inject its own model; it must return a PNG data URL.
    // The default is the actual rasterized game artwork, with no added design input.
    const png = this.referenceGenerator ? await this.referenceGenerator(structuredClone(record.design), record.prompt) : record.design.referencePng;
    if (typeof png !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(png)) throw new ArcadeError('A PNG of your game design is required. Reopen the keepsake from the game.', 422);
    const bytes = Uint8Array.from(atob(png.split(',')[1]), c => c.charCodeAt(0));
    if (bytes.length < 8 || bytes.length > 1048576 || bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71) throw new ArcadeError('Invalid design image.', 422);
    const upload = await this.call('/references/createUpload', {requestId: this.requestId(record, 'upload'), mediaType: 'image/png', byteLength: bytes.length});
    const result = await this.fetcher(secureUrl(upload.uploadUrl), {method: 'PUT', headers: upload.requiredHeaders, body: bytes, signal: AbortSignal.timeout(25000), redirect: 'error'});
    if (!result.ok) throw new ArcadeError('Design upload failed. Retry to resume.');
    const reference = await this.call('/references/create', {requestId: this.requestId(record, 'reference'), uploadId: upload.uploadId});
    record.referenceId = reference.referenceId;
    return record.referenceId;
  }
  async start(record, now) {
    if (record.phase === 'failed') record.attempt = (record.attempt || 0) + 1;
    let prompt = record.prompt;
    if (record.world === 'jewelry') {
      const emblem = record.design.emblem || 'sun';
      prompt = `A pendant necklace inspired by an earned ${emblem} relic. ${prompt} Engraved ${emblem} emblem on a small round coin pendant. ${Object.entries(record.selections).map(([k,v])=>`${k}: ${v}`).join(', ')}.`.slice(0, 1000);
    }
    const input = {requestId: this.requestId(record, 'pattern'), prompt, ...(record.world === 'jewelry' ? {categoryId: record.categoryId} : {referenceIds: [await this.reference(record)]})};
    record.job = await this.call('/patterns/create', input);
    record.phase = 'pattern'; record.error = null; record.generation = {startedAt: now};
    record.trace.push({endpoint: '/patterns/create', jobId: record.job.jobId, simulated: false});
  }
  async reconcile(record, now) {
    if (['checkout','order'].includes(record.phase)) {
      try {
        const order = await this.call('/orders/get', record.order ? {orderId: record.order.orderId} : {checkoutId: record.checkout.id});
        if (!order.lines.some(l => l.productId === record.productId && l.quantity === record.quantity)) throw new ArcadeError('Order did not match this keepsake.');
        record.order = order; record.phase = 'order'; record.attribution = {gameId: record.gameId, sourceEventId: record.sourceEventId, settlement: 'unconfigured'};
        return true;
      } catch (error) { if (error.status === 404 && record.phase === 'checkout') return false; throw error; }
    }
    if (!['pattern', 'product'].includes(record.phase)) return false;
    record.job = await this.call('/jobs/get', {jobId: record.job.jobId});
    if (record.job.status === 'failed') {
      record.phase = 'failed'; record.error = 'Arcade could not generate this design. Your keepsake is saved; try another generation.'; return true;
    }
    if (record.job.status !== 'succeeded') return false;
    if (record.phase === 'pattern') {
      if (!record.job.result?.patternId) throw new ArcadeError('Arcade did not return a pattern.');
      record.patternId = record.job.result.patternId;
      if (record.world === 'jewelry') {
        if (!record.job.result.productId) throw new ArcadeError('Arcade did not return the jewelry product.');
        record.productId = record.job.result.productId;
      } else {
        record.job = await this.call('/products/create', {requestId: this.requestId(record, 'product'), patternId: record.patternId, categoryId: record.categoryId, selections: record.selections, fit: {mode: 'fill'}});
        record.phase = 'product'; return true;
      }
    } else record.productId = record.job.result?.productId;
    if (!record.productId) throw new ArcadeError('Arcade did not return a product.');
    await this.quote(record, now);
    record.phase = record.quote ? 'quote' : 'product';
    return true;
  }
  async quote(record, now) {
    record.product = await this.call('/products/get', {productId: record.productId, quantity: record.quantity});
    record.selections = record.product.selections;
    const money = record.product.unitPrice;
    if (!money) { record.quote = null; return; }
    if (!/^\d+(\.\d{1,2})?$/.test(money.amount)) throw new ArcadeError('Arcade returned an invalid price.');
    const [whole, fraction = ''] = money.amount.split('.');
    const cents = (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))) * BigInt(record.quantity);
    record.quote = {id: this.requestId(record, 'quote') + '-' + now, designRevision: record.revision, expiresAt: now + 15 * 60000,
      subtotal: {amount: `${cents / 100n}.${String(cents % 100n).padStart(2,'0')}`, currency: money.currency}, simulated: false};
  }
  async checkout(record) {
    const result = await this.call('/checkouts/create', {requestId: this.requestId(record, `checkout-${record.quantity}`), lines: [{productId: record.productId, quantity: record.quantity}], dropShip: true});
    record.checkout = {id: result.checkoutId, quoteId: record.quote.id, url: secureUrl(result.checkoutUrl), simulated: false};
    record.phase = 'checkout';
  }
}
