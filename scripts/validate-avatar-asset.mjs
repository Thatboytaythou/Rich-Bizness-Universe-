// Offline admission check for actual, self-contained GLB character assets.
// Usage: node scripts/validate-avatar-asset.mjs path/to/model.glb
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const path=process.argv[2];if(!path)throw Error('Supply a GLB file');
const b=readFileSync(path);
if(b.length<20||b.readUInt32LE(0)!==0x46546c67||b.readUInt32LE(4)!==2||b.readUInt32LE(8)!==b.length)throw Error('Invalid GLB v2 container');
const n=b.readUInt32LE(12);if(n<2||20+n>b.length||b.readUInt32LE(16)!==0x4e4f534a)throw Error('Missing GLB JSON chunk');
const gltf=JSON.parse(b.subarray(20,20+n).toString('utf8').trim());
const errors=[];
const clips=(gltf.animations??[]).map(a=>String(a.name??'').toLowerCase());
const jointCount=Math.max(0,...(gltf.skins??[]).map(s=>s.joints?.length??0));
let triangles=0,skinnedNodes=0;
for(const node of gltf.nodes??[]){if(node.skin===undefined||node.mesh===undefined)continue;skinnedNodes++;for(const prim of gltf.meshes?.[node.mesh]?.primitives??[]){if(prim.attributes?.JOINTS_0===undefined||prim.attributes?.WEIGHTS_0===undefined)errors.push('Skinned primitive missing joint weights');if((prim.mode??4)!==4)errors.push('Use triangulated primitives');const count=gltf.accessors?.[prim.indices??prim.attributes?.POSITION]?.count??0;triangles+=Math.floor(count/3);}}
if(!skinnedNodes||jointCount<20)errors.push('Expected skinned humanoid with at least 20 joints');
if(!triangles||triangles>65000)errors.push('Mobile LOD must contain 1–65,000 skinned triangles');
if(b.length>8*1024*1024)errors.push('Mobile GLB exceeds 8 MiB');
for(const [motion,regex] of Object.entries({idle:/idle|stand|breath/,walk:/walk/,run:/run|sprint/,jump:/jump/,pose:/pose|wave|gesture|power/}))if(!clips.some(c=>regex.test(c)))errors.push('Missing '+motion+' animation');
if((gltf.buffers??[]).some(x=>x.uri&&!x.uri.startsWith('data:'))||(gltf.images??[]).some(x=>x.uri&&!x.uri.startsWith('data:')))errors.push('Use self-contained textures and buffers');
if(!(gltf.images??[]).length)errors.push('Expected authored texture maps');
const result={path,sha256:createHash('sha256').update(b).digest('hex'),bytes:b.length,skinnedNodes,jointCount,triangles,clips,errors,technicalPass:errors.length===0,visualApproval:false,licenseApproval:false};
console.log(JSON.stringify(result,null,2));if(errors.length)process.exitCode=1;
