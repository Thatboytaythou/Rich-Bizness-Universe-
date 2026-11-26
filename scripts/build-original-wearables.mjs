import {aegisGeometry,crownGeometry,regaliaGeometry,regaliaTextile} from '../apps/web/src/features/avatar/avatar.original.wearables.ts';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
const out='apps/web/public/character-assets';mkdirSync(out,{recursive:true});
const reports=[];
function png(data,size){
 const crc=(bytes)=>{let c=0xffffffff;for(const v of bytes){c^=v;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
 const chunk=(name,data)=>{const type=Buffer.from(name),len=Buffer.alloc(4),sum=Buffer.alloc(4);len.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([len,type,data,sum]);};
 const h=Buffer.alloc(13);h.writeUInt32BE(size,0);h.writeUInt32BE(size,4);h[8]=8;h[9]=6;const raw=Buffer.alloc(size*(size*4+1));for(let y=0;y<size;y++)Buffer.from(data.subarray(y*size*4,(y+1)*size*4)).copy(raw,y*(size*4+1)+1);
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
for(const [name,geometry,color,style] of [['rb-aegis-wing',aegisGeometry(),[.63,.52,.29]],['rb-crown-sigil',crownGeometry(),[.75,.53,.18]],['rb-regalia-emerald',regaliaGeometry(),[1,1,1],'emerald'],['rb-regalia-obsidian',regaliaGeometry(),[1,1,1],'obsidian']]){
 const g=geometry.index?geometry.toNonIndexed():geometry;const p=g.getAttribute('position'),n=g.getAttribute('normal');
 assert.ok(p.count>100&&p.count%3===0&&n.count===p.count);assert.ok([...p.array,...n.array].every(Number.isFinite));
 g.computeBoundingBox();const a=Buffer.from(p.array.buffer,p.array.byteOffset,p.array.byteLength),b=Buffer.from(n.array.buffer,n.array.byteOffset,n.array.byteLength);let bin=Buffer.concat([a,b]);
 const json={asset:{version:'2.0',generator:'Rich Bizness original wearable geometry V26'},scene:0,scenes:[{nodes:[0]}],nodes:[{name,mesh:0}],meshes:[{name,primitives:[{attributes:{POSITION:0,NORMAL:1},material:0,mode:4}]}],materials:[{name,pbrMetallicRoughness:{baseColorFactor:[...color,1],metallicFactor:.7,roughnessFactor:.27},doubleSided:true}],buffers:[{byteLength:bin.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:a.length,target:34962},{buffer:0,byteOffset:a.length,byteLength:b.length,target:34962}],accessors:[{bufferView:0,componentType:5126,count:p.count,type:'VEC3',min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()},{bufferView:1,componentType:5126,count:n.count,type:'VEC3'}]};
 if(style){const uv=g.getAttribute('uv');assert.ok(uv&&uv.count===p.count);const u=Buffer.from(uv.array.buffer,uv.array.byteOffset,uv.array.byteLength);const image=png(regaliaTextile(style),128);writeFileSync(out+'/'+name+'.png',image);const uvOffset=bin.length,imageOffset=uvOffset+u.length;bin=Buffer.concat([bin,u,image,Buffer.alloc((4-image.length%4)%4)]);json.buffers[0].byteLength=bin.length;json.bufferViews.push({buffer:0,byteOffset:uvOffset,byteLength:u.length,target:34962},{buffer:0,byteOffset:imageOffset,byteLength:image.length});json.accessors.push({bufferView:2,componentType:5126,count:uv.count,type:'VEC2'});json.meshes[0].primitives[0].attributes.TEXCOORD_0=2;json.images=[{bufferView:3,mimeType:'image/png'}];json.textures=[{source:0}];json.materials[0].pbrMetallicRoughness.baseColorTexture={index:0};json.materials[0].pbrMetallicRoughness.metallicFactor=.22;json.materials[0].pbrMetallicRoughness.roughnessFactor=.53;}
 let j=Buffer.from(JSON.stringify(json));j=Buffer.concat([j,Buffer.alloc((4-j.length%4)%4,32)]);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+j.length+8+bin.length,8);header.writeUInt32LE(j.length,12);header.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004e4942,4);const glb=Buffer.concat([header,j,bh,bin]);assert.equal(glb.length,header.readUInt32LE(8));
 writeFileSync(out+'/'+name+'.glb',glb);reports.push({name,triangles:p.count/3,bytes:glb.length,sha256:createHash('sha256').update(glb).digest('hex')});if(g!==geometry)g.dispose();geometry.dispose();
}
writeFileSync(out+'/original-wearables.json',JSON.stringify({release:'V26',models:reports},null,2));console.log('RB original wearables exported: '+JSON.stringify(reports));
