import assert from 'node:assert/strict';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {ROUTES} from '../packages/config/src/routes.ts';
import {GAMES} from '../packages/config/src/games.ts';
const dist=resolve('apps/web/dist');
const read=p=>readFileSync(resolve(dist,p),'utf8');
const source=resolve('apps/web');
const registered=[...new Set(Object.values(ROUTES).map(r=>r==='/'?'index':r.slice(1).replace(/\.html$/,''))),...GAMES.map(g=>g.slug)];
assert.equal(new Set(registered).size,registered.length,'Duplicate release route');
// These independently mounted worlds intentionally do not use the main section registry.
const standalone=new Map([['rb-secret-door','secret-world'],['on-the-go-dash','on-the-go-dash']]);
const names=readdirSync(source).filter(f=>f.endsWith('.html')).map(f=>f.slice(0,-5)).sort();
assert.deepEqual(names,[...new Set([...registered,...standalone.keys()])].sort(),'Unregistered or missing HTML source entry');
assert.deepEqual(readdirSync(dist).filter(f=>f.endsWith('.html')).sort(),names.map(n=>n+'.html').sort(),'Compiled HTML coverage differs from source');
const manifest=JSON.parse(read('rb-section-release.json'));
assert.equal(manifest.schema,1);
if(/^[a-f0-9]{40}$/.test(process.env.VERCEL_GIT_COMMIT_SHA??''))assert.equal(manifest.release,process.env.VERCEL_GIT_COMMIT_SHA,'Stale release manifest');
const assets=new Set();let visualPages=0,isolatedAccessPages=0;
for(const name of names){
 const html=read(name+'.html');
 const scripts=[...html.matchAll(/<script\b[^>]*\bsrc=["'](\/assets\/[^"']+\.js)["'][^>]*>/gi)].map(m=>m[1]);
 assert.ok(scripts.length,'Missing compiled JS entry: '+name);
 const refs=[...html.matchAll(/\b(?:src|href)=["'](\/assets\/[^"']+)["']/gi)].map(m=>m[1]);
 for(const ref of refs){assert.ok(/^\/assets\/[A-Za-z0-9_.-]+$/.test(ref),'Unexpected asset path: '+ref);const s=statSync(resolve(dist,ref.slice(1)));assert.ok(s.isFile()&&s.size>0,'Missing or empty '+ref+' on '+name);assets.add(ref);}
 const page=html.match(/\bdata-page=["']([^"']+)["']/)?.[1];
 assert.ok(page,'Missing page identity: '+name);
 const sourceOwner=readFileSync(resolve(source,name+'.html'),'utf8').match(/\bdata-page=["']([^"']+)["']/)?.[1];
 assert.equal(page,sourceOwner,'Compiled page owner differs from source: '+name);
 // Rich ID intentionally has an isolated, lightweight access surface.
 // Do not reintroduce the global cinematic overlay to make this gate green.
 if(name==='tap-in'){
   assert.equal(page,'tap-in','Unexpected Rich ID route owner');
   assert.ok(html.includes('data-rb-access-release="rich-id-single-layer-4"'),'Missing isolated Rich ID release marker');
   assert.ok(!html.includes('data-rb-visual='),'Global visual surface must not mount on Rich ID');
   assert.ok(refs.some(r=>r.endsWith('.css')),'Missing compiled Rich ID stylesheet');
   isolatedAccessPages++;
 }else{
   assert.ok(html.includes('data-rb-visual="'+(GAMES.some(g=>g.slug===page)?'game':'universe')+'"'),'Missing cinematic surface classification: '+name);
   assert.ok(refs.filter(r=>r.endsWith('.css')).some(r=>read(r.slice(1)).includes('--rb-beyond-cinematic')),'Missing compiled cinematic stylesheet: '+name);
   visualPages++;
 }
 if(standalone.has(name))assert.equal(page,standalone.get(name),'Incorrect standalone world owner: '+name);
 else if(!GAMES.some(g=>g.slug===name))assert.ok(manifest.sections[page],'No registered section owner for '+name+': '+page);
}
for(const variant of ['adaptive','enhanced'])assert.ok(statSync(resolve(dist,'character-assets/rb-elite-emerald-legacy-groom-'+variant+'.glb')).size>0);
console.log('V1 built release gate: '+names.length+' HTML entries, '+assets.size+' nonempty linked assets, '+Object.keys(manifest.sections).length+' owners, '+visualPages+ ' cinematic surfaces, '+isolatedAccessPages+' isolated access surfaces, exact release '+manifest.release.slice(0,12));

