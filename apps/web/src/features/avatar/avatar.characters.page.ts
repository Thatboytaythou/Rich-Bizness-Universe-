import * as THREE from 'three';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import './avatar.characters.css';

type Snapshot = { profile?: Record<string, any>; avatar?: Record<string, any> };
type CleanupHost = Window & { __rbPageCleanup?: (() => void | Promise<void>) | null };
type Gender = 'boy' | 'girl';
type Rig = {
  root: THREE.Group; pelvis: THREE.Group; spine: THREE.Group; chest: THREE.Group; neck: THREE.Group; head: THREE.Group;
  leftShoulder: THREE.Group; rightShoulder: THREE.Group; leftElbow: THREE.Group; rightElbow: THREE.Group; leftWrist: THREE.Group; rightWrist: THREE.Group;
  leftHip: THREE.Group; rightHip: THREE.Group; leftKnee: THREE.Group; rightKnee: THREE.Group; leftAnkle: THREE.Group; rightAnkle: THREE.Group;
  leftEye: THREE.Mesh; rightEye: THREE.Mesh;
};

const OWNER = 'rich-bizness-avatar-characters-v1';
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c] ?? c));
const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material) => { const m = new THREE.Mesh(geometry, material); m.castShadow = true; m.receiveShadow = true; return m; };
const capsule = (r:number,l:number,mat:THREE.Material) => mesh(new THREE.CapsuleGeometry(r,l,12,28),mat);

