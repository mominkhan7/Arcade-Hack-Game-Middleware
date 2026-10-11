import {configuredProvider} from './nexus/providers/index.js';
import {timingSafeEqual} from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {handleNexus} from './nexus/api.js';
import {D1Store} from './nexus/stores/d1.js';
const root=path.resolve('dist');
fs.mkdirSync('.sites-runtime',{recursive:true});
const sqlite=new DatabaseSync('.sites-runtime/nexus.sqlite');
sqlite.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()) {
  if(sqlite.prepare('SELECT name FROM local_migrations WHERE name = ?').get(file))continue;
  sqlite.exec('BEGIN');
  try{sqlite.exec(fs.readFileSync(path.join('drizzle',file),'utf8'));sqlite.prepare('INSERT INTO local_migrations (name) VALUES (?)').run(file);sqlite.exec('COMMIT');}catch(error){sqlite.exec('ROLLBACK');throw error;}
}
const db={prepare(sql){return {bind(...values){return {async first(){return sqlite.prepare(sql).get(...values)||null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){return {meta:sqlite.prepare(sql).run(...values)};}};}};}};
const provider=configuredProvider(process.env);
const host=process.env.NEXUS_HOST||'127.0.0.1', token=process.env.NEXUS_DEMO_TOKEN;
if(host!=='127.0.0.1' && (!token || token.length<32)) throw Error('LAN demo requires a strong token.');
const valid=value=>{const a=Buffer.from(value||''),b=Buffer.from(token||'');return a.length===b.length&&timingSafeEqual(a,b);};
const store=new D1Store(db),port=Number(process.env.NEXUS_PORT||4174);
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,`http://${req.headers.host||'127.0.0.1:'+port}`);
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Cache-Control','no-store');
    if (token) {
      if(url.pathname==='/mobile-session' && valid(url.searchParams.get('token'))) {
        const game=({'pattern-garden':'/pattern-garden.html','chess-atelier':'/chess.html',library:'/library.html'})[url.searchParams.get('game')] || '/';
        res.writeHead(303,{'Set-Cookie':`nexus_demo=${token}; HttpOnly; SameSite=Strict; Path=/`,Location:game});res.end();return;
      }
      const cookie=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('nexus_demo='))?.slice(11);
      if(!valid(cookie)){res.writeHead(401);res.end('Open this demo from the Nexus iOS app.');return;}
    }
    if(url.pathname.startsWith('/api/nexus/')) {
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>1600000){res.writeHead(413);res.end('Request too large');return;}chunks.push(chunk);}
      const body=Buffer.concat(chunks);
      const request=new Request(url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:body});
      // Development identity is injected only by this loopback-only preview server.
      const response=await handleNexus(request,store,'local-demo-player',provider);
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    const p=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(p!==root&&!p.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    if(p.startsWith(path.join(root,'server'))||p.startsWith(path.join(root,'.openai'))){res.writeHead(404);res.end();return;}
    const f=p===root?path.join(root,'index.html'):p;
    fs.readFile(f,(err,data)=>{if(err){res.writeHead(404);res.end('Not found');return;}res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png'})[path.extname(f)]||'application/octet-stream');res.end(data);});
  }catch(error){console.error(error.message);res.writeHead(500);res.end('Preview unavailable');}
}).listen(port,host,()=>console.log(`${provider.mode.toUpperCase()} Nexus + games: http://127.0.0.1:${port}`));