for(const path of ['images/0E886281-8F03-4288-B3CA-C45369B7B58E.png','images/gta-style-elite.png.jpeg','images/music-logo.png.jpeg','images/brand/IMG_5997.png','images/brand/C54535CD-E2B2-481B-81C8-4CFA81CC2ACD.png'])assert.ok(statSync(resolve(dist,path)).size>0,'Missing legacy image '+path);console.log('Evolution: 5 previously unresolved brand image paths now present');

assert.ok(statSync(resolve(dist,'images/brand/portal-command-city.svg')).size>0,'Missing original Portal city plate');

const portalHtml=read('portal.html');assert.ok(portalHtml.includes('data-page="portal"'));console.log('Maximum Evolution Portal artwork and page identity verified');

// Verify the compiled dependency graph, not source import spelling.
const graph=JSON.parse(read('.vite/manifest.json'));
const byFile=new Map(Object.values(graph).map(c=>[c.file,c]));
const closure=(key,seen=new Set())=>{const c=graph[key]??byFile.get(key);assert.ok(c,'Missing manifest dependency '+key);if(seen.has(c.file))return seen;seen.add(c.file);for(const dep of c.imports??[])closure(dep,seen);return seen;};
const findModule=part=>{const key=Object.keys(graph).find(k=>k.endsWith(part));assert.ok(key,'Missing compiled module '+part);return key;};
const liveCold=closure(findModule('/live/live.page.ts'));
assert.ok([...liveCold].every(p=>!p.includes('vendor-livekit')&&!p.includes('vendor-webrtc')),'Live catalog eagerly loads video SDK');
const fitCold=closure(findModule('/avatar/avatar.textured.runtime.ts'));
assert.ok([...fitCold].every(p=>!p.includes('vendor-character-hd')&&!p.includes('avatar.compatibility.runtime')),'Character dispatcher eagerly loads fit engine');
for(const name of ['index','portal','tap-in','gaming','store','search']){const html=read(name+'.html');assert.doesNotMatch(html,/vendor-(?:character-hd|three|livekit)[^"']*\.js/,'Heavy renderer in cold '+name);}
const total=files=>[...files].filter(p=>p.endsWith('.js')).reduce((sum,p)=>sum+statSync(resolve(dist,p)).size,0);
console.log('Maximum Evolution cold module gate: Live '+total(liveCold)+' bytes; character dispatcher '+total(fitCold)+' bytes; six shell routes free of eager 3D/video dependencies');

assert.ok([...fitCold].every(p=>!p.includes('vendor-three')),'Character configuration dispatcher still imports Three.js');assert.ok(total(fitCold)<350000,'Character dispatcher exceeds 350 KB cold dependency budget');console.log('Maximum Evolution actual dispatcher reduction: '+(1017221-total(fitCold))+' bytes versus c2a925db baseline');

const art=JSON.parse(read('images/brand/rb-universe-art.json'));assert.equal(art.variants.length,3);for(const [i,w] of [1080,1920,3840].entries()){const v=art.variants[i];assert.equal(v.width,w);assert.ok(v.height>0&&Math.abs(v.width/v.height-art.original.width/art.original.height)<.005);assert.equal(statSync(resolve(dist,'images/brand',v.file)).size,v.bytes);assert.ok(v.bytes<=v.budget);}console.log('Responsive cinematic artwork budgets verified: '+art.variants.map(v=>v.width+'px / '+v.bytes+' bytes').join(', '));
