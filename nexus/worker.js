import {configuredProvider} from './providers/index.js';
import {handleNexus} from './api.js';
import {D1Store} from './stores/d1.js';
import assets from '../.sites-runtime/assets.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/nexus/')) {
      if (!env.DB) return Response.json({error:'Keepsake storage is unavailable. You can keep playing.'}, {status:503});
      return handleNexus(request, new D1Store(env.DB), request.headers.get('oai-authenticated-user-id'), configuredProvider(env));
    }
    if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed', {status:405});
    const asset = assets[url.pathname === '/' ? '/index.html' : url.pathname];
    if (!asset) return new Response('Not found', {status:404});
    const bytes = Uint8Array.from(atob(asset.body), c => c.charCodeAt(0));
    return new Response(request.method === 'HEAD' ? null : bytes, {headers:{
      'Content-Type':asset.type, 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff',
    }});
  },
};
