// Real Chromium runs the actual Messages module against isolated mock RPCs.
// No real sessions, private data, storage uploads or production writes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(resolve(process.env.RB_BROWSER_PREFIX??'.','package.json'));
const {chromium}=require('playwright'),ts=require('typescript');
const dir='apps/web/src/features/communications/';
const src=ts.transpileModule(readFileSync(dir+'messages.page.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/import .*?from ['"][^'"]*auth-store['"];?/,"import {getAuthSnapshot} from '/mock';").replace(/import .*?from ['"][^'"]*supabase\/client['"];?/,"import {supabase} from '/mock';").replace(/import .*?from ['"][^'"]*config\/routes['"];?/,"import {ROUTES} from '/mock';").replace(/import ['"]\.\/[^'"]+\.css['"];?/g,'');
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',U='11111111-1111-4111-8111-111111111111';
const mock=`
const A='${A}',B='${B}',U='${U}';
export const getAuthSnapshot=()=>({user:{id:U},ready:true,session:{user:{id:U}}});
export const ROUTES={portal:'/portal.html',notifications:'/notifications.html',settings:'/settings.html',messages:'/messages.html'};
const callbacks=new Map();window.mockCalls=[];window.mockReject=false;
const messages={[A]:[{id:'msg-a',thread_id:A,sender_id:U,display_name:'Fixture',body:'Original message',media_url:'https://example.invalid/storage/v1/object/public/general-uploads/private.png',media_type:'image/png',created_at:'2026-11-27T12:00:00Z'}],[B]:[{id:'msg-b',thread_id:B,sender_id:U,display_name:'Fixture',body:'Second thread',created_at:'2026-11-27T12:00:00Z'}]};
window.mockEmit=(thread)=>{for(const [name,c] of callbacks){if(name.endsWith(thread))for(const fn of c)fn();}};
export const supabase={channel(name){const c=[];callbacks.set(name,c);return {name,on(_event,_filter,fn){c.push(fn);return this;},subscribe(fn){if(fn)queueMicrotask(()=>fn('SUBSCRIBED'));return this;}};},removeChannel(c){callbacks.delete(c.name);return Promise.resolve();},async rpc(name,p={}){window.mockCalls.push(name);const ok=data=>({data,error:null});if(name==='rb_dm_threads_snapshot')return ok({threads:[{id:A,title:'First conversation',unread_count:1},{id:A,title:'First conversation',unread_count:1},{id:B,title:'Second conversation',unread_count:0}]});if(name==='rb_dm_thread_snapshot'){if(window.mockReject)return {data:null,error:{message:'unavailable'}};const id=p.p_thread_id;return ok({thread:{id,title:id===A?'First conversation':'Second conversation'},messages:[...messages[id],...messages[id]],typing:[],reactions:[]});}if(name==='rb_dm_send_message'){await new Promise(r=>setTimeout(r,80));messages[p.p_thread_id].push({id:'sent-'+messages[p.p_thread_id].length,thread_id:p.p_thread_id,sender_id:U,body:p.p_body,created_at:'2026-11-27T12:01:00Z'});window.mockEmit(p.p_thread_id);return ok('sent');}return ok(true);}};
`;
const html='<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/base.css"><link rel="stylesheet" href="/messages.css"></head><body data-page="messages"><div id="app" data-page-owner="rich-bizness-messages-v3" data-page-epoch="1"></div><script type="module">import {mount} from "/messages";mount();</script></body></html>';
const server=createServer((req,res)=>{const p=new URL(req.url,'http://127.0.0.1').pathname;let body,type='text/javascript';if(p==='/'||p==='/messages.html'){body=html;type='text/html';}else if(p==='/messages')body=src;else if(p==='/mock')body=mock;else if(p==='/base.css'){body=readFileSync(dir+'communications.css');type='text/css';}else if(p==='/messages.css'){body=readFileSync(dir+'messages-universe.css');type='text/css';}else{res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':type});res.end(body);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser;
try{
 browser=await chromium.launch({headless:true});
 for(const width of [390,820]){
  const page=await browser.newPage({viewport:{width,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await page.goto(origin+'/?thread='+A);await page.waitForSelector('#messageInput');assert.equal(await page.locator('[data-thread]').count(),2);assert.equal(await page.locator('[data-message]').count(),1);assert.equal(await page.locator('#attachButton').isDisabled(),true);assert.equal(await page.locator('a[href*="general-uploads"]').count(),0);
  await page.locator('#messageInput').fill('Unsent draft');const before=await page.evaluate(()=>window.mockCalls.filter(n=>n==='rb_dm_thread_snapshot').length);await page.evaluate(a=>window.mockEmit(a),A);await page.waitForFunction(n=>window.mockCalls.filter(x=>x==='rb_dm_thread_snapshot').length>n,before);await page.waitForFunction(()=>document.querySelector('#messageInput')?.value==='Unsent draft');
  await page.locator('[data-thread="'+B+'"]').click();await page.waitForFunction(()=>document.querySelector('#messageFeed')?.textContent.includes('Second thread'));assert.equal(await page.locator('#messageInput').inputValue(),'');await page.locator('[data-thread="'+A+'"]').click();await page.waitForFunction(()=>document.querySelector('#messageFeed')?.textContent.includes('Original message'));assert.equal(await page.locator('#messageInput').inputValue(),'Unsent draft');
  await page.evaluate(()=>{const form=document.querySelector('#composer');form.requestSubmit();form.requestSubmit();});await page.waitForFunction(()=>document.querySelector('#messageFeed')?.textContent.includes('Unsent draft'));assert.equal(await page.evaluate(()=>window.mockCalls.filter(n=>n==='rb_dm_send_message').length),1);assert.equal(await page.locator('#messageInput').inputValue(),'');
  await page.locator('#audioCall').click();assert.equal(await page.evaluate(()=>window.mockCalls.filter(n=>n==='rb_dm_start_call').length),0);
  await page.evaluate(a=>{window.mockReject=true;window.mockEmit(a);},A);await page.waitForFunction(()=>document.querySelector('#threadPanel')?.textContent.includes('Conversation unavailable'));assert.equal(await page.locator('#composer').count(),0);assert.deepEqual(errors,[]);await page.close();console.log('Real Chromium Rich-DM fixture PASS: '+width+'px; duplicate rows, drafts, thread switch, single send, public attachment block, fail-closed membership.');
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
