import * as THREE from 'three';
import {regaliaTextile} from './avatar.original.wearables.ts';
import {DISTRICTS,type District,type WorldAction,type Bounds} from './world.catalog';

export type DistrictScene={group:THREE.Group;obstacles:Bounds[];markers:Map<string,THREE.Group>;setFurnishing:(value:string)=>void;tick:(time:number,active?:string,cameraRotation?:THREE.Quaternion)=>void};
export function createDistrictScene(district:District):DistrictScene{
  const group=new THREE.Group();group.name='rb-district-'+district;
  const obstacles:Bounds[]=[],markers=new Map<string,THREE.Group>();
  const palette={stone:0x27332f,black:0x101c19,wood:0x60442c,brass:0xad8c4c,cream:0xc6c4b8,glass:0x446e80,green:0x164634,leather:0x333f3d,screen:0x122632};
  const materials=new Map<number,THREE.MeshStandardMaterial>();
  const surfaces=new Map<number,THREE.CanvasTexture>();
  const texture=(c:number)=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#bcbcbc';ctx.fillRect(0,0,256,256);let state=12345+c;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};for(let i=0;i<2200;i++){const v=130+Math.floor(random()*115);ctx.fillStyle='rgba('+v+','+v+','+v+',.24)';ctx.fillRect(random()*256,random()*256,c===palette.wood?24:2,c===palette.wood?1:2);}if(c===palette.wood){for(let y=0;y<256;y+=32){ctx.fillStyle='#646464';ctx.fillRect(0,y,256,1);}}else if(c===palette.stone){ctx.strokeStyle='#9a9a9a';ctx.lineWidth=1;for(let n=0;n<256;n+=64){ctx.strokeRect(n,0,64,128);ctx.strokeRect(n,128,64,128);}}const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;surfaces.set(c,t);return t;};
  const mat=(c:number)=>{let m=materials.get(c);if(!m){m=new THREE.MeshStandardMaterial({color:c,roughness:c===palette.brass?.32:.74,metalness:c===palette.brass?.55:.05});if([palette.wood,palette.stone,palette.leather].includes(c))m.map=surfaces.get(c)??texture(c);materials.set(c,m);}return m;};
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:number,collision=false,parent:THREE.Object3D=group)=>{
    const geometry=new THREE.BoxGeometry(w,h,d);
    if([palette.wood,palette.stone,palette.leather].includes(c)){const uv=geometry.getAttribute('uv');const scales=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]] as const;for(const [face,scale] of scales.entries())for(let i=face*4;i<face*4+4;i++){uv.setXY(i,uv.getX(i)*Math.max(1,scale[0]/1.25),uv.getY(i)*Math.max(1,scale[1]/1.25));}uv.needsUpdate=true;}
    const mesh=new THREE.Mesh(geometry,mat(c));mesh.position.set(x,y,z);mesh.receiveShadow=true;parent.add(mesh);
    if(collision)obstacles.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});
    return mesh;
  };
  const plane=(x:number,z:number,w:number,d:number,c:number)=>box(x,-.07,z,w,.14,d,c);
  const lightBeacons:THREE.Mesh<THREE.BoxGeometry,THREE.MeshBasicMaterial>[]=[];
  const sign=(label:string,w=2.2,h=.42)=>{
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d')!;
    ctx.fillStyle='#0a1512';ctx.fillRect(0,0,512,128);ctx.strokeStyle='#bba26a';ctx.lineWidth=5;ctx.strokeRect(6,6,500,116);
    ctx.fillStyle='#e7d6ad';ctx.font='600 31px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label.toUpperCase(),256,64,470);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture}));
  };
  const portal=(action:WorldAction)=>{
    const marker=new THREE.Group();marker.position.set(action.x,0,action.z);
    const pad=new THREE.Mesh(new THREE.CylinderGeometry(.65,.72,.08,32),mat(palette.black));pad.position.y=.04;marker.add(pad);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.61,.025,8,40),new THREE.MeshBasicMaterial({color:0xcbb57b}));ring.rotation.x=-Math.PI/2;ring.position.y=.092;marker.add(ring);
    const beacon=new THREE.Mesh(new THREE.OctahedronGeometry(.17),new THREE.MeshBasicMaterial({color:0x97e5b1}));beacon.position.y=1.1;marker.add(beacon);
    const title=sign(action.label,1.65,.42);title.position.y=1.55;title.visible=false;marker.add(title);group.add(marker);markers.set(action.id,marker);
  };
  if(district==='personal'){
    plane(0,-3,12,18,palette.wood);
    // Open-front interior lets the third-person camera see the actual avatar.
    box(0,1.8,-12,12,3.6,.25,palette.stone);
    // Deep ceiling perimeter closes the sky gap without occluding the follow camera.
    box(0,3.72,-10.8,12,.24,2.4,palette.black);for(const x of [-5.4,5.4])box(x,3.72,-3,1.2,.24,18,palette.black);
    box(0,1.45,-11.84,6.2,1.8,.09,palette.black);for(const x of [-3.1,3.1])box(x,1.45,-11.75,.06,1.84,.06,palette.brass);
    box(-6,1.8,-3,.22,3.6,18,palette.stone);box(6,1.8,-3,.22,3.6,18,palette.stone);
    for(let i=0;i<8;i++){box(-5.85,1.9,4-i*2.15,.08,2.7,1.8,palette.glass);box(-5.76,1.9,4-i*2.15,.07,2.8,.05,palette.brass);}
    // Lounge: sofa, cushions, table, media cabinet and textured architectural details.
    box(-3.8,.36,1.2,2.1,.7,2.3,palette.leather,true);box(-4.66,.84,1.2,.35,.95,2.3,palette.leather);
    for(const z of [.5,1.25,2])box(-3.7,.78,z,1.55,.18,.66,palette.cream);
    // Original sculpted pedestal table in the same collision footprint.
    obstacles.push({minX:-2.16,maxX:-1.24,minZ:.27,maxZ:2.13});
    const table=new THREE.Group();table.position.set(-1.7,0,1.2);
    const stem=new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(.31,.025),new THREE.Vector2(.33,.055),new THREE.Vector2(.24,.12),new THREE.Vector2(.13,.28),new THREE.Vector2(.22,.57),new THREE.Vector2(.30,.61)],32),mat(palette.brass));stem.scale.z=2;table.add(stem);
    const top=new THREE.Mesh(new THREE.CylinderGeometry(.43,.4,.085,48),mat(palette.black));top.position.y=.65;top.scale.z=2.16;top.receiveShadow=true;table.add(top);group.add(table);
    const rugTex=new THREE.DataTexture(regaliaTextile('emerald'),128,128,THREE.RGBAFormat);rugTex.colorSpace=THREE.SRGBColorSpace;rugTex.wrapS=rugTex.wrapT=THREE.RepeatWrapping;rugTex.repeat.set(5,6);rugTex.magFilter=THREE.LinearFilter;rugTex.needsUpdate=true;
    const rug=new THREE.Mesh(new THREE.PlaneGeometry(3.8,4.6),new THREE.MeshStandardMaterial({map:rugTex,roughness:.96}));rug.rotation.x=-Math.PI/2;rug.position.set(-2.85,.009,1.1);rug.receiveShadow=true;group.add(rug);
    box(4.75,.55,.3,1.4,1.1,3,palette.wood,true);box(4.01,1.65,.3,.12,1.15,2.2,palette.screen);
    box(-4.5,1.18,-9,1.9,2.36,2.0,palette.wood,true);for(const x of [-5,-4.5,-4])box(x,1.2,-7.98,.035,2.2,.05,palette.brass);
    box(4.7,.47,-10.2,1.3,.94,1.5,palette.black,true);box(4.7,1.3,-10.5,.9,.56,.08,palette.screen);
    for(let i=0;i<7;i++)box(-5.8+i*1.9,.005,-4,1.85,.015,.035,palette.brass);
    for(const x of [-5.4,5.4])for(const z of [-1,-6,-10]){box(x,3.2,z,.13,.12,2.1,palette.brass);const glow=new THREE.Mesh(new THREE.BoxGeometry(.09,.08,1.95),new THREE.MeshBasicMaterial({color:0xffe1a2}));glow.position.set(x,3.11,z);group.add(glow);}
    const title=sign('RICH BIZNESS / PRIVATE SESSION',5,.7);title.position.set(0,2.7,-11.8);group.add(title);
  }else if(district==='creative'){
    plane(0,-5,12,22,palette.black);
    box(0,2,-16,12,4,.25,palette.stone);box(-6,2,-5,.22,4,22,palette.stone);box(6,2,-5,.22,4,22,palette.stone);
    for(const x of [-5.85,5.85])for(let z=-14;z<5;z+=2){box(x,2,z,.15,2.6,1.5,palette.wood);for(let i=0;i<7;i++)box(x+(x<0?.1:-.1),2,z-.6+i*.2,.08,2.6,.065,palette.black);}
    // Mixing station, monitor banks, acoustic booth, exhibition stands.
    box(0,.5,-9.3,4.4,1,1.4,palette.wood,true);box(0,1.04,-9.3,4.6,.09,1.5,palette.black);
    for(let i=0;i<12;i++){box(-1.9+i*.34,1.115,-9.05,.09,.07,.38,palette.brass);box(-1.9+i*.34,1.115,-9.55,.14,.045,.11,palette.green);}
    for(const x of [-1.3,1.3]){box(x,1.6,-9.85,1.1,.7,.12,palette.screen);box(x*1.8,1.52,-10.1,.45,.85,.42,palette.black);}
    box(-4.5,.65,-3,1.2,1.3,2,palette.wood,true);box(-4.5,1.55,-3.3,.9,.5,.1,palette.screen);
    for(let z=-7;z<=1;z+=2){box(5.35,1.8,z,.12,1.6,1.35,palette.brass);box(5.25,1.8,z,.09,1.42,1.17,palette.green);}
    box(4.8,.5,-13.6,1.6,1,1.4,palette.black,true);box(4.8,1.6,-13.7,1.2,.65,.1,palette.screen);
    for(const x of [-5.5,5.5]){const strip=new THREE.Mesh(new THREE.BoxGeometry(.1,.075,18),new THREE.MeshBasicMaterial({color:0x58bca0}));strip.position.set(x,3.65,-5);group.add(strip);}
    // Gallery display plinth and sculptural RB ring, inside existing exhibition side-wall footprint.
    const sculpture=new THREE.Mesh(new THREE.TorusKnotGeometry(.23,.05,80,10,2,3),mat(palette.brass));sculpture.position.set(5.1,2.28,-9);sculpture.rotation.set(.45,.35,.2);group.add(sculpture);
    const title=sign('RICH BIZNESS / CREATIVE HOUSE',5,.7);title.position.set(0,3.2,-15.8);group.add(title);
  }else{
    // Extend the existing street scene with reachable destinations. Do not recreate its road.
    for(const a of DISTRICTS.city.actions){box(a.x,0.015,a.z,2.3,.025,2.3,palette.green);}
    for(const [x,z] of ([[-4.9,-17],[4.9,-31],[-4.9,-50],[4.9,-67]] as const))obstacles.push({minX:x-.93,maxX:x+.93,minZ:z-1.7,maxZ:z+1.7});
    for(const z of [-10,-22,-34,-46]){box(-6.0,.38,z,1.0,.75,1.6,palette.stone,true);box(6.0,.38,z,1.0,.75,1.6,palette.stone,true);}
    for(const z of [-12,-28,-44]){for(const x of [-6.2,6.2]){box(x,1.35,z,.1,2.7,.1,palette.black);const lamp=new THREE.Mesh(new THREE.BoxGeometry(.26,.32,.24),new THREE.MeshBasicMaterial({color:0xe4b665}));lamp.position.set(x,2.8,z);group.add(lamp);lightBeacons.push(lamp);}for(let x=-5;x<=5;x+=.8)box(x,.016,z,.42,.025,1.4,palette.cream);}
  }
  DISTRICTS[district].actions.forEach(portal);
  return {group,obstacles,markers,setFurnishing:value=>{mat(palette.leather).color.setHex(value==='onyx'?0x26292e:value==='cognac'?0x92592f:0x275d48);},tick:(time,active,cameraRotation)=>{lightBeacons.forEach((lamp,i)=>lamp.material.color.setHex(Math.floor(time/8+i/2)%2===0?0x6fcd8a:0xdba85c));for(const [id,marker] of markers){const beacon=marker.children[2],title=marker.children[3];if(beacon){beacon.rotation.y=time*.7;beacon.position.y=.8+Math.sin(time*1.8)*.06;}if(title){title.visible=id===active;if(cameraRotation)title.quaternion.copy(cameraRotation);}}}};
}
export function moveWithinWorld(x:number,z:number,dx:number,dz:number,b:Bounds,obstacles:Bounds[]):[number,number]{
  const clamp=(v:number,a:number,c:number)=>Math.max(a,Math.min(c,v));
  const blocked=(px:number,pz:number)=>obstacles.some(o=>px>o.minX-.28&&px<o.maxX+.28&&pz>o.minZ-.28&&pz<o.maxZ+.28);
  const nx=clamp(x+dx,b.minX,b.maxX),nz=clamp(z+dz,b.minZ,b.maxZ);
  const ax=blocked(nx,z)?x:nx;return [ax,blocked(ax,nz)?z:nz];
}
export function nearbyAction(actions:WorldAction[],x:number,z:number):WorldAction|undefined{
  let best:WorldAction|undefined,distance=1.85;
  for(const a of actions){const d=Math.hypot(x-a.x,z-a.z);if(d<distance){best=a;distance=d;}}return best;
}

export {cameraClearance} from './world.camera';
