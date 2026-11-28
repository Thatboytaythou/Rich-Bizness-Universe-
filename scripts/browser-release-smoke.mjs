// Real browser smoke, no synthetic session, no financial or saved-data writes.
// Run with a dedicated non-production test identity only when explicitly configured.
import assert from 'node:assert/strict';
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
 const visit=async(path,selector)=>{const result=await page.goto(new URL(path,url).href,{waitUntil:'domcontentloaded',timeout:30000});assert.ok(result?.ok(),'Navigation failed: '+path);assert.equal(new URL(page.url()).origin,url.origin,'Unexpected external navigation: '+path);await page.locator(selector).waitFor({state:'visible',timeout:30000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Horizontal overflow: '+path);};
 await visit('/','.rb-home h1');
 const art=await page.evaluate(async()=>{const home=document.querySelector('.rb-home');const css=getComputedStyle(home).getPropertyValue('--rb-universe-art');const source=css.match(/url\(["']?([^"')]+)["']?\)/)?.[1];if(!source)return null;const image=new Image();image.src=source;await image.decode();return {source,width:image.naturalWidth,height:image.naturalHeight};});assert.ok(art&&art.width===1080&&art.height>650&&art.source.includes('rb-universe-mobile.webp'),'Mobile artwork missing or wrong variant');
 await visit('/tap-in.html','#authForm');
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
  console.log('Real Chromium authenticated smoke: Rich ID, Portal snapshot, eight destinations, bounded canvas, character frame');
 }else console.log('Authenticated gate NOT RUN: dedicated test identity not configured.');
 assert.deepEqual(errors,[],'Browser page exceptions');
 await context.close();
}finally{await browser.close();}
