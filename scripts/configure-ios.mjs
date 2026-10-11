import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
fs.mkdirSync('.sites-runtime',{recursive:true});
const path='.sites-runtime/mobile-demo.json';
const token=fs.existsSync(path)?JSON.parse(fs.readFileSync(path)).token:crypto.randomBytes(32).toString('hex');
fs.writeFileSync(path,JSON.stringify({token}),{mode:0o600});
const address=Object.values(os.networkInterfaces()).flat().find(i=>i.family==='IPv4'&&!i.internal)?.address||'127.0.0.1';
// xcconfig treats // as a comment; expand it through an empty variable.
fs.writeFileSync('ios/Demo.local.xcconfig',`NEXUS_DEMO_SERVER = http:/$()/`+address+`:4174\nNEXUS_DEMO_TOKEN = ${token}\n`,{mode:0o600});
console.log(`Configured iOS demo for http://${address}:4174. No Arcade key saved.`);