function createRig(gender: Gender, accent: number, build: string, style: string): Rig {
  const root = new THREE.Group();
  const pelvis = new THREE.Group(); const spine = new THREE.Group(); const chest = new THREE.Group(); const neck = new THREE.Group(); const head = new THREE.Group();
  const leftShoulder = new THREE.Group(); const rightShoulder = new THREE.Group(); const leftElbow = new THREE.Group(); const rightElbow = new THREE.Group(); const leftWrist = new THREE.Group(); const rightWrist = new THREE.Group();
  const leftHip = new THREE.Group(); const rightHip = new THREE.Group(); const leftKnee = new THREE.Group(); const rightKnee = new THREE.Group(); const leftAnkle = new THREE.Group(); const rightAnkle = new THREE.Group();

  const skin = new THREE.MeshPhysicalMaterial({ color: gender === 'girl' ? 0xa87458 : 0x936348, roughness:.43, metalness:.01, clearcoat:.15, clearcoatRoughness:.5 });
  const top = new THREE.MeshPhysicalMaterial({ color: accent, roughness:.3, metalness: style === 'cyber' ? .3 : .08, clearcoat:.28 });
  const pants = new THREE.MeshPhysicalMaterial({ color: style === 'boss' ? 0x17191b : 0x17201c, roughness:.48, metalness:.05, clearcoat:.06 });
  const shoe = new THREE.MeshPhysicalMaterial({ color:0x101311, roughness:.32, metalness:.16, clearcoat:.34 });
  const hair = new THREE.MeshStandardMaterial({ color:0x111111, roughness:.5 });
  const white = new THREE.MeshStandardMaterial({ color:0xf8f8f5, roughness:.5 });
  const iris = new THREE.MeshStandardMaterial({ color:0x23170f, roughness:.45 });
  const lip = new THREE.MeshStandardMaterial({ color: gender === 'girl' ? 0x7b3d45 : 0x5b3029, roughness:.55 });

  const bodyScale = build === 'lean' ? .92 : build === 'heroic' ? 1.06 : 1;
  const shoulderX = (gender === 'girl' ? .43 : .49) * bodyScale;
  const hipX = gender === 'girl' ? .23 : .21;
  root.add(pelvis); pelvis.position.y = .84;
  const pelvisMesh = mesh(new THREE.SphereGeometry(.32,32,24), pants); pelvisMesh.scale.set(gender === 'girl' ? 1.08 : .98,.55,.7); pelvis.add(pelvisMesh);

  spine.position.y = .42; pelvis.add(spine);
  const waist = mesh(new THREE.CylinderGeometry(.25,.30,.42,28), top); waist.position.y=.2; waist.scale.x=bodyScale; spine.add(waist);
  chest.position.y = .44; spine.add(chest);
  const torso = capsule(gender === 'girl' ? .33 : .37,.76,top); torso.position.y=.4; torso.scale.set(bodyScale,1,.58); chest.add(torso);
  const clavicle = mesh(new THREE.BoxGeometry(shoulderX*2.05,.13,.28),top); clavicle.position.y=.77; clavicle.scale.z=.72; chest.add(clavicle);

  neck.position.y=.92; chest.add(neck);
  neck.add(mesh(new THREE.CylinderGeometry(.105,.125,.28,22),skin));
  head.position.y=.28; neck.add(head);
  const skull = mesh(new THREE.SphereGeometry(.29,48,36),skin); skull.scale.set(.9,1.06,.94); skull.position.y=.16; head.add(skull);
  const jaw = mesh(new THREE.SphereGeometry(.225,36,26),skin); jaw.scale.set(.9,.57,.82); jaw.position.set(0,-.02,.018); head.add(jaw);
  const hairCap = mesh(new THREE.SphereGeometry(.3,36,22,0,Math.PI*2,0,Math.PI*.52),hair); hairCap.position.y=.34; hairCap.scale.set(1.02,.58,1.02); head.add(hairCap);
  const leftEye = mesh(new THREE.SphereGeometry(.033,16,12),white); leftEye.position.set(-.1,.16,.267); head.add(leftEye);
  const rightEye = leftEye.clone(); rightEye.position.x=.1; head.add(rightEye);
  for (const x of [-.1,.1]) { const p = mesh(new THREE.SphereGeometry(.014,12,10),iris); p.position.set(x,.16,.295); head.add(p); }
  const nose = capsule(.017,.07,skin); nose.rotation.x=Math.PI/2; nose.position.set(0,.085,.29); head.add(nose);
  const mouth = mesh(new THREE.BoxGeometry(.095,.014,.014),lip); mouth.position.set(0,-.005,.28); head.add(mouth);

  const addArm = (side:-1|1, shoulder:THREE.Group, elbow:THREE.Group, wrist:THREE.Group) => {
    shoulder.position.set(side*shoulderX,.73,0); chest.add(shoulder);
    const upper = capsule(.085,.49,skin); upper.position.y=-.28; shoulder.add(upper);
    elbow.position.y=-.56; shoulder.add(elbow);
    const fore = capsule(.076,.46,skin); fore.position.y=-.26; elbow.add(fore);
    wrist.position.y=-.52; elbow.add(wrist);
    const palm = mesh(new THREE.BoxGeometry(.14,.19,.08),skin); palm.position.y=-.08; wrist.add(palm);
    for(let i=0;i<4;i++){ const f = capsule(.012,.12,skin); f.position.set((i-1.5)*.028,-.18,.01); wrist.add(f); }
  };
  addArm(-1,leftShoulder,leftElbow,leftWrist); addArm(1,rightShoulder,rightElbow,rightWrist);

  const addLeg = (side:-1|1, hip:THREE.Group, knee:THREE.Group, ankle:THREE.Group) => {
    hip.position.set(side*hipX,-.1,0); pelvis.add(hip);
    const thigh = capsule(.115,.76,pants); thigh.position.y=-.42; hip.add(thigh);
    knee.position.y=-.82; hip.add(knee);
    const shin = capsule(.098,.72,pants); shin.position.y=-.4; knee.add(shin);
    ankle.position.y=-.78; knee.add(ankle);
    const foot = mesh(new THREE.BoxGeometry(.23,.15,.46),shoe); foot.position.set(0,-.07,.13); ankle.add(foot);
  };
  addLeg(-1,leftHip,leftKnee,leftAnkle); addLeg(1,rightHip,rightKnee,rightAnkle);

  root.scale.setScalar(1.13);
  return { root,pelvis,spine,chest,neck,head,leftShoulder,rightShoulder,leftElbow,rightElbow,leftWrist,rightWrist,leftHip,rightHip,leftKnee,rightKnee,leftAnkle,rightAnkle,leftEye,rightEye };
}

