import {cpSync,existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync,rmSync,mkdtempSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {hdRecipe,HD_CLIPS,HD_VERSION,morphs} from '../apps/web/src/features/avatar/avatar.hd.recipe.ts';
const root=process.cwd(),data=[resolve(root,'node_modules/ara3d-data/assets'),resolve(root,'apps/web/node_modules/ara3d-data/assets')].find(existsSync);
assert.ok(data,'Pinned Ara character data is missing');
const cli=[resolve(root,'node_modules/ara3d/dist/cli.js'),resolve(root,'apps/web/node_modules/ara3d/dist/cli.js')].find(existsSync);
assert.ok(cli,'Pinned Ara exporter is missing');
const dest=resolve(root,'apps/web/public/character-assets'),temp=mkdtempSync(join(tmpdir(),'rb-hd-'));
mkdirSync(dest,{recursive:true});const assetDir=join(dest,'ara-1.2.0');rmSync(assetDir,{recursive:true,force:true});cpSync(data,assetDir,{recursive:true});
const reports=[];
const catalog=JSON.parse(readFileSync(join(data,'catalog.json'),'utf8'));const sliderIds=new Set(catalog.sliders.flatMap(group=>group.sliders.map(slider=>slider.id)));for(const [field,id] of Object.entries(morphs))assert.ok(sliderIds.has(id),'Anatomy control '+field+' points to absent asset target '+id);
try{
 for(const [gender,detail,look] of [['boy','high',{skin:'deep',outfit:'formal',hair:'fade'}],['girl','low',{skin:'warm',outfit:'casual',hair:'braids'}],['boy','medium',{skin:'deep',outfit:'formal',hair:'fade'}],['girl','medium',{skin:'warm',outfit:'casual',hair:'braids'}],['boy','low',{collection:'emerald-legacy',skin:'deep',facialHair:'short_beard',earrings:'studs',tattooArt:'forearm_l',presence:'editorial'}],['girl','low',{collection:'onyx-executive',skin:'warm',earrings:'small_hoops'}],['boy','high',{collection:'omni-phantom',skin:'brown',facialHair:'stubble'}],['boy','low',{collection:'heritage-crown',skin:'deep',eliteJewelry:'gold',earrings:'studs'}],['girl','high',{collection:'midnight-motion',skin:'warm',eliteJewelry:'silver',identityMode:'phantom'}],['boy','high',{skin:'deep',hair:'fade',designerCut:'street',designerPalette:'burgundy',designerAccent:'copper',designerFootwear:'boots',evolution:'celestial',foreheadHeight:'20',neckWidth:'20',upperArm:'60',forearm:'40',thigh:'40',calf:'20',handSize:'20',footSize:'20',torsoLength:'20',backWidth:'40',gluteVolume:'20'}]]){
  const recipe=hdRecipe(gender,look,'athletic');assert.ok(recipe.params);for(const id of Object.keys(recipe.params.modifiers))assert.ok(sliderIds.has(id),'Recipe uses absent target '+id);
  const dir=join(temp,gender+'-'+detail+'-'+(look.designerCut?'custom-design':look.collection??'base'));mkdirSync(dir);const input=join(dir,'recipe.json');writeFileSync(input,JSON.stringify({kind:'ara-character',version:1,params:recipe.params}));
  const out=join(dir,'export');mkdirSync(out);
  const r=spawnSync(process.execPath,[cli,'export','--params',input,'--detail',detail,'--formats','glb','--animations',HD_CLIPS.join(','),'--out',out],{stdio:'inherit',env:{...process.env,ARA3D_DATA:data},timeout:180000});
  assert.equal(r.status,0,'Real character export failed');
  const files=readdirSync(out).filter(n=>n.endsWith('.glb'));assert.equal(files.length,1);
  const b=readFileSync(join(out,files[0]));assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(4),2);
  const j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString('utf8').trim());
  const joints=Math.max(...(j.skins??[]).map(s=>s.joints.length));
  let triangles=0,morphs=0;for(const n of j.nodes??[]){if(n.skin===undefined||n.mesh===undefined)continue;for(const p of j.meshes[n.mesh].primitives){assert.equal(p.mode??4,4);assert.ok(p.attributes.JOINTS_0!==undefined&&p.attributes.WEIGHTS_0!==undefined);triangles+=(j.accessors[p.indices??p.attributes.POSITION].count/3);morphs+=p.targets?.length??0;}}
  assert.ok(joints>=30&&morphs>=5&&triangles>=15000);assert.ok(triangles<=(detail==='high'?220000:detail==='medium'?85000:100000));if(detail==='high')assert.ok(triangles>=75000,'High detail must have substantially denser geometry');
  assert.ok((j.images??[]).length>=3);assert.ok((j.animations??[]).length>=HD_CLIPS.length);
  assert.ok((j.animations??[]).every(a=>a.channels.some(c=>c.target.path==='rotation')));
  const names=j.animations.map(a=>a.name);for(const clip of ['idle','walk','run','jump'])assert.ok(names.some(n=>n.toLowerCase().includes(clip)),clip+' missing');
  const filename=look.designerCut?'rb-elite-custom-design.glb':look.collection?'rb-elite-'+look.collection+'.glb':'rb-'+gender+'-'+detail+'.glb';writeFileSync(join(dest,filename),b);
  reports.push({gender,detail,collection:look.collection??null,customDesign:look.designerCut??null,filename,triangles:Math.round(triangles),joints,morphs,bytes:b.length,clips:names,sha256:createHash('sha256').update(b).digest('hex')});
 }
 const femaleLow=reports.find(m=>m.gender==='girl'&&m.detail==='low'&&!m.collection),femaleMedium=reports.find(m=>m.gender==='girl'&&m.detail==='medium'&&!m.collection);assert.ok(femaleMedium.triangles>femaleLow.triangles,'Enhanced mobile detail must increase actual mesh density');
 const report={generator:'ara3d@'+HD_VERSION,data:'ara3d-data@1.2.0',models:reports,visualApproval:false,source:'MakeHuman CC0 and CMU motion capture',notice:'The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217. Do not resell motion data independently.'};
 writeFileSync(join(dest,'admission.json'),JSON.stringify(report,null,2));console.log('RB HD actual GLB admission: '+JSON.stringify(reports));
}finally{rmSync(temp,{recursive:true,force:true});}
