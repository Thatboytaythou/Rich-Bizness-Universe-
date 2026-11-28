// Real browser smoke, no synthetic session, no financial or saved-data writes.
// Run with a dedicated non-production test identity only when explicitly configured.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(resolve(process.env.RB_BROWSER_PREFIX??'.','package.json'));
const {chromium}=require('playwright');
const origin=process.env.RB_BROWSER_URL;
assert.ok(origin,'Set RB_BROWSER_URL to the exact candidate deployment URL');
const url=new URL(origin);assert.equal(url.protocol,'https:');assert.ok(url.hostname==='rich-bizness.com'||url.hostname==='rich-bizness-mobile-app.vercel.app'||/^rich-bizness-[a-z0-9]+-rich-bizness-llc\.vercel\.app$/.test(url.hostname),'Unrecognized Rich Bizness deployment');
const expected=process.env.RB_EXPECTED_COMMIT;assert.match(expected??'',/^[a-f0-9]{40}$/);
if(process.env.RB_REQUIRE_AUTH==='1')assert.ok(process.env.RB_BROWSER_EMAIL&&process.env.RB_BROWSER_PASSWORD,'Dedicated browser-test identity secrets are not configured');
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 const page=await context.newPage(), errors=[];
 page.on('pageerror',e=>errors.push(e.name));
 const manifest=await context.request.get(new URL('/rb-section-release.json',url).href);
 assert.equal(manifest.status(),200);assert.equal((await manifest.json()).release,expected,'Wrong deployed commit');
 const visit=async(path,selector)=>{const result=await page.goto(new URL(path,url).href,{waitUntil:'domcontentloaded',timeout:30000});assert.ok(result?.ok(),'Navigation failed: '+path);await page.locator(selector).waitFor({state:'visible',timeout:30000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Horizontal overflow: '+path);};
 await visit('/','.rb-home h1');
 await visit('/tap-in.html','#authForm');
 await visit('/portal.html','#authForm');assert.match(new URL(page.url()).pathname,/tap-in/,'Private Portal must require a session');
 console.log('Real Chromium public smoke: exact commit, Home, Tap In, private Portal redirect, 390px viewport');
 if(process.env.RB_BROWSER_EMAIL&&process.env.RB_BROWSER_PASSWORD){
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