function animateIdle(r:Rig,t:number){
  const breath=Math.sin(t*1.65);
  r.pelvis.rotation.y=Math.sin(t*.45)*.035;
  r.spine.rotation.z=Math.sin(t*.75)*.012;
  r.chest.rotation.x=breath*.012; r.chest.position.y=.44+breath*.008;
  r.neck.rotation.y=Math.sin(t*.38)*.05; r.head.rotation.y=Math.sin(t*.42)*.14; r.head.rotation.x=Math.sin(t*.73)*.025;
  r.leftShoulder.rotation.z=.045+Math.sin(t*.8)*.025; r.rightShoulder.rotation.z=-.045-Math.sin(t*.8)*.025;
  r.leftElbow.rotation.x=-.10+Math.sin(t*.65)*.03; r.rightElbow.rotation.x=-.10-Math.sin(t*.65)*.03;
  r.leftWrist.rotation.z=Math.sin(t*.9)*.04; r.rightWrist.rotation.z=-Math.sin(t*.9)*.04;
  r.leftHip.rotation.x=Math.sin(t*.62)*.018; r.rightHip.rotation.x=-Math.sin(t*.62)*.018;
  r.leftKnee.rotation.x=Math.max(0,-Math.sin(t*.62))*.018; r.rightKnee.rotation.x=Math.max(0,Math.sin(t*.62))*.018;
  r.leftAnkle.rotation.x=-r.leftKnee.rotation.x*.45; r.rightAnkle.rotation.x=-r.rightKnee.rotation.x*.45;
  const blink=Math.sin(t*2.8)>0.985?.16:1; r.leftEye.scale.y=blink; r.rightEye.scale.y=blink;
}

