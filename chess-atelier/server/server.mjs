// Chess Atelier server: serves the web app and is the only place the Arcade key lives.
// The app sends the finished drawing of a game; this server turns it into an Arcade
// pattern, then into a real product with a price. Two providers share one contract:
//   simulated (default): no Arcade calls, no key needed. The drawing itself comes back as the pattern.
//   live (ATELIER_ARCADE=live): real Arcade patterns and products, using ARCADE_API_KEY from the repo .env.
// Checkout is always simulated here, so nothing can be bought by accident.
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {readFileSync, existsSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join, normalize, extname, sep} from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const WEB = join(here, '..', 'web');
loadEnv(join(here, '..', '..', '.env'));

const PORT = Number(process.env.ATELIER_PORT ?? 8790);
// Loopback by default: anyone who can reach this port could spend Arcade generations in live mode.
const HOST = process.env.ATELIER_HOST ?? '127.0.0.1';
const MODE = process.env.ATELIER_ARCADE === 'live' ? 'live' : 'simulated';
const API = 'https://platform.arcade.ai/v1';
const USER_AGENT = 'chess-atelier/0.1 (arcade hackathon)';
const KEY = process.env.ARCADE_API_KEY ?? '';

if (MODE === 'live' && !KEY.startsWith('arcade_sk_live_')) {
  console.error('Live mode needs ARCADE_API_KEY in the repo root .env file.');
  process.exit(1);
}

// What a game can become. Every choice is square so the drawing fits as is.
// Prices and makers are the real Arcade quotes we got for these options; live mode replaces them with fresh ones.
const OFFERS = [
  {kind: 'scarf', name: 'Silk Scarf', category: 'Scarves', selections: {fabric: 'silk', size: '36x36', hem_finish: 'handrolled_hem'},
    detail: 'Silk twill · 36 × 36 in · hand-rolled hem', price: {amount: '104.00', currency: 'USD'}, maker: 'Odette'},
  {kind: 'pillow', name: 'Linen Pillow', category: 'Decorative Pillows', selections: {fabric: 'linen', size: '18x18', embellishment: 'none', insert: 'microfiber'},
    detail: 'Linen · 18 × 18 in · insert included', price: {amount: '81.35', currency: 'USD'}, maker: 'Odette'},
  {kind: 'pocket-square', name: 'Pocket Square', category: 'Pocket Squares', selections: {fabric: 'silk', size: '16x16', hem_finish: 'handrolled_hem'},
    detail: 'Silk · 16 × 16 in · hand-rolled hem', price: {amount: '98.00', currency: 'USD'}, maker: 'Odette'},
];

// ---------- Simulated Arcade ----------

const sim = {pieces: new Map(), products: new Map()};
const PATTERN_SECONDS = 7, PRODUCT_SECONDS = 4;

const simulated = {
  async createPiece({image}) {
    const pieceId = 'sim-' + randomUUID();
    sim.pieces.set(pieceId, {png: Buffer.from(image, 'base64'), started: Date.now()});
    return {pieceId};
  },
  async getPiece(pieceId) {
    const piece = sim.pieces.get(pieceId);
    if (!piece) throw notFound('No such piece');
    const elapsed = (Date.now() - piece.started) / 1000;
    if (elapsed < PATTERN_SECONDS) return {status: 'running', progress: elapsed / PATTERN_SECONDS};
    return {status: 'succeeded', patternId: pieceId, imageUrl: `/api/sim/${pieceId}.png`};
  },
  async createProduct({patternId, kind}) {
    const offer = OFFERS.find(o => o.kind === kind);
    if (!offer || !sim.pieces.has(patternId)) throw badRequest('Unknown pattern or product');
    await sleep(PRODUCT_SECONDS * 1000);
    return {productId: `sim-product-${kind}-${patternId.slice(4, 12)}`, kind, name: offer.name, detail: offer.detail,
      maker: offer.maker, price: offer.price, images: [`/api/sim/${patternId}.png`], simulated: true};
  },
};

// ---------- Live Arcade ----------

const categoryIds = new Map();

async function arcade(procedure, body = {}, {timeout = 120_000} = {}) {
  const res = await fetch(`${API}/${procedure}`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'User-Agent': USER_AGENT},
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = {message: text.slice(0, 200)}; }
  if (!res.ok) { const err = new Error(data.message ?? `Arcade ${procedure} failed`); err.status = res.status; throw err; }
  return data;
}

async function waitForJob(jobId, {interval = 2500, timeout = 300_000} = {}) {
  const started = Date.now();
  for (;;) {
    const job = await arcade('jobs/get', {jobId});
    if (job.status !== 'running') return job;
    if (Date.now() - started > timeout) throw new Error('Arcade job timed out');
    await sleep(interval);
  }
}

