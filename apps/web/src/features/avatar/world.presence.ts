import * as THREE from 'three';
import {supabase} from '../../core/supabase/client';
import {getAuthSnapshot} from '../../core/auth/auth-store';
import type {District} from './world.catalog';
import type {AvatarMotion} from './avatar.skinned.runtime';

type Pose={x:number;y:number;z:number;yaw:number;motion:AvatarMotion};
type Row=Pose&{user_id:string;session_id:string;district:string;updated_at:string};
type Peer={group:THREE.Group;target:THREE.Vector3;yaw:number;motion:string;legs:THREE.Group[];seen:number};
export function createWorldPresence(scene:THREE.Scene,district:District,userId:string,pose:()=>Pose|null,status:(s:string)=>void){
  let enabled=false,busy=false,reading=false,generation=0,timer=0,readTimer=0;
  let session='',channel:ReturnType<typeof supabase.channel>|null=null;
  let request:AbortController|null=null;
  const peers=new Map<string,Peer>();
  const root=new THREE.Group();root.name='rb-live-member-proxies';scene.add(root);
  const material=new THREE.MeshStandardMaterial({color:0x448873,roughness:.72});
  const accent=new THREE.MeshStandardMaterial({color:0xe0bc72,roughness:.55});
  const sphere=new THREE.SphereGeometry(.13,12,10),body=new THREE.CapsuleGeometry(.19,.46,4,10),limb=new THREE.CapsuleGeometry(.075,.34,4,8);
  const marker=(row:Row):Peer=>{
    const group=new THREE.Group();group.position.set(row.x,row.y,row.z);
    const torso=new THREE.Mesh(body,material);torso.position.y=1.02;group.add(torso);
    const head=new THREE.Mesh(sphere,accent);head.position.y=1.53;group.add(head);
    const legs:THREE.Group[]=[];
    for(const side of [-1,1]){const pivot=new THREE.Group();pivot.position.set(side*.1,.72,0);const mesh=new THREE.Mesh(limb,material);mesh.position.y=-.26;pivot.add(mesh);group.add(pivot);legs.push(pivot);const arm=new THREE.Mesh(limb,material);arm.position.set(side*.29,1.06,0);group.add(arm);}
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.37,.025,6,24),accent);ring.rotation.x=-Math.PI/2;ring.position.y=.035;group.add(ring);root.add(group);
    return {group,target:group.position.clone(),yaw:row.yaw,motion:row.motion,legs,seen:performance.now()};
  };
  const remove=(id:string)=>{const p=peers.get(id);if(p){root.remove(p.group);peers.delete(id);}};
  const clear=()=>{for(const id of peers.keys())remove(id);};
  const accept=(rows:Row[])=>{
    if(!enabled)return;
    const valid=rows.filter(r=>r.user_id!==userId&&r.district===district&&[r.x,r.y,r.z,r.yaw].every(Number.isFinite)).slice(0,12);
    const ids=new Set(valid.map(r=>r.user_id));
    for(const id of peers.keys())if(!ids.has(id))remove(id);
    for(const row of valid){const p=peers.get(row.user_id)??marker(row);p.target.set(row.x,row.y,row.z);p.yaw=row.yaw;p.motion=row.motion;p.seen=performance.now();peers.set(row.user_id,p);}
    status('Live public presence · '+peers.size+' other member'+(peers.size===1?'':'s')+' · simplified avatars');
  };
  const read=async()=>{
    if(!enabled||reading||document.hidden)return;
    reading=true;const g=generation;
    try{const {data,error}=await supabase.from('rb_world_presence').select('user_id,session_id,district,x,y,z,yaw,motion,updated_at').eq('district',district).neq('user_id',userId).gt('updated_at',new Date(Date.now()-25000).toISOString()).order('updated_at',{ascending:false}).limit(12).abortSignal(request!.signal);
    if(g!==generation||!enabled)return;if(error){status('Presence read unavailable');return;}accept((data??[]) as Row[]);
    }catch{if(g===generation&&enabled)status('Presence connection interrupted');}finally{if(g===generation)reading=false;}
  };
  const publish=async()=>{
    if(!enabled||busy||document.hidden||getAuthSnapshot().user?.id!==userId)return;const value=pose();if(!value)return;busy=true;const g=generation;
    try{const {error}=await supabase.from('rb_world_presence').upsert({user_id:userId,session_id:session,district,...value},{onConflict:'user_id'}).abortSignal(request!.signal);if(g===generation&&enabled&&error)status('Presence write unavailable: '+error.message);}
    catch{if(g===generation&&enabled)status('Presence write interrupted');}finally{if(g===generation)busy=false;}
  };
  const stop=()=>{
    if(!enabled)return;enabled=false;generation++;clearInterval(timer);clearInterval(readTimer);request?.abort();request=null;busy=false;reading=false;
    if(channel){void supabase.removeChannel(channel);channel=null;}clear();const old=session;
    void supabase.from('rb_world_presence').delete().eq('user_id',userId).eq('session_id',old).then(()=>{});
    status('Solo mode · your movement is not shared');
  };
  const start=()=>{
    if(enabled||district==='personal'||getAuthSnapshot().user?.id!==userId)return;
    enabled=true;generation++;session=crypto.randomUUID();request=new AbortController();status('Connecting public presence…');
    channel=supabase.channel('rb-world-'+district+'-'+session).on('postgres_changes',{event:'*',schema:'public',table:'rb_world_presence',filter:'district=eq.'+district},()=>void read()).subscribe(s=>{if(enabled&&s==='SUBSCRIBED')void read();});
    void publish();void read();timer=window.setInterval(()=>void publish(),1500);readTimer=window.setInterval(()=>void read(),5000);
  };
  return {start,stop,tick:(dt:number,time:number)=>{for(const [id,p] of peers){if(performance.now()-p.seen>30000){remove(id);continue;}p.group.position.lerp(p.target,1-Math.exp(-5*dt));const d=Math.atan2(Math.sin(p.yaw-p.group.rotation.y),Math.cos(p.yaw-p.group.rotation.y));p.group.rotation.y+=d*(1-Math.exp(-7*dt));p.legs.forEach((l,i)=>{l.rotation.x=p.motion==='walk'||p.motion==='run'?Math.sin(time*(p.motion==='run'?10:6)+i*Math.PI)*.45:0;});}},dispose:()=>{stop();root.removeFromParent();sphere.dispose();body.dispose();limb.dispose();material.dispose();accent.dispose();}};
}
