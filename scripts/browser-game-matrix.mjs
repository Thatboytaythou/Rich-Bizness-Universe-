// Actual built game surfaces, not just network reachability. No real accounts or network writes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createReadStream,statSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
import {GAMES} from '../packages/config/src/games.ts';
const {chromium}=createRequire(resolve(process.env.RB_BROWSER_PREFIX??'.','package.json'))('playwright');
const dist=resolve('apps/web/dist'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json','.glb':'model/gltf-binary','.woff2':'font/woff2'};
const server=createServer((req,res)=>{try{const path=resolve(dist,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));if(!path.startsWith(dist+sep)||!statSync(path).isFile())throw Error('missing');res.writeHead(200,{'Content-Type':types[extname(path)]??'application/octet-stream'});createReadStream(path).pipe(res);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
let browser;const results=[];
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 assert.equal(GAMES.length,28);
 for(let start=0;start<GAMES.length;start+=3)await Promise.all(GAMES.slice(start,start+3).map(async game=>{
  const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const errors=[];try{
   await ctx.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
   const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message.slice(0,180)));
   const response=await p.goto(origin+'/'+game.slug+'.html',{waitUntil:'domcontentloaded',timeout:15000});assert.ok(response?.ok(),'HTML unavailable');
   await p.locator('#app h1').first().waitFor({state:'visible',timeout:15000});
   const evidence=await p.evaluate(()=>({page:document.body.dataset.page,heading:document.querySelector('#app h1')?.textContent,controls:[...document.querySelectorAll('#app button,#app select,#app [role=button]')].filter(x=>x.getBoundingClientRect().width>0).length,canvas:[...document.querySelectorAll('#app canvas')].filter(c=>c.width>0&&c.height>0).length,overflow:document.documentElement.scrollWidth-innerWidth}));
   assert.equal(evidence.page,game.slug,'wrong game owner');assert.ok(evidence.heading?.trim(),'heading missing');assert.ok(evidence.controls>0||evidence.canvas>0,'game surface has no controls or canvas');assert.ok(evidence.overflow<=2,'mobile overflow '+evidence.overflow);assert.deepEqual(errors,[],'uncaught JavaScript error');
   results.push({slug:game.slug,passed:true,...evidence});
  }catch(e){results.push({slug:game.slug,passed:false,error:String(e.message).slice(0,250),errors});}finally{await ctx.close();}
 }));
 console.log('Real Chromium game matrix: '+results.filter(x=>x.passed).length+'/28 mounted game surfaces');for(const result of results.sort((a,b)=>a.slug.localeCompare(b.slug)))console.log(JSON.stringify(result));assert.equal(results.filter(x=>x.passed).length,28,'game mount regression');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
