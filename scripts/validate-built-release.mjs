import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {ROUTES} from '../packages/config/src/routes.ts';
import {GAMES} from '../packages/config/src/games.ts';
const dist=resolve('apps/web/dist');
const read=p=>readFileSync(resolve(dist,p),'utf8');
const names=[...new Set(Object.values(ROUTES).map(r=>r==='/'?'index':r.slice(1).replace(/\.html$/,''))),...GAMES.map(g=>g.slug)];
assert.equal(new Set(names).size,names.length,'Duplicate release route');
const manifest=JSON.parse(read('rb-section-release.json'));
assert.equal(manifest.schema,1);
if(/^[a-f0-9]{40}$/.test(process.env.VERCEL_GIT_COMMIT_SHA??''))assert.equal(manifest.release,process.env.VERCEL_GIT_COMMIT_SHA,'Stale release manifest');
const assets=new Set();let visualPages=0;
for(const name of names){
 const html=read(name+'.html');
 const scripts=[...html.matchAll(/<script\b[^>]*\bsrc=["'](\/assets\/[^"']+\.js)["'][^>]*>/gi)].map(m=>m[1]);
 assert.ok(scripts.length,'Missing compiled JS entry: '+name);
 const refs=[...html.matchAll(/\b(?:src|href)=["'](\/assets\/[^"']+)["']/gi)].map(m=>m[1]);
 for(const ref of refs){assert.ok(/^\/assets\/[A-Za-z0-9_.-]+$/.test(ref),'Unexpected asset path: '+ref);const s=statSync(resolve(dist,ref.slice(1)));assert.ok(s.isFile()&&s.size>0,'Missing or empty '+ref+' on '+name);assets.add(ref);}
 const page=html.match(/\bdata-page=["']([^"']+)["']/)?.[1];
 assert.ok(page,'Missing page identity: '+name);
 assert.ok(html.includes('data-rb-visual="'+(GAMES.some(g=>g.slug===page)?'game':'universe')+'"'),'Missing cinematic surface classification: '+name);
 assert.ok(refs.filter(r=>r.endsWith('.css')).some(r=>read(r.slice(1)).includes('--rb-beyond-cinematic')),'Missing compiled cinematic stylesheet: '+name);visualPages++;
 if(!GAMES.some(g=>g.slug===name))assert.ok(manifest.sections[page],'No registered section owner for '+name+': '+page);
}
for(const variant of ['adaptive','enhanced'])assert.ok(statSync(resolve(dist,'character-assets/rb-elite-emerald-legacy-groom-'+variant+'.glb')).size>0);
console.log('V1 built release gate: '+names.length+' HTML entries, '+assets.size+' nonempty linked assets, '+Object.keys(manifest.sections).length+' owners, '+visualPages+' cinematic surfaces, exact release '+manifest.release.slice(0,12));
