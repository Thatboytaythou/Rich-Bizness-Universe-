import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=process.cwd(),src=resolve(root,'apps/web/src'),registry=await readFile(resolve(src,'route-loader.ts'),'utf8');
const sections={},owners=new Set();
const rows=[...registry.matchAll(/^  (?:'([^']+)'|([\w-]+)): guardedRegistration\(\{([^\n]+)\}\),?$/gm)];
if(!rows.length)throw Error('No registered section owners');
for(const [,quoted,bare,body] of rows){
  const page=quoted||bare,owner=body.match(/owner: '([^']+)'/)?.[1],module=body.match(/loadModule: \(\) => import\('\.(\/[^']+)'\)/)?.[1];
  if(!owner||!module||owners.has(owner))throw Error('Invalid or duplicate owner: '+page);
  owners.add(owner);
  const source=await readFile(resolve(src,'.'+module+'.ts'),'utf8');
  sections[page]={owner,revision:createHash('sha256').update(source).digest('hex').slice(0,12)};
}
for(const page of ['home','portal','profile','avatar','avatar-characters','meta','store'])if(!sections[page])throw Error('Missing core section '+page);
const sha=process.env.VERCEL_GIT_COMMIT_SHA;
const release=sha&&/^[a-f0-9]{40}$/.test(sha)?sha:createHash('sha256').update(registry).update(JSON.stringify(sections)).digest('hex');
const dir=resolve(root,'apps/web/public');await mkdir(dir,{recursive:true});
await writeFile(resolve(dir,'rb-section-release.json'),JSON.stringify({schema:1,release,sections}));
console.log('Section update contract verified: '+Object.keys(sections).length+' owners / '+release.slice(0,12));
