import {build} from 'esbuild';
import {mkdir, readdir, readFile, writeFile, cp} from 'node:fs/promises';
import path from 'node:path';
const types = {'.js':'application/javascript','.html':'text/html; charset=utf-8','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const assets = {};
async function collect(directory = 'dist') {
  for (const entry of await readdir(directory, {withFileTypes:true})) {
    if (['server','.openai','commerce-model.js'].includes(entry.name)) continue;
    const file = path.join(directory,entry.name);
    if (entry.isDirectory()) await collect(file);
    else assets['/' + path.relative('dist',file)] = {body:(await readFile(file)).toString('base64'),type:types[path.extname(file)]||'application/octet-stream'};
  }
}
await collect();
await mkdir('.sites-runtime',{recursive:true});
await writeFile('.sites-runtime/assets.js','export default '+JSON.stringify(assets)+';');
await build({entryPoints:['craftkit/worker.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
await mkdir('dist/.openai',{recursive:true});
await cp('.openai/hosting.json','dist/.openai/hosting.json');
await cp('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('Built CraftKit Worker, game assets, and database migrations.');
