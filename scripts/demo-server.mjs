import fs from 'node:fs';
// Start with credentials on hidden stdin (or env), never shell arguments.
import {createInterface} from 'node:readline';
if (process.argv.includes('--secret-stdin')) {
  process.stdout.write('Ready for secret JSON on stdin (disable terminal echo).\n');
  const rl=createInterface({input:process.stdin});
  const secrets=await new Promise(resolve=>rl.once('line',line=>{rl.close();resolve(JSON.parse(line));}));
  process.env.ARCADE_API_KEY=secrets.arcadeKey;
  if(secrets.demoToken) process.env.CRAFTKIT_DEMO_TOKEN=secrets.demoToken;
}
process.env.CRAFTKIT_DEMO_TOKEN ??= process.env.NEXUS_DEMO_TOKEN;
if (!process.env.CRAFTKIT_DEMO_TOKEN && fs.existsSync('.sites-runtime/mobile-demo.json')) process.env.CRAFTKIT_DEMO_TOKEN=JSON.parse(fs.readFileSync('.sites-runtime/mobile-demo.json')).token;
if (!process.env.CRAFTKIT_DEMO_TOKEN || process.env.CRAFTKIT_DEMO_TOKEN.length<32) throw Error('Set a random CRAFTKIT_DEMO_TOKEN of at least 32 characters.');
process.env.CRAFTKIT_HOST='0.0.0.0';
process.env.CRAFTKIT_PROVIDER='live';
await import('../preview.mjs');
