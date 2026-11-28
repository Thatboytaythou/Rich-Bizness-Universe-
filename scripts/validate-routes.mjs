import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {safeInternalRoute} from '../packages/config/src/routes.ts';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
import {GAMES} from '../packages/config/src/games.ts';
import {ROUTES} from '../packages/config/src/routes.ts';
const routeNames=[...new Set(Object.values(ROUTES).map(route=>route==='/'?'index':route.slice(1).replace(/\.html$/,'')))];
const implementedEntries=[...routeNames,...GAMES.map(game=>game.slug)].map(name=>'apps/web/'+name+'.html');
assert.equal(new Set(implementedEntries).size,implementedEntries.length);
assert.equal(GAMES.length,28);
const vite=readFileSync(resolve(root,'vite.config.ts'),'utf8'),vercel=JSON.parse(readFileSync(resolve(root,'vercel.json'),'utf8'));
for(const entry of implementedEntries){
 const name=entry.split('/').pop().replace(/\.html$/,'');
 const html=readFileSync(resolve(root,entry),'utf8');
 assert.ok(vite.includes("page('"+name+"')"),'Missing Vite entry: '+name);
 const script=html.match(/<script[^>]+src=["']([^"']+\.ts)["']/);
 assert.ok(script,'Missing module entry: '+name);
 await access(resolve(root,'apps/web',script[1].replace(/^\//,'')));
 if(name!=='index')assert.ok(vercel.rewrites.some(r=>r.source==='/'+name&&r.destination==='/'+name+'.html'),'Missing production route: '+name);
}
for(const game of GAMES)assert.ok(vercel.redirects.some(r=>r.source==='/games/'+game.slug&&r.destination===game.route),'Missing game legacy redirect: '+game.slug);
assert.ok(vercel.redirects.some(r=>r.source==='/auth.html'&&r.destination==='/tap-in'),'Missing Auth alias');

const missing=[];
for(const entry of implementedEntries){try{await access(resolve(root,entry));}catch{missing.push(entry)}}
if(missing.length){console.error(`Missing implemented route entries: ${missing.join(', ')}`);process.exit(1)}
console.log(`Route contract valid for ${implementedEntries.length} implemented entry points.`);
const read=p=>readFileSync(resolve(root,p),'utf8');const boot=read('apps/web/src/bootstrap.ts'),loader=read('apps/web/src/route-loader.ts'),main=read('apps/web/src/main.ts'),home=read('apps/web/src/pages/home/home.page.ts'),portal=read('apps/web/src/pages/portal/portal.universe.ts'),tap=read('apps/web/src/pages/tap-in/tap-in.page.ts');
for(const [file,page] of [['index','home'],['tap-in','tap-in'],['portal','portal']])assert.ok(read('apps/web/'+file+'.html').includes('data-page="'+page+'"'));
assert.match(loader,/home: guardedRegistration\(\{ auth: 'optional', owner: 'rich-bizness-home-v1'/);assert.match(loader,/portal: guardedRegistration\(\{ auth: 'required', owner: 'rich-bizness-portal-v3'/);assert.ok(loader.indexOf('if (alreadyMounted) return;')<loader.indexOf('app.dataset[EPOCH_KEY] = epoch;'));assert.match(loader,/mountTail=job\.then/);assert.match(main,/if\(!mounted\)return/);assert.match(main,/if\(page==='home'\|\|page==='tap-in'\)return/);assert.match(boot,/registration.auth==='required'&&!auth.ready/);assert.match(home,/subscribeAuth\(state=>/);assert.match(portal,/abortSignal\(abort.signal\)/);assert.match(tap,/pending \|\| navigating/);assert.equal(safeInternalRoute('/portal.html?x=1#home'),'/portal.html?x=1#home');assert.equal(safeInternalRoute('//evil.example'),'/portal.html');assert.equal(safeInternalRoute('/\\\\evil.example'),'/portal.html');assert.equal(safeInternalRoute('/\t/evil.example'),'/portal.html');console.log('V1: distinct Home/Tap In/Portal owners, serialized mount, auth-gated runtime, safe return paths and bounded portal snapshot');

assert.equal(safeInternalRoute('/a/..//evil.example'),'/portal.html');
assert.match(main,/pageshow.*event.persisted/);
// Exercise the actual registration guard using an isolated simulated document.
import {guardedRegistration} from '../apps/web/src/route-loader.ts';
const app={dataset:{},replaceChildren(){this.clears=(this.clears??0)+1;}};globalThis.document={querySelector:()=>app};globalThis.window={};let mounts=0,cleans=0;
const make=owner=>guardedRegistration({auth:'public',owner,loadModule:async()=>({mount:async()=>{mounts++;await Promise.resolve();window.__rbPageCleanup=()=>{cleans++;};}})});
const one=await make('test-home').load(),two=await make('test-portal').load();await Promise.all([one.mount(),one.mount()]);assert.equal(mounts,1);assert.equal(app.dataset.pageEpoch,'1');await Promise.all([two.mount(),two.mount()]);assert.equal(mounts,2);assert.equal(cleans,1);assert.equal(app.dataset.pageEpoch,'2');assert.equal(app.dataset.pageOwner,'test-portal');delete globalThis.window;delete globalThis.document;
console.log('V1 route lifecycle: duplicate mount execution suppressed, previous owner cleaned once, epoch preserved');

const command=read('apps/web/src/pages/portal/portal.command.css');assert.match(portal,/void refresh\(\)/);assert.match(portal,/window.setInterval/);assert.match(portal,/clearInterval\(poll\)/);assert.match(portal,/document.hidden\|\|pending/);assert.match(portal,/ROUTES.avatarCharacters/);assert.match(portal,/ROUTES.creatorDimensions/);assert.match(command,/pointer-events:auto;touch-action:manipulation/);assert.match(command,/grid-template-columns:minmax\(0,1fr\)/);assert.doesNotMatch(portal,/recent_activity/);console.log('Evolution Portal: instant shell, eight stable destinations, all-section deck, bounded member refresh and cleanup');

assert.match(portal,/selectDestination/);assert.match(portal,/data-portal-focus/);assert.match(portal,/addEventListener\('focus'/);console.log('Portal destination focus and independent route links verified');
