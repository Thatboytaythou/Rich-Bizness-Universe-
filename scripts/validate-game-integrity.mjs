import assert from 'node:assert/strict';
import {emptyBoard,parseBoard,dropDisc,winningLine,chooseColumn,validColumns} from '../apps/web/src/pages/games/connect-four.engine.ts';
const board=emptyBoard();assert.deepEqual(validColumns(board),[0,1,2,3,4,5,6]);assert.equal(dropDisc(board,-1,1),-1);assert.equal(dropDisc(board,8,1),-1);assert.equal(dropDisc(board,NaN,1),-1);assert.equal(dropDisc(board,0,1),5);assert.equal(dropDisc(board,0,2),4);assert.deepEqual(parseBoard(board),board);assert.equal(parseBoard([[1]]),null);const floating=emptyBoard();floating[0][0]=1;assert.equal(parseBoard(floating),null);const winning=emptyBoard();for(let c=0;c<3;c++)dropDisc(winning,c,2);assert.equal(chooseColumn(winning,5),3);dropDisc(winning,3,2);assert.equal(winningLine(winning).player,2);const blocking=emptyBoard();for(let c=0;c<3;c++)dropDisc(blocking,c,1);assert.equal(chooseColumn(blocking,3),3);console.log('V1 Connect Four: board startup, gravity, invalid inputs, win detection and AI defense verified');
// Simulate duplicate frame requests, heartbeat replacement and exit cleanup.
import {createArcadeLifecycle,escapeGameText} from '../apps/web/src/pages/games/arcade-lifecycle.ts';
let seq=0;const frames=new Map(),repeats=new Map();
globalThis.requestAnimationFrame=fn=>{frames.set(++seq,fn);return seq;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
globalThis.window={setInterval:fn=>{repeats.set(++seq,fn);return seq;},clearInterval:id=>repeats.delete(id)};globalThis.document={hidden:false};
const arcade=createArcadeLifecycle();arcade.frame(()=>{});arcade.frame(()=>{});assert.equal(frames.size,1);arcade.repeat(()=>{},100);arcade.repeat(()=>{},100);assert.equal(repeats.size,1);arcade.dispose();assert.equal(frames.size,0);assert.equal(repeats.size,0);arcade.frame(()=>{});assert.equal(frames.size,0);assert.equal(escapeGameText('<img>'),'&lt;img&gt;');delete globalThis.window;delete globalThis.document;delete globalThis.requestAnimationFrame;delete globalThis.cancelAnimationFrame;
console.log('V1 arcade owner: one animation frame, one heartbeat, escaped text, idempotent exit cleanup');

import {readFileSync} from 'node:fs';
import {GAMES} from '../packages/config/src/games.ts';
import {metalSphere,metalPanel,arenaLight} from '../apps/web/src/pages/games/arcade-cinematic.ts';
const paintCalls=[];const stops=[];const gradient={addColorStop:(offset,color)=>{assert.ok(offset>=0&&offset<=1);assert.equal(typeof color,'string');stops.push(offset);}};
const ctx={createRadialGradient:(...v)=>{assert.ok(v.every(Number.isFinite));return gradient;},createLinearGradient:(...v)=>{assert.ok(v.every(Number.isFinite));return gradient;},beginPath:()=>{},arc:(...v)=>{assert.ok(v.every(Number.isFinite));paintCalls.push('arc');},fill:()=>paintCalls.push('fill'),fillRect:(...v)=>{assert.ok(v.every(Number.isFinite));paintCalls.push('rect');}};
metalSphere(ctx,5,5,3,'#ffd080');metalPanel(ctx,1,1,8,5,'#33bb77');arenaLight(ctx,640,480,'rgba(40,100,90,.2)');const prior=paintCalls.length;metalSphere(ctx,5,5,-1,'#fff');metalPanel(ctx,0,0,0,1,'#fff');arenaLight(ctx,0,1,'#fff');assert.equal(paintCalls.length,prior);assert.ok(stops.length>=10);assert.deepEqual(paintCalls,['arc','fill','rect','rect']);
const materials=readFileSync('apps/web/src/styles/beyond-cinematic.css','utf8');
let dom=0,canvas=0;
for(const game of GAMES){const html=readFileSync('apps/web/'+game.slug+'.html','utf8');const entry=html.match(/src="\/src\/([^"]+\.ts)"/)?.[1];assert.ok(entry,'Missing game entry '+game.slug);const source=readFileSync('apps/web/src/'+entry,'utf8');if(source.includes('arcade-cinematic'))canvas++;else{assert.ok(materials.includes('data-page="'+game.slug+'"][data-rb-visual]'),'Missing game material '+game.slug);dom++;}}
assert.equal(dom+canvas,28);assert.equal(canvas,13);assert.equal(dom,15);
console.log('Beyond HD gameplay render contract: '+canvas+' canvas renderers, '+dom+' individual DOM material treatments; paint helpers checked');
