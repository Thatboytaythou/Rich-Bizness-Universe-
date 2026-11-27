import {mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
const out='apps/web/public/world-models';mkdirSync(out,{recursive:true});
const file='spectral-gt-rs.glb',url='https://raw.githubusercontent.com/JaronKBragg7337/spectral-gt-rs/34499c501908818a2b08e589a7aecf963343cee7/spectral_gt_rs_game_ready.glb',expected='f5b814848453a6c75a48f5047fdadaa7bdc78969';
const report={release:'V31',available:false,asset:file,source:url,gitBlob:expected,license:'CC0-1.0',creator:'JaronKBragg7337'};
try{
 const response=await fetch(url,{signal:AbortSignal.timeout(18000),redirect:'error'});if(!response.ok)throw Error('upstream HTTP '+response.status);
 const len=Number(response.headers.get('content-length')??0);if(len>6_000_000)throw Error('download exceeds 6 MB');
 const reader=response.body.getReader(),chunks=[];let total=0;
 while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>6_000_000){await reader.cancel();throw Error('download exceeds 6 MB');}chunks.push(Buffer.from(value));}
 const bytes=Buffer.concat(chunks);
 if(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')!==expected)throw Error('pinned blob integrity mismatch');
 if(bytes.length<24||bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length||bytes.readUInt32LE(16)!==0x4e4f534a)throw Error('invalid GLB header');
 const jsonLength=bytes.readUInt32LE(12);if(jsonLength+20>bytes.length)throw Error('invalid GLB chunk');
 const j=JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8'));
 if(j.buffers?.some(b=>b.uri)||j.images?.some(i=>i.uri)||j.skins?.length||j.extensionsRequired?.length)throw Error('external or unsupported asset resources');
 let triangles=0,primitives=0;for(const node of j.nodes??[]){if(node.mesh===undefined)continue;for(const p of j.meshes[node.mesh].primitives){if((p.mode??4)!==4)throw Error('non-triangle vehicle primitive');const count=j.accessors[p.indices??p.attributes.POSITION].count;if(!Number.isInteger(count)||count%3)throw Error('invalid triangle count');triangles+=count/3;primitives++;}}
 if(!triangles||triangles>240000||primitives>600)throw Error('asset exceeds static world budget: '+triangles+' triangles / '+primitives+' primitives');
 const embeddedImageBytes=(j.images??[]).reduce((sum,img)=>sum+(j.bufferViews?.[img.bufferView]?.byteLength??0),0);if(embeddedImageBytes>3_000_000)throw Error('embedded image budget exceeded');
 Object.assign(report,{available:true,bytes:bytes.length,triangles,primitives,embeddedImageBytes,mobileEligible:triangles<=85000&&embeddedImageBytes<=1_500_000});
 writeFileSync(out+'/'+file,bytes);
}catch(e){rmSync(out+'/'+file,{force:true});report.reason=e instanceof Error?e.message:String(e);}
writeFileSync(out+'/manifest.json',JSON.stringify(report,null,2));console.log('V31 verified vehicle admission: '+JSON.stringify(report));
