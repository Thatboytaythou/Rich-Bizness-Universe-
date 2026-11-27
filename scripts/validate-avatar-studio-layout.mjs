import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root='apps/web/src/features/avatar/';
const source=readFileSync(root+'avatar.characters.page.ts','utf8'),css=readFileSync(root+'avatar.characters.css','utf8'),html=readFileSync('apps/web/avatar-characters.html','utf8');
const markup=source.slice(source.indexOf('root.innerHTML='),source.indexOf('  const $=<T extends HTMLElement>'));
const ids=[...markup.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,'Duplicate Studio element ID');
for(const key of ['appearance','collections','motion','business']){assert.equal([...markup.matchAll(new RegExp('data-workspace="'+key+'"','g'))].length,1);assert.equal([...markup.matchAll(new RegExp('data-workspace-panel="'+key+'"','g'))].length,1);}
for(const id of ['acEliteView','saveCharacter','acFitStatus','acWorkspace','acCreator','acDesignPublish','acTwinReference','acClaim','acRecordStart','acStill','acShot','acProposedPrice','nameInput','auraInput','randomize','acSaveTop','acSaveEnter'])assert.ok(ids.includes(id),'Missing control '+id);
assert.match(css,/\.ac-layout\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
assert.match(css,/@media\(min-width:1100px\) and \(hover:hover\) and \(pointer:fine\)/);
assert.match(css,/@media\(any-pointer:coarse\)\{\s*body\[data-page="avatar-characters"\] \.ac-shell \.ac-layout\{grid-template-columns:minmax\(0,1fr\)/);
assert.match(html,/width=device-width,initial-scale=1,viewport-fit=cover/);
assert.ok(!html.includes('user-scalable=no'));
console.log('Avatar Studio: four workspaces, unique control IDs, mobile-first layout and viewport verified');

const graphics=readFileSync(root+'avatar.graphics.ts','utf8');
assert.match(graphics,/if\(mobile&&runtime\)\{scene.remove\(runtime.root\);disposeSkinnedAvatar\(runtime\);runtime=null/);
assert.match(graphics,/mobileFitTail=job\.then/);
assert.match(graphics,/const limit=mobile\?640:1600/);
assert.match(graphics,/if\(canvas.width!==width\|\|canvas.height!==height\)renderer.setSize/);
assert.match(graphics,/if\(mobile\)value='auto'/);
assert.match(source,/if\(!mobile&&!graphics&&!graphicsLoading\)void enable\(\)/);
assert.match(source,/onWorkspace=key=>/);
assert.ok(!html.includes('id="app" aria-live'));
console.log('Mobile stability policy: serialized fit, single mesh, bounded buffer, explicit 3D start, deferred optional reads');

import {createCinematicSky,createGroundShade,glassGradient,groundShadeMesh} from '../apps/web/src/features/avatar/avatar.cinematic.depth.ts';
const sky=createCinematicSky();assert.equal(sky.material.depthWrite,false);assert.ok(sky.geometry.attributes.position.count<400);assert.ok(sky.material.fragmentShader.includes('#include <colorspace_fragment>'));sky.geometry.dispose();sky.material.dispose();
const shade=createGroundShade(),glass=glassGradient();assert.equal(shade.image.data.length,64*64*4);assert.equal(shade.image.data[3],0);assert.ok(shade.image.data[(32*64+32)*4+3]>170);assert.equal(glass.image.data.length,16*64*4);
const plane=groundShadeMesh(shade,1.35,2.5);assert.equal(plane.material.depthWrite,false);plane.geometry.dispose();plane.material.dispose();shade.dispose();glass.dispose();
const lobby=readFileSync(root+'avatar.lobby.page.ts','utf8');assert.match(lobby,/const limit=mobile\?640:1440/);assert.match(lobby,/new THREE.InstancedMesh\(new THREE.PlaneGeometry\(1,1\)/);
assert.match(graphics,/renderer.shadowMap.enabled=!mobile/);
console.log('V29: bounded sky geometry, soft shade and glass textures, desktop-only shadow map, mobile buffer protection');

import {automotiveShell,foliageGeometry,weaveNormal} from '../apps/web/src/features/avatar/avatar.visual.assets.ts';
const auto=automotiveShell([[-1,.6,.2,.6],[0,.9,.2,.8],[1,.6,.2,.6]],16);
assert.equal(auto.attributes.position.count,51);assert.equal(auto.attributes.uv.count,51);assert.ok(auto.index.count>0);assert.ok(auto.attributes.normal.array.every(Number.isFinite));auto.dispose();
for(const mobile of [true,false]){const leaves=foliageGeometry(mobile);assert.equal(leaves.attributes.position.count,(mobile?100:190)*6);assert.equal(leaves.attributes.color.count,leaves.attributes.position.count);assert.ok(leaves.attributes.normal.array.every(Number.isFinite));leaves.dispose();}
const weave=weaveNormal();assert.equal(weave.image.data.length,64*64*4);assert.equal(weave.repeat.x,20);assert.ok(weave.image.data[2]>245);weave.dispose();
assert.match(lobby,/world\?\.userData\.tickFoliage\?\.\(dt\)/);assert.match(lobby,/const spokes=new THREE.InstancedMesh/);
console.log('V30: generated vehicle UVs and normals, bounded leaf geometry and woven textile map, instanced detail');
