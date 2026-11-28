// Real browser smoke, no synthetic session, no financial or saved-data writes.
// Run with a dedicated non-production test identity only when explicitly configured.
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(resolve(process.env.RB_BROWSER_PREFIX??'.','package.json'));
const {chromium}=require('playwright');
const origin=process.env.RB_BROWSER_URL;
assert.ok(origin,'Set RB_BROWSER_URL to the exact candidate deployment URL');
const url=new URL(origin);const local=process.env.RB_LOCAL_BUILD==='1';if(local){assert.equal(url.origin,'http://127.0.0.1:4173');assert.notEqual(process.env.RB_REQUIRE_AUTH,'1','Local build cannot verify real authentication');}else assert.equal(url.protocol,'https:');assert.equal(url.origin,origin.replace(/\/$/,''),'Use only the deployment origin');assert.ok(!url.username&&!url.password,'Credentials must not appear in the deployment URL');assert.ok(local||url.hostname==='rich-bizness.com'||url.hostname==='rich-bizness-mobile-app.vercel.app'||/^rich-bizness-[a-z0-9]+-rich-bizness-llc\.vercel\.app$/.test(url.hostname),'Unrecognized Rich Bizness deployment');
const expected=process.env.RB_EXPECTED_COMMIT;assert.match(expected??'',/^[a-f0-9]{40}$/);
if(process.env.RB_REQUIRE_AUTH==='1')assert.ok(process.env.RB_BROWSER_EMAIL&&process.env.RB_BROWSER_PASSWORD,'Dedicated browser-test identity secrets are not configured');
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 if(local)await context.route('**/*',route=>new URL(route.request().url()).origin===url.origin?route.continue():route.abort());
 const page=await context.newPage(), errors=[];
 page.on('pageerror',e=>errors.push(e.name));
 const manifestUrl=new URL('/rb-section-release.json',url).href;
 // Exchange the protected environment secret for an origin-scoped Vercel cookie.
 // No extraHTTPHeaders on the browser context, no secret in URLs, no credential
 // forwarding on redirects to Vercel login, Stripe, Supabase or other origins.
 const bypass=local?undefined:process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
 if(bypass){
   try{await context.request.get(manifestUrl,{headers:{'x-vercel-protection-bypass':bypass,'x-vercel-set-bypass-cookie':'true'},maxRedirects:0,timeout:15000});}
   catch{throw Error('Vercel automation authentication request failed');}
 }
 const manifest=await context.request.get(manifestUrl,{maxRedirects:0,timeout:15000});
 const kind=manifest.headers()['content-type']??'';
 if(manifest.status()!==200||!kind.includes('application/json'))throw Error('Deployment manifest inaccessible (HTTP '+manifest.status()+'). Check Vercel Deployment Protection and browser-test environment secret VERCEL_AUTOMATION_BYPASS_SECRET. No application rendering test ran.');
 let release;
 try{release=(await manifest.json()).release;}catch{throw Error('Deployment manifest is not valid JSON');}
 assert.equal(release,expected,'Wrong deployed commit');
 // All 56 HTML source entry points must exist in the exact compiled deployment.
 // Network reachability is distinct from actual interactive and authenticated acceptance.
 const sourceRoot=resolve('apps/web');
 const ownerOf=html=>html.match(/<body\b[^>]*\bdata-page=["']([^"']+)["']/i)?.[1];
 const matrix=readdirSync(sourceRoot).filter(file=>file.endsWith('.html')).sort().map(file=>{
   const path=file==='index.html'?'/':'/'+file;
   const owner=ownerOf(readFileSync(resolve(sourceRoot,file),'utf8'));
   assert.ok(owner,'Missing source page owner: '+path);
   return {path,owner};
 });
 assert.equal(matrix.length,56,'Rich Bizness HTML source entry count changed');
 const entryAssets=new Set();
 for(let start=0;start<matrix.length;start+=6){
   const batch=matrix.slice(start,start+6);
   await Promise.all(batch.map(async ({path,owner})=>{
     const response=await context.request.get(new URL(path,url).href,{maxRedirects:0,timeout:15000});
     assert.equal(response.status(),200,'Unavailable HTML entry: '+path);
     const html=await response.text();
     assert.ok((response.headers()['content-type']??'').toLowerCase().includes('text/html'),'Non-HTML entry: '+path);
     assert.equal(ownerOf(html),owner,'Wrong compiled page owner: '+path);
     const scripts=[...html.matchAll(/<script\b[^>]*\bsrc=["'](\/assets\/[A-Za-z0-9_.-]+\.js)["'][^>]*>/gi)].map(match=>match[1]);
     assert.ok(scripts.length,'Missing compiled entry script: '+path);
     for(const asset of scripts)entryAssets.add(asset);
   }));
 }
 for(const asset of entryAssets){
   const response=await context.request.get(new URL(asset,url).href,{maxRedirects:0,timeout:15000});
   assert.equal(response.status(),200,'Unavailable compiled script: '+asset);
   assert.match(response.headers()['content-type']??'',/(?:java|ecma)script/i,'Non-JavaScript entry asset: '+asset);
   assert.ok((await response.body()).length>0,'Empty entry script: '+asset);
 }
 console.log('Real Chromium network route matrix: 56/56 exact source page owners and '+entryAssets.size+' reachable nonempty compiled entry scripts on '+url.origin);
 const visit=async(path,selector)=>{const result=await page.goto(new URL(path,url).href,{waitUntil:'domcontentloaded',timeout:30000});assert.ok(result?.ok(),'Navigation failed: '+path);assert.equal(new URL(page.url()).origin,url.origin,'Unexpected external navigation: '+path);await page.locator(selector).waitFor({state:'visible',timeout:30000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Horizontal overflow: '+path);};
 await visit('/','.rb-home h1');
 assert.equal(await page.locator('.rb-home').count(),1,'Duplicate Home mount');
 await page.locator('.rb-home__enter').click();
 await page.locator('#authForm').waitFor({state:'visible'});
 assert.equal(new URL(page.url()).searchParams.get('next'),'/portal.html','Home lost Portal return route');
 await visit('/','.rb-home h1');
 const art=await page.evaluate(async()=>{const home=document.querySelector('.rb-home');const css=getComputedStyle(home).getPropertyValue('--rb-universe-art');const source=css.match(/url\(["']?([^"')]+)["']?\)/)?.[1];if(!source)return null;const image=new Image();image.src=source;await image.decode();return {source,width:image.naturalWidth,height:image.naturalHeight};});assert.ok(art&&art.width===1080&&art.height>650&&art.source.includes('rb-universe-mobile.webp'),'Mobile artwork missing or wrong variant');
 await visit('/on-the-go-dash.html','#app');
 assert.equal(await page.locator('#online').isDisabled(),true,'Guest cannot enable provider GPS');
 assert.equal(await page.locator('button:has-text("Booking unavailable")').isDisabled(),true,'Unverified booking must remain disabled');
 await visit('/rb-secret-door.html','#app h1');
 assert.equal(await page.locator('#app h1').textContent(),'Rich Bizness Worlds','World index must be useful without a room query');
 assert.equal(await page.locator('#app article').count(),4,'Missing standalone world destinations');
 assert.ok(await page.locator('a[href="/creator-dimensions.html"]').count(),'World directory lost Creator Secret Door');
 for(const room of ['businesses','movie-room','on-the-go-dash','private-worlds']){
  const path='/rb-secret-door.html?room='+room;
  await visit(path,'#app h1');
  const tap=page.locator('a[href^="/tap-in.html?next="]');
  await tap.waitFor({state:'visible',timeout:20000});
  const destination=new URL(await tap.getAttribute('href'),url);
  assert.equal(destination.searchParams.get('next'),path,'World lost its Rich ID return path: '+room);
  assert.equal(await page.locator('#organization-workspace').count(),0,'Guest must never see organization registration');
  assert.equal(await page.locator('#app input[type="search"]').count(),0,'Guest must not see member directory controls');
 }
 await visit('/creator-dimensions.html','#authForm');
 assert.equal(new URL(page.url()).pathname,'/tap-in.html','Creator Secret Door must require Rich ID');
 assert.equal(new URL(page.url()).searchParams.get('next'),'/creator-dimensions.html','Creator Secret Door lost return route');
 assert.equal(await page.locator('[data-enter], [data-request]').count(),0,'Guest must not access paid dimension controls');
 // Cross-section new-user regressions: compiled, real Chromium, no fake login.
 await visit('/search.html','#searchInput');
 assert.equal(await page.locator('#searchInput').getAttribute('maxlength'),'100','Search query size constraint missing');
 assert.equal(await page.locator('#searchInput').count(),1,'Duplicate Search input');
 assert.equal(await page.locator('#searchForm').count(),1,'Duplicate Search form');
 assert.equal(await page.locator('#rbAdminSecretDoor').count(),0,'Guest must not see Admin Secret Door');
 for(const path of ['/rb-secret-door.html','/creator-dimensions.html','/on-the-go-dash.html'])assert.equal(await page.locator('nav[aria-label="Universe destinations"] a[href="'+path+'"]').count(),1,'Missing discovery destination: '+path);
 await page.locator('#rb-omni-mini').waitFor({state:'attached',timeout:15000});
 assert.ok(await page.locator('#rb-omni-mini').locator('a[href="/avatar-characters.html"]').count(),'Search Mini Omni must link to the canonical Avatar Studio');
 assert.ok(await page.locator('#rb-omni-mini').locator('a[href="/portal.html"]').count(),'Search Mini Omni must link to the canonical Portal');
 await visit('/feed.html','#postBody');
 assert.equal(await page.locator('#postBody').isDisabled(),true,'Guest must not post as a Rich ID');
 assert.equal(await page.locator('#feedModalForm input').isDisabled(),true,'Guest must not comment as a Rich ID');
 await page.locator('#rb-omni-mini').waitFor({state:'attached',timeout:15000});
 assert.ok(await page.locator('#rb-omni-mini').locator('a[href="/profile.html"]').count(),'Feed Mini Omni missing Profile');
 for(const privateRoute of ['/profile.html','/edit-profile.html','/settings.html','/admin.html','/avatar-characters.html','/avatar.html']){
  await visit(privateRoute,'#authForm');
  const redirect=new URL(page.url());
  assert.equal(redirect.pathname,'/tap-in.html','Protected guest route did not reach Tap In: '+privateRoute);
  assert.equal(redirect.searchParams.get('next'),privateRoute,'Sign-in return path lost: '+privateRoute);
 }
 await visit('/tap-in.html','#authForm');
 assert.equal(await page.locator('.auth-shell').count(),1,'Duplicate access shell');
 assert.equal(await page.locator('.auth-card').count(),1,'Duplicate access card');
 assert.equal(await page.locator('.auth-release-label').textContent(),'Access design · Nexus 2');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--rb-beyond-cinematic').trim()),'','Global cinematic overlay must not style Tap In');
 await page.locator('.auth-support summary').click();
 assert.equal(await page.locator('.auth-support').getAttribute('open'),'');
 await page.locator('.auth-support summary').click();
 await visit('/portal.html','#authForm');assert.match(new URL(page.url()).pathname,/tap-in/,'Private Portal must require a session');
 console.log('Real Chromium '+(local?'local compiled':'hosted')+' public smoke: exact commit, Home artwork decoded, Tap In, private Portal redirect, 390px viewport');
 if(process.env.RB_REQUIRE_AUTH==='1'&&process.env.RB_BROWSER_EMAIL&&process.env.RB_BROWSER_PASSWORD){
  // Never emit credentials, tokens, screenshots of private data, or browser state.
  await page.locator('#email').fill(process.env.RB_BROWSER_EMAIL);
  await page.locator('#password').fill(process.env.RB_BROWSER_PASSWORD);
  await page.locator('#submitButton').click();
  await page.locator('.portal-command').waitFor({state:'visible',timeout:45000});
  assert.equal(await page.locator('.portal-route-layer a').count(),8);
  await page.waitForFunction(()=>document.querySelector('#rbPortalStatus')?.textContent?.startsWith('Synced'),{},{timeout:30000});
  assert.ok(await page.evaluate(()=>{const c=document.querySelector('#portalMotionCanvas');return c instanceof HTMLCanvasElement&&c.width>0&&c.height>0&&c.width*c.height<=900000;}),'Portal canvas budget or mount failed');
  assert.ok(await page.locator('.pc-actions a[href="/avatar-characters.html"]').count(),'Missing Avatar Studio access');
  await visit('/avatar-characters.html','#app[data-page-mounted="true"]');
  await page.waitForFunction(()=>[...document.querySelectorAll('canvas')].some(c=>c.dataset.rbRenderState==='frame-rendered'),{},{timeout:90000});
  for(const route of ['/profile.html','/edit-profile.html','/settings.html','/search.html','/feed.html']){
    await visit(route,'#app[data-page-mounted="true"]');
    assert.equal(new URL(page.url()).pathname,route,'Authenticated route redirected');
    const mini=page.locator('#rb-omni-mini');await mini.waitFor({state:'attached'});
    await mini.getByRole('button',{name:'Open Mini Omni Dial'}).click();
    await mini.getByText(/Saved character:|Customize your character/).waitFor({state:'visible',timeout:20000});
  }
  console.log('Real Chromium authenticated smoke: Rich ID, Portal snapshot, eight destinations, bounded canvas, character frame');
 }else console.log('Authenticated gate NOT RUN: dedicated test identity not configured.');
 assert.deepEqual(errors,[],'Browser page exceptions');
 await context.close();
}finally{await browser.close();}
