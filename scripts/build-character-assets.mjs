import {cpSync,existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync,rmSync,mkdtempSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {hdRecipe,HD_CLIPS,HD_VERSION} from '../apps/web/src/features/avatar/avatar.hd.recipe.ts';
const root=process.cwd(),data=[resolve(root,'node_modules/ara3d-data/assets'),resolve(root,'apps/web/node_modules/ara3d-data/assets')].find(existsSync);
assert.ok(data,'Pinned Ara character data is missing');
const cli=[resolve(root,'node_modules/ara3d/dist/cli.js'),resolve(root,'apps/web/node_modules/ara3d/dist/cli.js')].find(existsSync);
assert.ok(cli,'Pinned Ara exporter is missing');
const dest=resolve(root,'apps/web/public/character-assets'),temp=mkdtempSync(join(tmpdir(),'rb-hd-'));
mkdirSync(dest,{recursive:true});const assetDir=join(dest,'ara-1.2.0');rmSync(assetDir,{recursive:true,force:true});cpSync(data,assetDir,{recursive:true});
const reports=[];
try{
 for(const [gender,detail,look] of [['boy','high',{skin:'deep',outfit:'formal',hair:'fade'}],['girl','low',{skin:'warm',outfit:'casual',hair:'braids'}],['boy','low',{collection:'emerald-legacy',skin:'deep',facialHair:'short_beard',earrings:'studs',tattooArt:'forearm_l',presence:'editorial'}],['girl','low',{collection:'onyx-executive',skin:'warm',earrings:'small_hoops'}],['boy','high',{collection:'omni-phantom',skin:'brown',facialHair:'stubble'}]]){
  const recipe=hdRecipe(gender,look,'athletic');assert.ok(recipe.params);
  const dir=join(temp,gender+'-'+detail+'-'+(look.collection??'base'));mkdirSync(dir);const input=join(dir,'recipe.json');writeFileSync(input,JSON.stringify({kind:'ara-character',version:1,params:recipe.params}));
  const out=join(dir,'export');mkdirSync(out);
  const r=spawnSync(process.execPath,[cli,'export','--params',input,'--detail',detail,'--formats','glb','--animations',HD_CLIPS.join(','),'--out',out],{stdio:'inherit',env:{...process.env,ARA3D_DATA:data},timeout:180000});
  assert.equal(r.status,0,'Real character export failed');
  const files=readdirSync(out).filter(n=>n.endsWith('.glb'));assert.equal(files.length,1);
  const b=readFileSync(join(out,files[0]));assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(4),2);
  const j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString('utf8').trim());
  const joints=Math.max(...(j.skins??[]).map(s=>s.joints.length));
  let triangles=0,morphs=0;for(const n of j.nodes??[]){if(n.skin===undefined||n.mesh===undefined)continue;for(const p of j.meshes[n.mesh].primitives){assert.equal(p.mode??4,4);assert.ok(p.attributes.JOINTS_0!==undefined&&p.attributes.WEIGHTS_0!==undefined);triangles+=(j.accessors[p.indices??p.attributes.POSITION].count/3);morphs+=p.targets?.length??0;}}
  assert.ok(joints>=30&&morphs>=5&&triangles>=15000);assert.ok(triangles<=(detail==='high'?220000:100000));if(detail==='high')assert.ok(triangles>=75000,'High detail must have substantially denser geometry');
  assert.ok((j.images??[]).length>=3);assert.ok((j.animations??[]).length>=HD_CLIPS.length);
  assert.ok((j.animations??[]).every(a=>a.channels.some(c=>c.target.path==='rotation')));
  const names=j.animations.map(a=>a.name);for(const clip of ['idle','walk','run','jump'])assert.ok(names.some(n=>n.toLowerCase().includes(clip)),clip+' missing');
  const filename=look.collection?'rb-elite-'+look.collection+'.glb':'rb-'+gender+'-'+detail+'.glb';writeFileSync(join(dest,filename),b);
  reports.push({gender,detail,collection:look.collection??null,filename,triangles:Math.round(triangles),joints,morphs,bytes:b.length,clips:names,sha256:createHash('sha256').update(b).digest('hex')});
 }
 const report={generator:'ara3d@'+HD_VERSION,data:'ara3d-data@1.2.0',models:reports,visualApproval:false,source:'MakeHuman CC0 and CMU motion capture',notice:'The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217. Do not resell motion data independently.'};
 writeFileSync(join(dest,'admission.json'),JSON.stringify(report,null,2));console.log('RB HD actual GLB admission: '+JSON.stringify(reports));
}finally{rmSync(temp,{recursive:true,force:true});}