export async function mount():Promise<void>{
  const root=document.querySelector<HTMLElement>('#app'); if(!root) throw new Error('Missing #app mount');
  const epoch=root.dataset.pageEpoch??''; let disposed=false; let renderer:THREE.WebGLRenderer|null=null; let raf=0;
  const isCurrent=()=>!disposed&&root.dataset.pageEpoch===epoch&&root.dataset.pageOwner===OWNER;
  const cleanup=()=>{ if(disposed)return; disposed=true; cancelAnimationFrame(raf); renderer?.dispose(); window.removeEventListener('resize',resize); const host=window as CleanupHost; if(host.__rbPageCleanup===cleanup)host.__rbPageCleanup=null; };
  (window as CleanupHost).__rbPageCleanup=cleanup; window.addEventListener('pagehide',cleanup,{once:true}); window.addEventListener('beforeunload',cleanup,{once:true});
  const user=getAuthSnapshot().user; if(!user){ location.replace('/tap-in.html?next=%2Favatar-characters.html'); return; }
  const {data,error}=await supabase.rpc('rb_avatar_runtime_snapshot',{}); if(error) throw error; if(!isCurrent()) return;
  const snap=(data??{}) as Snapshot; const current=snap.avatar??{}; const display=String(current.display_name??snap.profile?.display_name??snap.profile?.username??'Rich Avatar');
  root.innerHTML=`<main class="ac-shell"><header><a class="back" href="/profile.html">←</a><div><small>RICH BIZNESS AVATAR STUDIO</small><h1>Build Your Character</h1></div><a href="/avatar.html" class="enter">OPEN LOBBY</a></header><section class="ac-layout"><div class="ac-stage"><div class="ac-stage-top"><span>FULL BODY · 18 JOINTS</span><b id="previewGender">BOY</b></div><canvas id="characterCanvas"></canvas><div class="ac-stage-copy"><strong id="previewName">${esc(display)}</strong><em id="previewStyle">ATHLETIC · STREET LUXE</em></div></div><aside class="ac-editor"><div class="section-title"><span>CHARACTER</span></div><div class="seg"><button data-gender="boy" class="active">BOY</button><button data-gender="girl">GIRL</button></div><label>NAME<input id="nameInput" value="${esc(display)}" maxlength="28"/></label><div class="edit-grid"><label>BUILD<select id="buildInput"><option value="athletic">ATHLETIC</option><option value="lean">LEAN</option><option value="heroic">HEROIC</option></select></label><label>STYLE<select id="styleInput"><option value="street">STREET LUXE</option><option value="boss">RICH BOSS</option><option value="tactical">TACTICAL</option><option value="cyber">CYBER</option></select></label></div><label>AURA<select id="auraInput"><option>Emerald Gold</option><option>Neon Phantom</option><option>Diamond Mist</option></select></label><div class="ac-actions"><button id="randomize">RANDOMIZE</button><button id="saveCharacter" class="primary">SAVE CHARACTER</button></div><p id="saveStatus">Full-body character saves into the lobby.</p></aside></section></main>`;

  const canvas=root.querySelector<HTMLCanvasElement>('#characterCanvas')!; const scene=new THREE.Scene(); scene.background=new THREE.Color(0xd9ebdf); scene.fog=new THREE.Fog(0xd9ebdf,18,42);
  const camera=new THREE.PerspectiveCamera(30,1,.1,100); camera.position.set(0,1.62,8.75);
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'}); renderer.setPixelRatio(Math.min(devicePixelRatio,2.25)); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.5; renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene.add(new THREE.HemisphereLight(0xffffff,0x64776a,3.2)); const key=new THREE.DirectionalLight(0xffffff,4.2); key.position.set(4,8,5); key.castShadow=true; scene.add(key); const fill=new THREE.PointLight(0x88ffba,34,16,2); fill.position.set(-3,2.8,4); scene.add(fill); const gold=new THREE.PointLight(0xffd96d,22,13,2); gold.position.set(3,1.8,4); scene.add(gold);
  const floor=mesh(new THREE.PlaneGeometry(18,18),new THREE.MeshStandardMaterial({color:0xedf5e9,roughness:.8})); floor.rotation.x=-Math.PI/2; floor.position.y=-1.42; scene.add(floor);
  const wall=mesh(new THREE.PlaneGeometry(18,10),new THREE.MeshStandardMaterial({color:0xc3dccb,roughness:.92})); wall.position.set(0,2,-5.8); scene.add(wall);

  let gender:Gender='boy'; const buildInput=root.querySelector<HTMLSelectElement>('#buildInput')!; const styleInput=root.querySelector<HTMLSelectElement>('#styleInput')!; const auraInput=root.querySelector<HTMLSelectElement>('#auraInput')!;
  const accent=()=>auraInput.value==='Neon Phantom'?0x8058ff:auraInput.value==='Diamond Mist'?0x8fe8ff:0x21ff82;
  let rig=createRig(gender,accent(),buildInput.value,styleInput.value); rig.root.position.y=.36; scene.add(rig.root);
  const rebuild=()=>{ scene.remove(rig.root); rig=createRig(gender,accent(),buildInput.value,styleInput.value); rig.root.position.y=.36; scene.add(rig.root); root.querySelector<HTMLElement>('#previewStyle')!.textContent=`${buildInput.value.toUpperCase()} · ${styleInput.options[styleInput.selectedIndex].text}`; };
  root.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach(btn=>btn.onclick=()=>{ gender=btn.dataset.gender==='girl'?'girl':'boy'; root.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach(x=>x.classList.toggle('active',x===btn)); root.querySelector<HTMLElement>('#previewGender')!.textContent=gender.toUpperCase(); rebuild(); });
  buildInput.onchange=rebuild; styleInput.onchange=rebuild; auraInput.onchange=rebuild;
  const nameInput=root.querySelector<HTMLInputElement>('#nameInput')!; nameInput.oninput=()=>{ root.querySelector<HTMLElement>('#previewName')!.textContent=nameInput.value||'Rich Avatar'; };
  root.querySelector<HTMLButtonElement>('#randomize')!.onclick=()=>{ gender=Math.random()>.5?'girl':'boy'; buildInput.selectedIndex=Math.floor(Math.random()*buildInput.options.length); styleInput.selectedIndex=Math.floor(Math.random()*styleInput.options.length); auraInput.selectedIndex=Math.floor(Math.random()*auraInput.options.length); root.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach(x=>x.classList.toggle('active',x.dataset.gender===gender)); root.querySelector<HTMLElement>('#previewGender')!.textContent=gender.toUpperCase(); rebuild(); };
  root.querySelector<HTMLButtonElement>('#saveCharacter')!.onclick=async()=>{ const status=root.querySelector<HTMLElement>('#saveStatus')!; status.textContent='Saving character…'; const {error:saveError}=await supabase.rpc('rb_save_avatar_studio',{p_display_name:nameInput.value||display,p_preset_key:`gta-${gender}`,p_aura:auraInput.value,p_outfit:{build:buildInput.value,style:styleInput.value,rig:'gta-articulated-v2'},p_accessories:{},p_smoke:{mode:'off'},p_emotes:{idle:true,walk:true,run:true,jump:true,power:true},p_character_type:gender==='girl'?'female':'male'}); status.textContent=saveError?saveError.message:'Saved. Full-body rig is ready in the lobby.'; };
  const clock=new THREE.Clock(); const resize=()=>{ const r=canvas.getBoundingClientRect(); renderer!.setSize(Math.max(1,r.width),Math.max(1,r.height),false); camera.aspect=r.width/Math.max(1,r.height); camera.updateProjectionMatrix(); }; window.addEventListener('resize',resize); resize();
  const loop=()=>{ if(disposed)return; const t=clock.getElapsedTime(); animateIdle(rig,t); rig.root.rotation.y=Math.sin(t*.32)*.16; renderer!.render(scene,camera); raf=requestAnimationFrame(loop); }; loop();
}
