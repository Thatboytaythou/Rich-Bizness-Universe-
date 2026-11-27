import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {safeInternalRoute} from '../packages/config/src/routes.ts';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const implementedEntries = [
  'apps/web/index.html','apps/web/portal.html','apps/web/tap-in.html','apps/web/profile.html','apps/web/edit-profile.html','apps/web/settings.html','apps/web/notifications.html','apps/web/messages.html','apps/web/search.html','apps/web/upload.html','apps/web/creator.html','apps/web/admin.html','apps/web/feed.html','apps/web/gallery.html','apps/web/live.html','apps/web/watch.html','apps/web/music.html','apps/web/podcast.html','apps/web/radio.html','apps/web/sports.html','apps/web/store.html','apps/web/gaming.html','apps/web/meta.html','apps/web/avatar.html','apps/web/avatar-characters.html','apps/web/rich-chess.html','apps/web/smoke-room-cards.html','apps/web/dj-radio-run.html','apps/web/money-road-runner.html','apps/web/rich-samurais-son-ninja.html','apps/web/aura-shinobi-clash.html','apps/web/boss-walk-battle.html','apps/web/smoke-burst-arena.html','apps/web/hero-villain-showdown.html','apps/web/empire-builder.html'
];
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
