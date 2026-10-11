// Ink & Water server: the only place the Arcade API key lives.
// The app sends a finished marbled canvas; this server turns it into an
// Arcade pattern, then into real products. Checkout is simulated for the demo.
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
loadEnv(join(here, '..', '..', '.env'));

const PORT = Number(process.env.INK_PORT ?? 8787);
const API = 'https://platform.arcade.ai/v1';
const USER_AGENT = 'ink-and-water/0.1 (arcade hackathon)';
const KEY = process.env.ARCADE_API_KEY ?? '';

if (!KEY.startsWith('arcade_sk_live_')) {
  console.error('ARCADE_API_KEY is missing or is not an Arcade key. Put it in the repo root .env file.');
  process.exit(1);
}

// The marbling styles the app offers, by Arcade model id.
const STYLES = {
  'marbled-paper': 'Archival Hand Marbled',
  'nonpareil-hand-marbled': 'Nonpareil Hand Marbled',
};

// Products the app offers. Category ids are looked up by name at startup,
// as Arcade asks, and every choice here is square so the pattern fits as is.
const OFFERS = [
  {kind: 'scarf', name: 'Silk Scarf', category: 'Scarves', selections: {fabric: 'silk', size: '36x36', hem_finish: 'handrolled_hem'}},
  {kind: 'pocket-square', name: 'Pocket Square', category: 'Pocket Squares', selections: {fabric: 'silk', size: '16x16', hem_finish: 'handrolled_hem'}},
  {kind: 'pillow', name: 'Linen Pillow', category: 'Decorative Pillows', selections: {fabric: 'linen', size: '18x18', embellishment: 'none', insert: 'microfiber'}},
];

const categoryIds = new Map();

