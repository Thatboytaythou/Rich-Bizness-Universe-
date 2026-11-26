import {aegisGeometry,crownGeometry} from '../apps/web/src/features/avatar/avatar.original.wearables.ts';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const out='apps/web/public/character-assets';mkdirSync(out,{recursive:true});
const reports=[];
for(const [name,geometry,color] of [['rb-aegis-wing',aegisGeometry(),[.63,.52,.29]],['rb-crown-sigil',crownGeometry(),[.75,.53,.18]]]){
 const g=geometry.index?geometry.toNonIndexed():geometry;const p=g.getAttribute('position'),n=g.getAttribute('normal');
 assert.ok(p.count>100&&p.count%3===0&&n.count===p.count);assert.ok([...p.array,...n.array].every(Number.isFinite));
 g.computeBoundingBox();const a=Buffer.from(p.array.buffer,p.array.byteOffset,p.array.byteLength),b=Buffer.from(n.array.buffer,n.array.byteOffset,n.array.byteLength),bin=Buffer.concat([a,b]);
 const json={asset:{version:'2.0',generator:'Rich Bizness original wearable geometry V25'},scene:0,scenes:[{nodes:[0]}],nodes:[{name,mesh:0}],meshes:[{name,primitives:[{attributes:{POSITION:0,NORMAL:1},material:0,mode:4}]}],materials:[{name,pbrMetallicRoughness:{baseColorFactor:[...color,1],metallicFactor:.7,roughnessFactor:.27},doubleSided:true}],buffers:[{byteLength:bin.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:a.length,target:34962},{buffer:0,byteOffset:a.length,byteLength:b.length,target:34962}],accessors:[{bufferView:0,componentType:5126,count:p.count,type:'VEC3',min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()},{bufferView:1,componentType:5126,count:n.count,type:'VEC3'}]};
 let j=Buffer.from(JSON.stringify(json));j=Buffer.concat([j,Buffer.alloc((4-j.length%4)%4,32)]);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+j.length+8+bin.length,8);header.writeUInt32LE(j.length,12);header.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004e4942,4);const glb=Buffer.concat([header,j,bh,bin]);assert.equal(glb.length,header.readUInt32LE(8));
 writeFileSync(out+'/'+name+'.glb',glb);reports.push({name,triangles:p.count/3,bytes:glb.length,sha256:createHash('sha256').update(glb).digest('hex')});if(g!==geometry)g.dispose();geometry.dispose();
}
writeFileSync(out+'/original-wearables.json',JSON.stringify({release:'V25',models:reports},null,2));console.log('RB original wearables exported: '+JSON.stringify(reports));
