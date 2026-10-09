import {NexusService, NexusError} from './service.js';
import {recipes, games} from './recipes.js';
const json = (data, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'private, no-store'}});
export async function handleNexus(request, store, owner) {
  try {
    if (!owner) return json({error: 'Sign in to save your keepsakes.'}, 401);
    const url = new URL(request.url), path = url.pathname.split('/').filter(Boolean);
    const gameId = request.headers.get('X-Nexus-Game');
    if (!games.has(gameId)) throw new NexusError('Unknown game.');
    if (request.method !== 'GET') {
      if (request.headers.get('Sec-Fetch-Site') === 'cross-site') throw new NexusError('Use the same-origin game client.', 403);
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) throw new NexusError('Use the same-origin game client.', 403);
      if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new NexusError('JSON is required.', 415);
    }
    const service = new NexusService(store);
    if (path[2] === 'catalog' && request.method === 'GET') return json({mode: 'simulated', recipes});
    if (path[2] !== 'keepsakes') throw new NexusError('Not found.', 404);
    if (request.method === 'GET') return json(path[3] ? await service.get(owner, gameId, path[3]) : await service.list(owner, gameId));
    if (request.method !== 'POST') throw new NexusError('Method not allowed.', 405);
    const text = await request.text();
    if (text.length > 110000) throw new NexusError('Request too large.', 413);
    let input; try { input = JSON.parse(text); } catch { throw new NexusError('Invalid JSON.'); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new NexusError('An object is required.');
    if (!path[3]) return json(await service.create(owner, gameId, input), 201);
    return json(await service.act(owner, gameId, path[3], path[4], input));
  } catch (error) {
    if (!(error instanceof NexusError)) console.error('Nexus request failed', error.message);
    return json({error: error instanceof NexusError ? error.message : 'Keepsake service unavailable. Your game is still playable.'}, error instanceof NexusError ? error.status : 503);
  }
}
