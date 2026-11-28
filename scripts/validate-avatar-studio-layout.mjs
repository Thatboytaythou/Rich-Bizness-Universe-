import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root='apps/web/src/features/avatar/';
const source=readFileSync(root+'avatar.characters.page.ts','utf8'),css=readFileSync(root+'avatar.characters.css','utf8'),html=readFileSync('apps/web/avatar-characters.html','utf8');
const markup=source.slice(source.indexOf('root.innerHTML='),source.indexOf('  const $=<T extends HTMLElement>'));
const ids=[...markup.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,'Duplicate Studio element ID');
for(const key of ['appearance','collections','motion','quality','business','world']){assert.equal([...markup.matchAll(new RegExp('data-workspace="'+key+'"','g'))].length,1);assert.equal([...markup.matchAll(new RegExp('data-workspace-panel="'+key+'"','g'))].length,1);}
for(const id of ['acEliteView','saveCharacter','acFitStatus','acWorkspace','acCreator','acDesignPublish','acTwinReference','acClaim','acRecordStart','acStill','acShot','acProposedPrice','nameInput','auraInput','randomize','acSaveTop','acSaveEnter'])assert.ok(ids.includes(id),'Missing control '+id);
assert.match(css,/\.ac-layout\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
assert.match(css,/@media\(min-width:1100px\) and \(hover:hover\) and \(pointer:fine\)/);
assert.match(css,/@media\(any-pointer:coarse\)\{\s*body\[data-page="avatar-characters"\] \.ac-shell \.ac-layout\{grid-template-columns:minmax\(0,1fr\)/);
assert.match(html,/width=device-width,initial-scale=1,viewport-fit=cover/);
assert.ok(!html.includes('user-scalable=no'));
console.log('Avatar Studio: six workspaces, unique control IDs, mobile-first layout and viewport verified');

const graphics=readFileSync(root+'avatar.graphics.ts','utf8');
assert.match(graphics,/if\(mobile&&runtime\)\{scene.remove\(runtime.root\);disposeSkinnedAvatar\(runtime\);runtime=null/);
assert.match(graphics,/mobileFitTail=job\.then/);
assert.match(graphics,/let phoneLimit=640/);assert.match(graphics,/const limit=mobile\?phoneLimit:1920/);
assert.match(graphics,/if\(canvas.width!==width\|\|canvas.height!==height\)renderer.setSize/);
assert.match(graphics,/safe fallback \(enhanced fit unavailable\)/);
assert.match(source,/if\(!mobile&&!graphics&&!graphicsLoading\)void enable\(\)/);
assert.match(source,/onWorkspace=key=>/);
assert.ok(!html.includes('id="app" aria-live'));
console.log('Mobile stability policy: serialized fit, single mesh, bounded buffer, explicit 3D start, deferred optional reads');

import {createCinematicSky,createGroundShade,glassGradient,groundShadeMesh} from '../apps/web/src/features/avatar/avatar.cinematic.depth.ts';
const sky=createCinematicSky();assert.equal(sky.material.depthWrite,false);assert.ok(sky.geometry.attributes.position.count<400);assert.ok(sky.material.fragmentShader.includes('#include <colorspace_fragment>'));sky.geometry.dispose();sky.material.dispose();
const shade=createGroundShade(),glass=glassGradient();assert.equal(shade.image.data.length,64*64*4);assert.equal(shade.image.data[3],0);assert.ok(shade.image.data[(32*64+32)*4+3]>170);assert.equal(glass.image.data.length,16*64*4);
const plane=groundShadeMesh(shade,1.35,2.5);assert.equal(plane.material.depthWrite,false);plane.geometry.dispose();plane.material.dispose();shade.dispose();glass.dispose();
const lobby=readFileSync(root+'avatar.lobby.page.ts','utf8');assert.match(lobby,/let phoneLimit=640/);assert.match(lobby,/const limit=mobile\?phoneLimit:1440/);assert.match(lobby,/new THREE.InstancedMesh\(new THREE.PlaneGeometry\(1,1\)/);
assert.match(graphics,/renderer.shadowMap.enabled=!mobile/);
console.log('V29: bounded sky geometry, soft shade and glass textures, desktop-only shadow map, mobile buffer protection');

import {automotiveShell,foliageGeometry,weaveNormal} from '../apps/web/src/features/avatar/avatar.visual.assets.ts';
const auto=automotiveShell([[-1,.6,.2,.6],[0,.9,.2,.8],[1,.6,.2,.6]],16);
assert.equal(auto.attributes.position.count,51);assert.equal(auto.attributes.uv.count,51);assert.ok(auto.index.count>0);assert.ok(auto.attributes.normal.array.every(Number.isFinite));auto.dispose();
for(const mobile of [true,false]){const leaves=foliageGeometry(mobile);assert.equal(leaves.attributes.position.count,(mobile?100:190)*6);assert.equal(leaves.attributes.color.count,leaves.attributes.position.count);assert.ok(leaves.attributes.normal.array.every(Number.isFinite));leaves.dispose();}
const weave=weaveNormal();assert.equal(weave.image.data.length,64*64*4);assert.equal(weave.repeat.x,20);assert.ok(weave.image.data[2]>245);weave.dispose();
assert.match(lobby,/world\?\.userData\.tickFoliage\?\.\(dt\)/);assert.match(lobby,/const spokes=new THREE.InstancedMesh/);
console.log('V30: generated vehicle UVs and normals, bounded leaf geometry and woven textile map, instanced detail');

import * as THREE from 'three';
import {phoneRenderLimit,mobileDetail,smoothPlayback,phoneTriangleBudget,admitsPhoneMesh} from '../apps/web/src/features/avatar/avatar.quality.v31.ts';
import {crownChain} from '../apps/web/src/features/avatar/avatar.original.wearables.ts';
import {mergeStaticVehicle,disposeDetailedVehicle} from '../apps/web/src/features/avatar/avatar.world.vehicle.ts';
assert.equal(mobileDetail('auto'),'medium');assert.equal(mobileDetail('detail'),'medium');assert.equal(mobileDetail('auto',true),'low');assert.equal(mobileDetail('detail',true),'low');assert.equal(phoneTriangleBudget('auto'),60000);assert.equal(phoneTriangleBudget('detail'),75000);assert.ok(admitsPhoneMesh('auto',60000));assert.ok(!admitsPhoneMesh('auto',60001));assert.ok(admitsPhoneMesh('detail',75000));assert.ok(!admitsPhoneMesh('detail',75001));assert.ok(!admitsPhoneMesh('detail',NaN));console.log('V1 phone admission: adaptive 60k, enhanced 75k, medium preferred and low fallback');
assert.equal(phoneRenderLimit('detail',33,89,640),640);assert.equal(phoneRenderLimit('detail',33,90,640),688);assert.equal(phoneRenderLimit('detail',33,100,1060),1080);assert.equal(phoneRenderLimit('detail',58,100,1080),1000);assert.equal(phoneRenderLimit('auto',33,100,640),688);assert.equal(phoneRenderLimit('auto',33,100,790),800);assert.equal(phoneRenderLimit('auto',52,100,800),720);assert.equal(phoneRenderLimit('auto',37,100,720),720);assert.equal(phoneRenderLimit('detail',70,100,480),480);assert.equal(phoneRenderLimit('detail',NaN,100,1080),640);assert.match(graphics,/drawCost>24\?Math.max\(52,frameAverage\)/);
assert.ok(smoothPlayback(1,1.4,.033)>1&&smoothPlayback(1,1.4,.033)<1.4);
const chainMat=new THREE.MeshStandardMaterial(),chain=crownChain(chainMat);assert.equal(chain.count,34);assert.ok(Number.isFinite(chain.boundingSphere.radius));chain.dispose();chain.geometry.dispose();chainMat.dispose();
const sourceVehicle=new THREE.Group(),vehicleMat=new THREE.MeshStandardMaterial();for(const x of [-1,1]){const panel=new THREE.Mesh(new THREE.BoxGeometry(1.6,1.2,1.8),vehicleMat);panel.position.set(x,.6,0);sourceVehicle.add(panel);}
const mergedVehicle=mergeStaticVehicle(sourceVehicle,true);assert.equal(mergedVehicle.children.length,1);assert.equal(mergedVehicle.userData.rbVehicleTriangles,24);mergedVehicle.updateMatrixWorld(true);const vehicleBounds=new THREE.Box3().setFromObject(mergedVehicle);assert.ok(Math.abs(vehicleBounds.getSize(new THREE.Vector3()).z-3.55)<.01);assert.ok(Math.abs(vehicleBounds.min.y)<.01);disposeDetailedVehicle(mergedVehicle);sourceVehicle.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
assert.match(graphics,/fitQuality!=='detail'/);assert.match(lobby,/tryDetailedVehicle/);assert.match(source,/Enhanced • up to 75k/);
console.log('V31: mobile safe startup and enhanced limits, bounded animation rate, original chain geometry, merged vehicle fit and fallback paths verified');

assert.match(graphics,/studioFrameInterval\(mobile,drawCost,quality\)/);assert.match(source,/upperArm:'80',forearm:'60',thigh:'60'/);assert.match(source,/1\.0\.0-foundation/);

import {oneShotActive} from '../apps/web/src/features/avatar/avatar.energy.motion.ts';
import {streetVehicleBody} from '../apps/web/src/features/avatar/avatar.visual.assets.ts';
assert.equal(oneShotActive({paused:false,time:.9,getClip:()=>({duration:1})}),true);
assert.equal(oneShotActive({paused:true,time:.9,getClip:()=>({duration:1})}),false);
assert.equal(oneShotActive({paused:false,time:1,getClip:()=>({duration:1})}),false);
assert.equal(oneShotActive(null),false);
const silhouettes=[0,1,2].map(i=>streetVehicleBody(i,true));assert.notDeepEqual([...silhouettes[0].attributes.position.array],[...silhouettes[1].attributes.position.array]);assert.notDeepEqual([...silhouettes[0].attributes.position.array],[...silhouettes[2].attributes.position.array]);for(const shell of silhouettes){assert.equal(shell.attributes.position.count,136);assert.ok(shell.attributes.normal.array.every(Number.isFinite));shell.dispose();}
assert.match(lobby,/const laneDashes=new THREE.InstancedMesh/);assert.match(lobby,/renderer.setPixelRatio\(1\)/);assert.doesNotMatch(lobby,/sampleTime \+= dt/);assert.match(graphics,/oneShotActive\(runtime\?\.currentAction\)/);
console.log('V34: animation-clock completion, distinct original car silhouettes, instanced lane markings and one render resolution controller verified');

const panels={appearance:['nameInput','randomize','acTwinReference'],collections:['elite','acClaim','acOwnershipRefresh'],motion:['acShot','acStill','acRecordStart','acExpressionStrength','acMotionPick'],quality:['acQuality','acVisual','acBehavior'],business:['acDesignPublish','acProposedPrice'],world:['acJourneyLinks']};
for(const [key,controls] of Object.entries(panels)){const start=markup.indexOf('data-workspace-panel="'+key+'"');const end=markup.indexOf('data-workspace-panel="',start+22);const panel=markup.slice(start,end<0?undefined:end);for(const id of controls)assert.ok(panel.includes('id="'+id+'"'),'Missing '+key+' control '+id);}
assert.match(markup,/role="tablist"/);assert.match(markup,/role="tabpanel"/);assert.match(source,/const tab=workspaceTabs\[next\];if\(!tab\|\|!tab\.dataset\.workspace\)return;tab\.focus\(\)/);assert.ok(!source.includes("panel?.querySelectorAll<HTMLDetailsElement>('[data-category]')"));assert.match(css,/\.ac-v1-tabs\{position:sticky/);assert.match(css,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);assert.ok(!markup.includes('ELITE · V31.1'));
console.log('V1: six dedicated workspaces, unique controls, keyboard navigation, isolated style and character categories, and compact tab bar');

// No second Elite mode or nested category-tab gate. Verify every supported option
// has exactly one owner and that both wardrobe paths use the same look recipe.
assert.ok(!source.includes('data-tab="'));assert.ok(!markup.includes('Elite identity'));assert.ok(!markup.includes('data-anatomy="face" hidden'));assert.ok(!markup.includes('data-anatomy="body" hidden'));assert.match(source,/Hair, skin & grooming[^\n]+facialHair/);assert.match(source,/Body & transformation[^\n]+tattooArt/);assert.match(source,/Footwear & accessories[^\n]+eliteJewelry/);assert.match(markup,/acWardrobeCurrent/);assert.match(markup,/pickerField\('outfit'\)/);assert.match(source,/field\.hidden=field\.dataset\.optionField==='shoes'\?layered:!layered/);assert.match(source,/ownershipDetails\.addEventListener\('toggle'/);assert.match(source,/config\.look=normalizeLook/);console.log('V1 unified Studio: no nested category gate, grooming and transformation in Character, outfit and collections together, applicable footwear and deferred ownership');

const elite=readFileSync('apps/web/src/core/elite/elite-capabilities.ts','utf8');assert.match(elite,/rb_elite_choose_career/);assert.match(elite,/rb_elite_capabilities/);assert.match(elite,/virtual_cash_redemption!==false/);assert.match(elite,/grants_platform_permissions!==false/);assert.ok(!elite.includes("stripe_account_id"));assert.ok(!elite.includes("service_role"));assert.match(readFileSync('apps/web/src/pages/creator/creator.page.ts','utf8'),/mountEliteCapabilities/);assert.match(readFileSync('apps/web/src/pages/meta/meta.page.ts','utf8'),/mountEliteCapabilities/);console.log('V1 unified Elite capability panel, server progression and separate read-only real commerce');

import {renderScheduler,boundedCanvasPixels} from '../apps/web/src/core/experience/render-scheduler.ts';
let frameId=0,drawn=0;const queued=new Map();
const scheduler=renderScheduler(()=>drawn++,cb=>{queued.set(++frameId,cb);return frameId;},id=>queued.delete(id));
const tick=()=>{const next=queued.entries().next().value;assert.ok(next);queued.delete(next[0]);next[1](100);};
scheduler.setVisible(true);scheduler.setVisible(true);assert.equal(queued.size,1);tick();assert.equal(drawn,1);assert.equal(queued.size,1);scheduler.setVisible(false);assert.equal(queued.size,0);scheduler.setVisible(true);tick();assert.equal(drawn,2);scheduler.stop();scheduler.setVisible(true);assert.equal(queued.size,0);
for(const [w,h,dpr] of [[390,390,3],[430,932,3],[1920,1080,2]]){const b=boundedCanvasPixels(w,h,dpr,900000,1080);assert.ok(b.width*b.height<=900000);assert.ok(Math.max(b.width,b.height)<=1080);}
assert.deepEqual(boundedCanvasPixels(0,0,3,900000,1080),{width:1,height:1,scale:1});assert.match(lobby,/stopFrames=frames.stop/);assert.match(lobby,/!document.hidden&&worldVisible/);assert.match(lobby,/graphicsFailed=true;stopFrames/);
console.log('Maximum Evolution render lifecycle: single frame, hidden/offscreen stop, terminal failure, bounded pixel allocations');