const live = {
  async createPiece({image, colors = [], title}) {
    const bytes = Buffer.from(image, 'base64');
    const id = randomUUID();
    const upload = await arcade('references/createUpload', {requestId: `${id}-upload`, mediaType: 'image/png', byteLength: bytes.length});
    const put = await fetch(upload.uploadUrl, {method: 'PUT', headers: upload.requiredHeaders, body: bytes});
    if (!put.ok) throw new Error(`Reference upload failed (${put.status})`);
    const reference = await arcade('references/create', {requestId: `${id}-reference`, uploadId: upload.uploadId});
    const job = await arcade('patterns/create', {
      requestId: `${id}-pattern`,
      prompt: [
        `A fine-art line drawing titled "${String(title ?? 'A game of chess').slice(0, 80)}": the record of a chess game.`,
        'Keep every curved line, dot and ring exactly where it is in the reference, with the same colors and the same flat paper background.',
        'Crisp ink lines with a subtle hand-drawn quality. Do not add chess pieces, letters, numbers or a checkerboard.',
      ].join(' '),
      referenceIds: [reference.referenceId],
      colors: colors.filter(c => /^#[0-9A-Fa-f]{6}$/.test(c)).slice(0, 10),
    });
    return {pieceId: job.jobId};
  },
  async getPiece(pieceId) {
    const job = await arcade('jobs/get', {jobId: pieceId});
    if (job.status === 'running') return {status: 'running'};
    if (job.status === 'failed' || !job.result?.patternId) return {status: 'failed', message: job.error?.message ?? 'Arcade could not finish this drawing'};
    const pattern = await arcade('patterns/get', {patternId: job.result.patternId});
    return {status: 'succeeded', patternId: pattern.patternId, imageUrl: pattern.imageUrl};
  },
  async createProduct({patternId, kind}) {
    const offer = OFFERS.find(o => o.kind === kind), categoryId = categoryIds.get(kind);
    if (!offer || !categoryId) throw badRequest(`Unknown product ${kind}`);
    const category = await arcade('categories/get', {categoryId, selections: offer.selections});
    if (!category.canManufacture) throw new Error(`${offer.name} can't be made with these options right now`);
    const job = await arcade('products/create', {requestId: `${patternId}-${kind}`, patternId, categoryId, selections: category.selections});
    const done = job.status === 'running' ? await waitForJob(job.jobId) : job;
    if (done.status !== 'succeeded' || !done.result?.productId) throw new Error(done.error?.message ?? 'Arcade could not build this product');
    const product = await arcade('products/get', {productId: done.result.productId});
    return {productId: product.productId, kind, name: offer.name, detail: product.selectionLabel ?? offer.detail,
      maker: product.maker?.name ?? null, price: product.unitPrice, images: (product.images ?? []).map(i => i.url)};
  },
};

async function loadCategories() {
  const {items} = await arcade('categories/list');
  for (const offer of OFFERS) {
    const match = items.find(c => c.name === offer.category && c.world === 'print');
    if (match) categoryIds.set(offer.kind, match.categoryId);
  }
}

const provider = MODE === 'live' ? live : simulated;

// Always simulated: an order confirmation with no charge.
function checkout({productId, name, price}) {
  if (typeof productId !== 'string' || !productId) throw badRequest('productId is required');
  return {simulated: true, orderNumber: `CA-${Math.floor(100000 + Math.random() * 900000)}`, name: name ?? 'Your game', price: price ?? null,
    status: 'Order received (demo, no charge)', estimatedShip: 'Made to order and shipped in about 2 weeks'};
}

// ---------- HTTP ----------

const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json'};

function serveStatic(pathname, res) {
  const rel = normalize(decodeURIComponent(pathname === '/' ? '/index.html' : pathname)).replace(/^([/\\])+/, '');
  const file = join(WEB, rel);
  if (!file.startsWith(WEB + sep) || !existsSync(file) || !statSync(file).isFile()) return false;
  res.writeHead(200, {'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store'});
  res.end(readFileSync(file));
  return true;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const started = Date.now();
  try {
    if (req.method === 'GET' && url.pathname === '/api/config') {
      return send(res, 200, {mode: MODE, products: OFFERS.filter(o => MODE === 'simulated' || categoryIds.has(o.kind))
        .map(({kind, name, detail, price, maker}) => ({kind, name, detail, price, maker}))});
    }
    if (req.method === 'POST' && url.pathname === '/api/pieces') {
      const body = await readJson(req);
      if (typeof body.image !== 'string' || !body.image) throw badRequest('image is required (base64 PNG)');
      if (Buffer.byteLength(body.image, 'base64') > 10 * 1024 * 1024) throw badRequest('image must be under 10 MB');
      return send(res, 200, await provider.createPiece(body));
    }
    const piece = url.pathname.match(/^\/api\/pieces\/([\w-]+)$/);
    if (req.method === 'GET' && piece) return send(res, 200, await provider.getPiece(piece[1]));
    if (req.method === 'POST' && url.pathname === '/api/products') return send(res, 200, await provider.createProduct(await readJson(req)));
    if (req.method === 'POST' && url.pathname === '/api/checkout') return send(res, 200, checkout(await readJson(req)));
    const simImage = url.pathname.match(/^\/api\/sim\/(sim-[\w-]+)\.png$/);
    if (req.method === 'GET' && simImage && sim.pieces.has(simImage[1])) {
      res.writeHead(200, {'Content-Type': 'image/png', 'Cache-Control': 'no-store'});
      return res.end(sim.pieces.get(simImage[1]).png);
    }
    if (req.method === 'GET' && serveStatic(url.pathname, res)) return;
    send(res, 404, {message: 'Not found'});
  } catch (err) {
    send(res, err.status && err.status < 500 ? err.status : 502, {message: err.message});
  } finally {
    if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/sim/')) console.log(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`);
  }
});

function send(res, status, body) {
  if (res.headersSent) return;
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify(body));
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

function badRequest(message) { const err = new Error(message); err.status = 400; return err; }
function notFound(message) { const err = new Error(message); err.status = 404; return err; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

if (MODE === 'live') await loadCategories();
server.listen(PORT, HOST, () => console.log(`Chess Atelier (${MODE} Arcade) on http://${HOST}:${PORT}`));
