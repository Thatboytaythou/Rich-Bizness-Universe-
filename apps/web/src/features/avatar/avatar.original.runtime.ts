import * as THREE from 'three';
import type { AvatarGender, SkinnedAvatarRuntime } from './avatar.skinned.runtime';

// Original, source-generated stylized humanoid. No third-party character art.
// Stable configuration is shared by studio, lobby and profile; this is not photorealistic art.
import {normalizeLook} from './avatar.character.config';
export {CHARACTER_RIG,CHARACTER_OPTIONS,normalizeLook,type CharacterLook} from './avatar.character.config';
export function createOriginalAvatar(gender:AvatarGender,raw:unknown,build='athletic'):SkinnedAvatarRuntime{
  const look=normalizeLook(raw),female=gender==='girl';
  const mobile=typeof window!=='undefined'&&window.matchMedia('(pointer:coarse),(max-width:860px)').matches;
  const radial=mobile?12:24;const sphereGeo=new THREE.SphereGeometry(1,mobile?14:28,mobile?10:20);
  const root=new THREE.Group();root.name='rb-original-human';
  const mat=(color:number,roughness=.65,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const skin=mat(({deep:0x754631,warm:0xad7352,tan:0xc88f68,light:0xe5b294} as Record<string,number>)[look.skin],.72);
  const hair=mat(0x201b19,.85),lip=mat(0x714737),white=mat(0xf3eee5),iris=mat(look.eyes==='blue'?0x6599c8:look.eyes==='hazel'?0x8f8e41:0x4a3023),black=mat(0x101512);
  const fabric=mat(({emerald:0x285b48,onyx:0x20252a,gold:0xae803b,ice:0x587f91} as Record<string,number>)[look.color],.88);
  const trim=mat(0x151d20,.83),denim=mat(look.pants==='denim'?0x31455e:look.pants==='tailored'?0x22232c:0x465044,.91),sole=mat(0xc9c5b8),gold=mat(0xe2b84e,.28,.82),ink=mat(0x242f2a,.9);
  const group=(p:THREE.Object3D,name:string,x=0,y=0,z=0)=>{const g=new THREE.Group();g.name=name;g.position.set(x,y,z);p.add(g);return g;};
  const mesh=(p:THREE.Object3D,geometry:THREE.BufferGeometry,m:THREE.Material,x=0,y=0,z=0)=>{const o=new THREE.Mesh(geometry,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;};
  const ell=(p:THREE.Object3D,m:THREE.Material,x:number,y:number,z:number,rx:number,ry:number,rz:number)=>{const o=mesh(p,sphereGeo,m,x,y,z);o.scale.set(rx,ry,rz);return o;};
  const tube=(p:THREE.Object3D,m:THREE.Material,x:number,y:number,z:number,rt:number,rb:number,h:number,sz=1)=>{const o=mesh(p,new THREE.CylinderGeometry(rt,rb,h,mobile?10:16),m,x,y,z);o.scale.z=sz;return o;};
  const box=(p:THREE.Object3D,m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>mesh(p,new THREE.BoxGeometry(w,h,d),m,x,y,z);
  const ring=(p:THREE.Object3D,m:THREE.Material,x:number,y:number,z:number,r:number,t:number)=>{const o=mesh(p,new THREE.TorusGeometry(r,t,6,mobile?16:32),m,x,y,z);return o;};
  const buildWidth=build==='lean'?.85:build==='heroic'?1.18:1;
  const limb=(p:THREE.Object3D,m:THREE.Material,points:number[][],y=0,depth=1)=>{const o=mesh(p,new THREE.LatheGeometry(points.map(([x,h])=>new THREE.Vector2(x,h)),radial),m,0,y,0);o.scale.z=depth;return o;};
  const pelvis=group(root,'rbPelvis',0,.91,0);
  const hip=(female?.164:.145)*(build==='heroic'?1.08:build==='lean'?.93:1),shoulder=(female?.17:.205)*buildWidth;
  ell(pelvis,denim,0,.015,0,hip,.13,.11);
  const belt=limb(pelvis,trim,[[hip*.96,-.015],[hip*1.01,0],[hip*.97,.028]],.09,.74);box(pelvis,gold,0,.101,.113,.055,.033,.018);
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
  // Continuous shaped face surface instead of an overlapping ball and jaw.
  const faceGeo=new THREE.SphereGeometry(1,mobile?24:40,mobile?16:28);const pos=faceGeo.attributes.position;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);const taper=y<-.18?1-(Math.abs(y)-.18)*.30+(jaw-1)*.65:1;const front=Math.max(0,z);pos.setXYZ(i,x*.102*taper,y*.137+.012,z*.095+front*Math.max(0,-y)*.020);}
  faceGeo.computeVertexNormals();mesh(head,faceGeo,skin);
  for(const s of[-1,1]){
    ell(head,skin,s*.098,-.006,0,.023,.039,.019);
    ell(head,white,s*.039,.023,.084,.021,.010,.009);
    ell(head,iris,s*.039,.023,.091,.008,.008,.004);
    ell(head,black,s*.039,.023,.095,.0048,.006,.002);
    const brow=ell(head,hair,s*.039,.045,.079,.027,.007,.007);brow.rotation.z=s*-.12;
  }
  ell(head,skin,0,.004,.098,.013,.034,.018);ell(head,skin,0,-.024,.106,.021,.014,.014);
  ell(head,lip,0,-.058,.095,.027,.006,.007);
  for(const k of[-1,1])ell(head,skin,k*.062,-.023,.064,.029,.037,.026);
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
    limb(arm,sleeved?fabric:skin,[[.043,-.226],[.046,-.19],[.057,-.12],[.06,-.065],[.045,0]],0,1.04);
    if(!sleeved&&look.top==='tee')tube(arm,fabric,0,-.052,0,.062,.056,.105);
    const fore=group(arm,'rbFore'+suffix,0,-.215,0);
    const rolled=sleeved&&look.tattoo!=='none';
    ell(fore,sleeved&&!rolled?fabric:skin,0,-.016,0,.044,.051,.043);
    limb(fore,sleeved&&!rolled?fabric:skin,[[.031,-.168],[.034,-.128],[.042,-.075],[.045,-.015],[.041,.02]],0,1.04);
    if(rolled)limb(fore,fabric,[[.048,-.055],[.050,-.040],[.048,.005]],0,1.05);
    if(look.tattoo!=='none'){const t=ring(fore,ink,0,-.079,0,.041,.006);t.rotation.x=Math.PI/2;if(look.tattoo==='geometric'){const mark=box(fore,ink,0,-.118,.042,.026,.038,.005);mark.rotation.z=.75;}}
    if(look.tattoo==='bands'){const second=ring(fore,ink,0,-.106,0,.037,.004);second.rotation.x=Math.PI/2;}
    ell(fore,skin,0,-.19,.003,.036,.052,.027);
    ell(fore,skin,-s*.027,-.177,.015,.013,.027,.014);
    const leg=group(pelvis,'rbLeg'+suffix,s*hip*.53,-.055,0);
    limb(leg,denim,[[.054,-.365],[.059,-.30],[.075,-.18],[.083,-.065],[.074,.025]],0,1.08);
    if(look.pants==='cargo')box(leg,trim,s*.066,-.13,.007,.023,.11,.084);
    const shin=group(leg,'rbShin'+suffix,0,-.357,0);
    ell(shin,denim,0,-.005,0,.057,.055,.06);limb(shin,denim,[[.04,-.335],[.043,-.27],[.053,-.16],[.06,-.08],[.054,.015]],0,1.10);
    const foot=group(shin,'rbFoot'+suffix,0,-.34,.015);
    const boot=look.shoes==='boots'||look.shoes==='high-tops';
    ell(foot,look.shoes==='boots'?trim:fabric,0,.035,.035,.059,boot?.088:.057,.115);
    const outsole=box(foot,sole,0,-.008,.043,.118,.026,.221);outsole.geometry.translate(0,0,0);
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
    const n=24,t=Array.from({length:n+1},(_,i)=>i*duration/n),phase=t.map(v=>v/duration*Math.PI*2);const tracks:THREE.KeyframeTrack[]=[];
    for(const s of[-1,1]){
      const suffix=s<0?'L':'R',p=phase.map(x=>x+(s<0?0:Math.PI));
      tracks.push(track('rbLeg'+suffix,'x',t,p.map(x=>Math.sin(x)*amplitude-.04)),track('rbShin'+suffix,'x',t,p.map(x=>.08+Math.pow(Math.max(0,-Math.sin(x-.34)),1.4)*knee)),track('rbFoot'+suffix,'x',t,p.map(x=>-.13*Math.sin(x)-.10*Math.max(0,-Math.sin(x)))),track('rbArm'+suffix,'x',t,p.map(x=>-Math.sin(x)*amplitude*.62-.07)),track('rbFore'+suffix,'x',t,p.map(x=>-.18-(name==='run'?.67:.18)*(1+Math.sin(x-.4))*.5)),track('rbArm'+suffix,'z',t,p.map(x=>s*(.10+.035*Math.cos(x)))));
    }
    tracks.push(track('rbSpine','z',t,phase.map(x=>.028*Math.sin(x))),track('rbSpine','y',t,phase.map(x=>.085*Math.sin(x))),track('rbSpine','x',t,phase.map(x=>name==='run'?.13:.035)),track('rbPelvis','y',t,phase.map(x=>.04*Math.sin(x))),new THREE.NumberKeyframeTrack('rbPelvis.position[y]',t,phase.map(x=>.91+(name==='run'?.026:.017)*(1-Math.cos(2*x))*.5)));
    return new THREE.AnimationClip(name,duration,tracks);
  };
  const idle=new THREE.AnimationClip('idle',2.4,[track('rbSpine','x',[0,1.2,2.4],[0,.018,0]),track('rbHead','y',[0,1.2,2.4],[0,.035,0]),...[-1,1].flatMap(s=>{const x=s<0?'L':'R';return[track('rbLeg'+x,'x',[0,2.4],[0,0]),track('rbShin'+x,'x',[0,2.4],[0,0]),track('rbArm'+x,'x',[0,2.4],[0,0]),track('rbFore'+x,'x',[0,2.4],[-.08,-.08]),track('rbArm'+x,'z',[0,2.4],[s*.1,s*.1])];})]);
  const jump=new THREE.AnimationClip('jump',.85,[-1,1].flatMap(s=>{const x=s<0?'L':'R';return[track('rbLeg'+x,'x',[0,.24,.55,.85],[0,-.6,-.35,0]),track('rbShin'+x,'x',[0,.24,.55,.85],[0,1.0,.6,0]),track('rbArm'+x,'x',[0,.24,.55,.85],[0,-.8,-.45,0])];}));
  const pose=new THREE.AnimationClip('power pose',1.2,[-1,1].flatMap(s=>{const x=s<0?'L':'R';return[track('rbArm'+x,'z',[0,.45,1.2],[s*.1,s*1.05,s*.8]),track('rbFore'+x,'x',[0,.45,1.2],[-.08,-1.25,-.85]),track('rbLeg'+x,'x',[0,1.2],[0,0]),track('rbShin'+x,'x',[0,1.2],[0,0])];}));
  const clips=[idle,movement('walk',1.04,.42,.77),movement('run',.72,.67,1.04),jump,pose];
  const actions=new Map(clips.map(clip=>[clip.name.toLowerCase(),mixer.clipAction(clip)]));
  return {root,mixer,actions,clips,bounds,height:target,currentMotion:'idle',currentAction:null};
}