async function arcade(procedure, body = {}) {
  const res = await fetch(`${API}/${procedure}`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'User-Agent': USER_AGENT},
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = {message: text.slice(0, 200)}; }
  if (!res.ok) {
    const err = new Error(data.message ?? `Arcade ${procedure} failed`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForJob(jobId, {interval = 3000, timeout = 600_000} = {}) {
  const started = Date.now();
  for (;;) {
    const job = await arcade('jobs/get', {jobId});
    if (job.status !== 'running') return job;
    if (Date.now() - started > timeout) throw new Error('Arcade job timed out');
    await sleep(interval);
  }
}

async function loadCategories() {
  const {items} = await arcade('categories/list');
  for (const offer of OFFERS) {
    const match = items.find(c => c.name === offer.category && c.world === 'print');
    if (match) categoryIds.set(offer.kind, match.categoryId);
    else console.warn(`No Arcade category named ${offer.category}; ${offer.name} is hidden.`);
  }
}

// Turns the player's canvas into an Arcade reference, then starts a pattern job.
async function createPiece({image, palette = [], styleId, title, requestId}) {
  if (typeof image !== 'string' || !image) throw badRequest('image is required (base64 PNG)');
  if (!STYLES[styleId]) throw badRequest(`styleId must be one of ${Object.keys(STYLES).join(', ')}`);
  const bytes = Buffer.from(image, 'base64');
  if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024) throw badRequest('image must be under 10 MB');
  const id = requestId ?? randomUUID();

  const upload = await arcade('references/createUpload', {requestId: `${id}-upload`, mediaType: 'image/png', byteLength: bytes.length});
  const put = await fetch(upload.uploadUrl, {method: 'PUT', headers: upload.requiredHeaders, body: bytes});
  if (!put.ok) throw new Error(`Reference upload failed (${put.status})`);
  const reference = await arcade('references/create', {requestId: `${id}-reference`, uploadId: upload.uploadId});

  const colors = palette.filter(c => /^#[0-9A-Fa-f]{6}$/.test(c)).slice(0, 10);
  const job = await arcade('patterns/create', {
    requestId: `${id}-pattern`,
    prompt: [
      `Traditional ${STYLES[styleId].toLowerCase()} paper titled "${String(title ?? 'Untitled').slice(0, 80)}".`,
      'Keep the composition, ink placement and the direction of every comb and swirl stroke from the reference.',
      'Render it as real pigment floating on water and lifted onto paper: soft ink edges, fine veining, subtle paper grain.',
    ].join(' '),
    referenceIds: [reference.referenceId],
    modelId: styleId,
    colors,
  });
  return {pieceId: job.jobId};
}

async function getPiece(pieceId) {
  const job = await arcade('jobs/get', {jobId: pieceId});
  if (job.status === 'running') return {status: 'running'};
  if (job.status === 'failed' || !job.result?.patternId) {
    return {status: 'failed', message: job.error?.message ?? 'Arcade could not finish this piece'};
  }
  const pattern = await arcade('patterns/get', {patternId: job.result.patternId});
  return {status: 'succeeded', patternId: pattern.patternId, imageUrl: pattern.imageUrl, width: pattern.width, height: pattern.height};
}

// Builds a real Arcade product from a finished pattern and returns its price and photos.
async function createProduct({patternId, kind, requestId}) {
  const offer = OFFERS.find(o => o.kind === kind);
  const categoryId = categoryIds.get(kind);
  if (!offer || !categoryId) throw badRequest(`Unknown product kind ${kind}`);
  if (typeof patternId !== 'string' || !patternId) throw badRequest('patternId is required');

  const category = await arcade('categories/get', {categoryId, selections: offer.selections});
  if (!category.canManufacture) throw new Error(`${offer.name} can't be made with these options right now`);
  const job = await arcade('products/create', {
    requestId: requestId ?? `${patternId}-${kind}`,
    patternId,
    categoryId,
    selections: category.selections,
  });
  const done = job.status === 'running' ? await waitForJob(job.jobId, {interval: 2000, timeout: 180_000}) : job;
  if (done.status !== 'succeeded' || !done.result?.productId) throw new Error(done.error?.message ?? 'Arcade could not build this product');
  return describeProduct(await arcade('products/get', {productId: done.result.productId}), offer);
}

function describeProduct(product, offer) {
  return {
    productId: product.productId,
    kind: offer.kind,
    name: offer.name,
    title: product.title,
    detail: product.selectionLabel,
    maker: product.maker?.name ?? null,
    price: product.unitPrice,
    images: (product.images ?? []).map(i => i.url),
    description: product.description ?? '',
  };
}

// Demo only: never calls Arcade's checkout, so nothing can be bought on stage.
function simulateCheckout({productId, name, price}) {
  if (typeof productId !== 'string' || !productId) throw badRequest('productId is required');
  return {
    simulated: true,
    orderNumber: `IW-${Math.floor(100000 + Math.random() * 900000)}`,
    productId,
    name: name ?? 'Your piece',
    price: price ?? null,
    status: 'Order received (demo, no charge)',
    estimatedShip: 'Made by hand and shipped in about 2 weeks',
  };
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16 * 1024 * 1024) throw badRequest('Request too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw badRequest('Body must be JSON'); }
}

function send(res, status, body) {
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const started = Date.now();
  try {
    // The web version of the app, served from here so it shares the API's origin.
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'});
      return res.end(readFileSync(join(here, '..', 'web', 'index.html')));
    }
    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, {ok: true, styles: STYLES, products: OFFERS.filter(o => categoryIds.has(o.kind)).map(o => ({kind: o.kind, name: o.name}))});
    }
    if (req.method === 'POST' && url.pathname === '/api/pieces') {
      return send(res, 200, await createPiece(await readJson(req)));
    }
    const piece = url.pathname.match(/^\/api\/pieces\/([\w-]+)$/);
    if (req.method === 'GET' && piece) {
      return send(res, 200, await getPiece(piece[1]));
    }
    if (req.method === 'POST' && url.pathname === '/api/products') {
      return send(res, 200, await createProduct(await readJson(req)));
    }
    if (req.method === 'POST' && url.pathname === '/api/checkout') {
      return send(res, 200, simulateCheckout(await readJson(req)));
    }
    send(res, 404, {message: 'Not found'});
  } catch (err) {
    const status = err.status && err.status < 500 ? err.status : 502;
    send(res, status, {message: err.message});
  } finally {
    console.log(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`);
  }
});

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

await loadCategories();
// Loopback by default. Set INK_HOST=0.0.0.0 only to test on a real phone on a
// network you trust: anyone who can reach this port can spend Arcade generations.
const HOST = process.env.INK_HOST ?? '127.0.0.1';
server.listen(PORT, HOST, () => {
  console.log(`Ink & Water server on http://${HOST}:${PORT}`);
});
