// Real two-browser WebRTC transport, isolated self-hosted LiveKit, synthetic video only.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {AccessToken} from 'livekit-server-sdk';
import {build} from 'esbuild';
const require=createRequire(resolve(process.env.RB_BROWSER_PREFIX??'.','package.json'));
const {chromium}=require('playwright');
const url='ws://127.0.0.1:7880';
const bundle=(await build({stdin:{contents:"import * as LK from 'livekit-client';window.LK=LK;",resolveDir:resolve('apps/web')},bundle:true,write:false,platform:'browser',format:'iife',logLevel:'silent'})).outputFiles[0].text;
const server=createServer((req,res)=>{if(req.url==='/sdk.js'){res.writeHead(200,{'Content-Type':'application/javascript'});res.end(bundle);}else{res.writeHead(200,{'Content-Type':'text/html'});res.end('<html><body><script src="/sdk.js"></script></body></html>');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
let browser;
async function token(identity){const t=new AccessToken('devkey','secret',{identity,ttl:'3m'});t.addGrant({roomJoin:true,room:'rb-local-media-test',canPublish:true,canSubscribe:true,canPublishData:false});return t.toJwt();}
try{
 browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required','--disable-features=WebRtcHideLocalIpsWithMdns']});
 const pages=await Promise.all([browser.newPage(),browser.newPage()]);
 for(let i=0;i<2;i++){
  const page=pages[i];await page.goto(origin);await page.waitForFunction(()=>!!window.LK);
  await page.evaluate(async({url,token})=>{const {Room,RoomEvent}=window.LK;window.room=new Room({adaptiveStream:false,dynacast:false});window.room.on(RoomEvent.TrackSubscribed,(track,_publication,participant)=>{if(track.kind==='video'){const v=track.attach();v.autoplay=true;v.muted=true;v.playsInline=true;v.dataset.peer=participant.identity;document.body.append(v);void v.play().catch(()=>{});}});await window.room.connect(url,token,{rtcConfig:{iceServers:[]}});},{url,token:await token('fixture-'+i)});
 }
 for(let i=0;i<2;i++)await pages[i].evaluate(async i=>{const canvas=document.createElement('canvas');canvas.width=160;canvas.height=120;const ctx=canvas.getContext('2d');const draw=()=>{ctx.fillStyle=i?'rgb(20,190,40)':'rgb(200,30,40)';ctx.fillRect(0,0,160,120);};draw();window.drawTimer=setInterval(draw,50);window.localTrack=canvas.captureStream(20).getVideoTracks()[0];await window.room.localParticipant.publishTrack(window.localTrack,{source:window.LK.Track.Source.Camera,simulcast:false});},i);
 for(let i=0;i<2;i++){
  await pages[i].waitForFunction(peer=>{const v=document.querySelector('video[data-peer="'+peer+'"]');return v&&v.videoWidth>0&&v.readyState>=2;},'fixture-'+(1-i),{timeout:30000});
  const pixel=await pages[i].evaluate(()=>{const v=document.querySelector('video[data-peer]'),c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');ctx.drawImage(v,0,0,1,1);return Array.from(ctx.getImageData(0,0,1,1).data);});
  assert.ok(i===0?pixel[1]>pixel[0]+50:pixel[0]>pixel[1]+50,'Remote decoded color must match the other participant');
 }
 for(const p of pages)await p.evaluate(async()=>{clearInterval(window.drawTimer);window.localTrack.stop();await window.room.disconnect();});
 console.log('Real isolated LiveKit transport PASS: two independent Chromium participants, bidirectional published/decoded video, explicit disconnect.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
