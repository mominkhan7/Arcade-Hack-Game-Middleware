import {configuredProvider} from './craftkit/providers/index.js';
import {timingSafeEqual} from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {handleCraftKit} from './craftkit/api.js';
import {D1Store} from './craftkit/stores/d1.js';
const root=path.resolve('dist');
fs.mkdirSync('.sites-runtime',{recursive:true});
// Reuse the existing database; a branding change must not reset saved orders.
const databasePath=fs.existsSync('.sites-runtime/craftkit.sqlite')?'.sites-runtime/craftkit.sqlite':fs.existsSync('.sites-runtime/nexus.sqlite')?'.sites-runtime/nexus.sqlite':'.sites-runtime/craftkit.sqlite';
const sqlite=new DatabaseSync(databasePath);
sqlite.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()) {
  if(sqlite.prepare('SELECT name FROM local_migrations WHERE name = ?').get(file))continue;
  sqlite.exec('BEGIN');
  try{sqlite.exec(fs.readFileSync(path.join('drizzle',file),'utf8'));sqlite.prepare('INSERT INTO local_migrations (name) VALUES (?)').run(file);sqlite.exec('COMMIT');}catch(error){sqlite.exec('ROLLBACK');throw error;}
}
const db={prepare(sql){return {bind(...values){return {async first(){return sqlite.prepare(sql).get(...values)||null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){return {meta:sqlite.prepare(sql).run(...values)};}};}};}};
const provider=configuredProvider(process.env);
const host=(process.env.CRAFTKIT_HOST ?? process.env.NEXUS_HOST)||'127.0.0.1', token=(process.env.CRAFTKIT_DEMO_TOKEN ?? process.env.NEXUS_DEMO_TOKEN);
if(host!=='127.0.0.1' && (!token || token.length<32)) throw Error('LAN demo requires a strong token.');
const valid=value=>{const a=Buffer.from(value||''),b=Buffer.from(token||'');return a.length===b.length&&timingSafeEqual(a,b);};
const store=new D1Store(db),port=Number((process.env.CRAFTKIT_PORT ?? process.env.NEXUS_PORT)||4174);
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,`http://${req.headers.host||'127.0.0.1:'+port}`);
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Cache-Control','no-store');
    if (token) {
      if(url.pathname==='/mobile-session' && valid(url.searchParams.get('token'))) {
        const game=({'pattern-garden':'/pattern-garden.html','chess-atelier':'/chess.html',library:'/library.html',offerings:'/craftkit.html'})[url.searchParams.get('game')] || '/';
        res.writeHead(303,{'Set-Cookie':`craftkit_demo=${token}; HttpOnly; SameSite=Strict; Path=/`,Location:game});res.end();return;
      }
      const cookie=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('craftkit_demo=')||v.startsWith('nexus_demo='))?.split('=').slice(1).join('=');
      if(!valid(cookie)){res.writeHead(401);res.end('Open this demo from the CraftKit iOS app.');return;}
    }
    if((url.pathname.startsWith('/api/craftkit/') || url.pathname.startsWith('/api/nexus/'))) {
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>1600000){res.writeHead(413);res.end('Request too large');return;}chunks.push(chunk);}
      const body=Buffer.concat(chunks);
      const request=new Request(url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:body});
      // Development identity is injected only by this loopback-only preview server.
      const response=await handleCraftKit(request,store,'local-demo-player',provider);
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    const p=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(p!==root&&!p.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    if(p.startsWith(path.join(root,'server'))||p.startsWith(path.join(root,'.openai'))){res.writeHead(404);res.end();return;}
    const f=p===root?path.join(root,'index.html'):p;
    fs.readFile(f,(err,data)=>{if(err){res.writeHead(404);res.end('Not found');return;}res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png'})[path.extname(f)]||'application/octet-stream');res.end(data);});
  }catch(error){console.error(error.message);res.writeHead(500);res.end('Preview unavailable');}
}).listen(port,host,()=>console.log(`${provider.mode.toUpperCase()} CraftKit + games: http://127.0.0.1:${port}`));
