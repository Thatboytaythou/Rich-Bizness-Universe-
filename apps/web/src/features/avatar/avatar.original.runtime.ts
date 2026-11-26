import * as THREE from 'three';
import type { AvatarGender, SkinnedAvatarRuntime } from './avatar.skinned.runtime';

// Original, source-generated stylized humanoid. No third-party character art.
// Stable configuration is shared by studio, lobby and profile; this is not photorealistic art.
export const CHARACTER_RIG='rb-original-human-v1';
export const CHARACTER_OPTIONS={
  skin:['deep','warm','tan','light'],
  face:['angular','soft','strong'],
  hair:['fade','curls','braids','long','bald'],
  eyes:['brown','hazel','blue'],
  top:['jacket','tee','hoodie','vest'],
  pants:['cargo','denim','tailored'],
  shoes:['sneakers','boots','high-tops'],
  tattoo:['none','bands','geometric'],
  gear:['none','chain','shades','chain-shades'],
  color:['emerald','onyx','gold','ice']
} as const;
export type CharacterLook=Record<keyof typeof CHARACTER_OPTIONS,string>;
export function normalizeLook(input:unknown):CharacterLook{
  const data=(input&&typeof input==='object'?input:{}) as Record<string,unknown>;
  return Object.fromEntries(Object.entries(CHARACTER_OPTIONS).map(([key,options])=>[key,(options as readonly string[]).includes(String(data[key]))?String(data[key]):options[0]])) as CharacterLook;
}
export function createOriginalAvatar(gender:AvatarGender,raw:unknown,build='athletic'):SkinnedAvatarRuntime{
  const look=normalizeLook(raw),female=gender==='girl';
  const root=new THREE.Group();root.name='rb-original-human';
  const mat=(color:number,roughness=.65,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const skin=mat(({deep:0x754631,warm:0xad7352,tan:0xc88f68,light:0xe5b294} as Record<string,number>)[look.skin],.72);
  const hair=mat(0x201b19,.85),lip=mat(0x714737),white=mat(0xf3eee5),iris=mat(look.eyes==='blue'?0x6599c8:look.eyes==='hazel'?0x8f8e41:0x4a3023),black=mat(0x101512);
  const fabric=mat(({emerald:0x285b48,onyx:0x20252a,gold:0xae803b,ice:0x587f91} as Record<string,number>)[look.color],.88);
  const trim=mat(0x151d20,.83),denim=mat(look.pants==='denim'?0x31455e:look.pants==='tailored'?0x22232c:0x465044,.91),sole=mat(0xc9c5b8),gold=mat(0xe2b84e,.28,.82),ink=mat(0x242f2a,.9);
  const group=(p:THREE.Object3D,name:string,x=0,y=0,z=0)=>{const g=new THREE.Group();g.name=name;g.position.set(x,y,z);p.add(g);return g;};
  const mesh=(p:THREE.Object3D,geometry:THREE.BufferGeometry,m:THREE.Material,x=0,y=0,z=0)=>{const o=new THREE.Mesh(geometry,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;};
  const ell=(p:THREE.Object3D,m:THREE.Material,x:number,y:number,z:number,rx:number,ry:number,rz:number)=>{const o=mesh(p,new THREE.SphereGeometry(1,20,14),m,x,y,z);o.scale.set(rx,ry,rz);return o;};
  const tube=(p:THREE.Object3D,m:THREE.Material,x:number,y:number,z:number,rt:number,rb:number,h:number,sz=1)=>{const o=mesh(p,new THREE.CylinderGeometry(rt,rb,h,16),m,x,y,z);o.scale.z=sz;return o;};
  const box=(p:THREE.Object3D,m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>mesh(p,new THREE.BoxGeometry(w,h,d),m,x,y,z);
  const ring=(p:THREE.Object3D,m:THREE.Material,x:number,y:number,z:number,r:number,t:number)=>{const o=mesh(p,new THREE.TorusGeometry(r,t,7,32),m,x,y,z);return o;};
  const buildWidth=build==='lean'?.9:build==='heroic'?1.12:1;
  const pelvis=group(root,'rbPelvis',0,.91,0);
  const hip=female?.164:.145,shoulder=(female?.17:.205)*buildWidth;
  ell(pelvis,denim,0,.015,0,hip,.125,.105);
  const spine=group(pelvis,'rbSpine',0,.075,0);
  const torso=mesh(spine,new THREE.LatheGeometry([new THREE.Vector2(0,0),new THREE.Vector2(hip,.005),new THREE.Vector2(.136,.09),new THREE.Vector2(shoulder,.25),new THREE.Vector2(shoulder*.92,.34),new THREE.Vector2(.071,.385),new THREE.Vector2(0,.39)],24),fabric);
  torso.scale.z=.56;
  if(look.top==='jacket'||look.top==='hoodie'){box(spine,trim,0,.18,.099,.027,.35,.013);box(spine,gold,0,.22,.11,.009,.24,.009);}
  if(look.top==='hoodie'){ell(spine,fabric,0,.365,-.075,.115,.09,.07);for(const s of[-1,1])box(spine,sole,s*.03,.25,.108,.008,.12,.009);}
  if(look.top==='vest'){for(const s of[-1,1]){box(spine,trim,s*.075,.17,.104,.095,.13,.025);box(spine,gold,s*.075,.23,.123,.035,.008,.008);}}
  if(look.top==='tee')box(spine,trim,0,.03,.085,.23,.025,.013);
  box(spine,gold,0,.11,.10,.043,.027,.013);
  const neck=group(spine,'rbNeck',0,.39,0);tube(neck,skin,0,.035,0,.049,.057,.09);
  const head=group(neck,'rbHead',0,.13,0);
  const jaw=look.face==='strong'?1.12:look.face==='soft'?.9:1;
  ell(head,skin,0,.015,0,.101,.133,.093);
  ell(head,skin,0,-.060,.027,.076*jaw,.077,.069);
  for(const s of[-1,1]){
    ell(head,skin,s*.098,-.006,0,.023,.039,.019);
    ell(head,white,s*.039,.023,.081,.026,.014,.012);
    ell(head,iris,s*.039,.023,.091,.010,.010,.004);
    ell(head,black,s*.039,.023,.095,.0048,.006,.002);
    const brow=ell(head,hair,s*.039,.045,.079,.027,.007,.007);brow.rotation.z=s*-.12;
  }
  ell(head,skin,0,-.006,.094,.019,.035,.026);
  ell(head,lip,0,-.048,.086,.032,.009,.009);
  if(look.hair!=='bald'){
    ell(head,hair,0,.087,-.009,.105,.061,.094);
    if(look.hair==='fade')ell(head,hair,0,.109,-.004,.087,.027,.082);
    if(look.hair==='curls')for(let i=0;i<11;i++){const a=i/11*Math.PI*2;ell(head,hair,Math.cos(a)*.072,.113+Math.sin(i*2)*.009,Math.sin(a)*.065,.037,.032,.037);}
    if(look.hair==='braids')for(let i=0;i<7;i++){const x=(i-3)*.025;const b=tube(head,hair,x,.048,-.081,.012,.009,.16);b.rotation.x=.28;}
    if(look.hair==='long'){ell(head,hair,0,-.045,-.077,.115,.15,.053);for(const s of[-1,1])ell(head,hair,s*.089,-.075,-.008,.029,.128,.04);}
  }
  if(look.gear.includes('shades')){for(const s of[-1,1])box(head,black,s*.044,.024,.107,.065,.033,.012);box(head,gold,0,.026,.11,.025,.008,.009);}
  if(look.gear.includes('chain')){const chain=ring(spine,gold,0,.295,.105,.063,.008);chain.scale.y=.7;ell(spine,gold,0,.244,.125,.019,.027,.011);}
  for(const s of[-1,1]){
    const suffix=s<0?'L':'R';
    const arm=group(spine,'rbArm'+suffix,s*shoulder,.31,0);arm.rotation.z=s*.1;
    const sleeved=look.top==='jacket'||look.top==='hoodie';
    ell(arm,look.top==='vest'?skin:fabric,0,-.035,0,.064,.079,.065);
    tube(arm,sleeved?fabric:skin,0,-.115,0,.054,.043,.17);
    if(!sleeved&&look.top==='tee')tube(arm,fabric,0,-.052,0,.062,.056,.105);
    const fore=group(arm,'rbFore'+suffix,0,-.215,0);
    ell(fore,sleeved?fabric:skin,0,-.078,0,.043,.103,.043);
    if(look.tattoo!=='none'&&!sleeved){const t=ring(fore,ink,0,-.079,0,.041,.006);t.rotation.x=Math.PI/2;if(look.tattoo==='geometric'){const mark=box(fore,ink,0,-.118,.042,.026,.038,.005);mark.rotation.z=.75;}}
    if(look.tattoo!=='none'&&sleeved){const cuff=ring(fore,ink,0,-.176,0,.031,.005);cuff.rotation.x=Math.PI/2;}
    ell(fore,skin,0,-.19,.003,.036,.052,.027);
    ell(fore,skin,-s*.027,-.177,.015,.013,.027,.014);
    const leg=group(pelvis,'rbLeg'+suffix,s*hip*.53,-.055,0);
    ell(leg,denim,0,-.12,0,.074,.17,.079);
    if(look.pants==='cargo')box(leg,trim,s*.066,-.13,.007,.023,.11,.084);
    const shin=group(leg,'rbShin'+suffix,0,-.357,0);
    tube(shin,denim,0,-.12,0,.057,.041,.26,1.12);
    const foot=group(shin,'rbFoot'+suffix,0,-.34,.015);
    const boot=look.shoes==='boots'||look.shoes==='high-tops';
    ell(foot,look.shoes==='boots'?trim:fabric,0,.035,.035,.059,boot?.088:.057,.115);
    ell(foot,sole,0,-.012,.043,.062,.022,.12);
    if(look.shoes!=='boots')for(let i=0;i<3;i++)box(foot,sole,0,.071-i*.006,.05+i*.021,.058,.007,.008);
  }
  // Normalize to the same ground and height contract as the existing avatar runtime.
  root.updateMatrixWorld(true);
  let bounds=new THREE.Box3().setFromObject(root);const target=female?1.72:1.82;
  root.scale.setScalar(target/Math.max(.01,bounds.getSize(new THREE.Vector3()).y));root.updateMatrixWorld(true);
  bounds=new THREE.Box3().setFromObject(root);const base=group(root,'rbGround'); // preserve root world position for lobby
  for(const child of [...root.children])if(child!==base)base.add(child);
  base.position.y=-bounds.min.y/root.scale.y;root.updateMatrixWorld(true);
  bounds=new THREE.Box3().setFromObject(root);
  const mixer=new THREE.AnimationMixer(root);
  const track=(name:string,axis:string,t:number[],v:number[])=>new THREE.NumberKeyframeTrack(name+'.rotation['+axis+']',t,v);
  const movement=(name:string,duration:number,amplitude:number,knee:number)=>{
    const t=[0,duration*.25,duration*.5,duration*.75,duration];const tracks:THREE.KeyframeTrack[]=[];
    for(const s of[-1,1]){const suffix=s<0?'L':'R';tracks.push(track('rbLeg'+suffix,'x',t,[0,s*amplitude,0,-s*amplitude,0]),track('rbShin'+suffix,'x',t,[0,Math.max(0,-s)*knee,knee*.2,Math.max(0,s)*knee,0]),track('rbArm'+suffix,'x',t,[0,-s*amplitude*.65,0,s*amplitude*.65,0]),track('rbFore'+suffix,'x',t,[-.13,-.32,-.13,-.32,-.13]));}
    tracks.push(track('rbSpine','z',t,[0,.035,0,-.035,0]));return new THREE.AnimationClip(name,duration,tracks);
  };
  const idle=new THREE.AnimationClip('idle',2.4,[track('rbSpine','x',[0,1.2,2.4],[0,.018,0]),track('rbHead','y',[0,1.2,2.4],[0,.035,0]),...[-1,1].flatMap(s=>{const x=s<0?'L':'R';return[track('rbLeg'+x,'x',[0,2.4],[0,0]),track('rbShin'+x,'x',[0,2.4],[0,0]),track('rbArm'+x,'x',[0,2.4],[0,0]),track('rbFore'+x,'x',[0,2.4],[-.08,-.08]),track('rbArm'+x,'z',[0,2.4],[s*.1,s*.1])];})]);
  const jump=new THREE.AnimationClip('jump',.85,[-1,1].flatMap(s=>{const x=s<0?'L':'R';return[track('rbLeg'+x,'x',[0,.24,.55,.85],[0,-.6,-.35,0]),track('rbShin'+x,'x',[0,.24,.55,.85],[0,1.0,.6,0]),track('rbArm'+x,'x',[0,.24,.55,.85],[0,-.8,-.45,0])];}));
  const pose=new THREE.AnimationClip('power pose',1.2,[-1,1].flatMap(s=>{const x=s<0?'L':'R';return[track('rbArm'+x,'z',[0,.45,1.2],[s*.1,s*1.05,s*.8]),track('rbFore'+x,'x',[0,.45,1.2],[-.08,-1.25,-.85]),track('rbLeg'+x,'x',[0,1.2],[0,0]),track('rbShin'+x,'x',[0,1.2],[0,0])];}));
  const clips=[idle,movement('walk',.95,.43,.65),movement('run',.58,.77,1.04),jump,pose];
  const actions=new Map(clips.map(clip=>[clip.name.toLowerCase(),mixer.clipAction(clip)]));
  return {root,mixer,actions,clips,bounds,height:target,currentMotion:'idle',currentAction:null};
}
