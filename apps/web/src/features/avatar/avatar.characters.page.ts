import * as THREE from 'three';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import './avatar.characters.css';

type Snapshot={profile?:Record<string,any>;avatar?:Record<string,any>;presets?:Array<Record<string,any>>};
type CleanupHost=Window&{__rbPageCleanup?:(()=>void|Promise<void>)|null};
const OWNER='rich-bizness-avatar-characters-v1';
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]??c));

function makeCharacter(gender:'boy'|'girl',accent:number){
  const root=new THREE.Group();
  const skin=new THREE.MeshPhysicalMaterial({color:0x8b5a3c,roughness:.55,metalness:.02,clearcoat:.08});
  const suit=new THREE.MeshPhysicalMaterial({color:accent,roughness:.26,metalness:.28,clearcoat:.55,clearcoatRoughness:.2});
  const dark=new THREE.MeshStandardMaterial({color:0x101715,roughness:.46,metalness:.22});
  const hair=new THREE.MeshStandardMaterial({color:0x111111,roughness:.35,metalness:.05});
  const head=new THREE.Mesh(new THREE.SphereGeometry(.42,32,24),skin); head.scale.set(.92,1.06,.92); head.position.y=2.85; root.add(head);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.15,.17,.3,20),skin); neck.position.y=2.42; root.add(neck);
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(gender==='girl'?.48:.54,1.02,10,24),suit); torso.position.y=1.72; torso.scale.z=.62; root.add(torso);
  const hip=new THREE.Mesh(new THREE.SphereGeometry(.43,24,18),dark); hip.scale.set(gender==='girl'?1.02:.92,.62,.7); hip.position.y=.94; root.add(hip);
  const armX=gender==='girl'?.55:.62;
  for(const side of [-1,1]){
    const upper=new THREE.Mesh(new THREE.CapsuleGeometry(.13,.68,8,18),skin); upper.position.set(side*armX,1.78,0); upper.rotation.z=side*.05; root.add(upper);
    const lower=new THREE.Mesh(new THREE.CapsuleGeometry(.115,.58,8,18),skin); lower.position.set(side*armX,1.12,.02); root.add(lower);
    const hand=new THREE.Mesh(new THREE.SphereGeometry(.14,18,14),skin); hand.position.set(side*armX,.76,.02); root.add(hand);
    const thigh=new THREE.Mesh(new THREE.CapsuleGeometry(.16,.82,8,18),dark); thigh.position.set(side*.23,.38,0); root.add(thigh);
    const shin=new THREE.Mesh(new THREE.CapsuleGeometry(.145,.76,8,18),dark); shin.position.set(side*.23,-.45,0); root.add(shin);
    const shoe=new THREE.Mesh(new THREE.BoxGeometry(.31,.2,.54),dark); shoe.position.set(side*.23,-.94,.12); root.add(shoe);
  }
  const hairCap=new THREE.Mesh(new THREE.SphereGeometry(.43,28,16,0,Math.PI*2,0,Math.PI*.48),hair); hairCap.position.set(0,3.05,0); hairCap.scale.set(1.04,.66,1.03); root.add(hairCap);
  const eyeMat=new THREE.MeshBasicMaterial({color:0xffffff});
  const pupilMat=new THREE.MeshBasicMaterial({color:0x101010});
  for(const x of [-.14,.14]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.052,14,10),eyeMat);eye.position.set(x,2.92,.37);root.add(eye);const pupil=new THREE.Mesh(new THREE.SphereGeometry(.023,10,8),pupilMat);pupil.position.set(x,2.92,.414);root.add(pupil);}
  root.traverse(o=>{if((o as THREE.Mesh).isMesh){const m=o as THREE.Mesh;m.castShadow=true;m.receiveShadow=true;}});
  return root;
}

export async function mount():Promise<void>{
  const root=document.querySelector<HTMLElement>('#app'); if(!root) throw new Error('Missing #app mount');
  const epoch=root.dataset.pageEpoch??''; let disposed=false; const isCurrent=()=>!disposed&&root.dataset.pageEpoch===epoch&&root.dataset.pageOwner===OWNER;
  const cleanup=()=>{if(disposed)return;disposed=true;renderer?.dispose();cancelAnimationFrame(raf);window.removeEventListener('resize',resize);const host=window as CleanupHost;if(host.__rbPageCleanup===cleanup)host.__rbPageCleanup=null;};
  (window as CleanupHost).__rbPageCleanup=cleanup; window.addEventListener('pagehide',cleanup,{once:true}); window.addEventListener('beforeunload',cleanup,{once:true});
  const user=getAuthSnapshot().user; if(!user){location.replace('/tap-in.html?next=%2Favatar-characters.html');return;}
  const {data,error}=await supabase.rpc('rb_avatar_runtime_snapshot',{}); if(error) throw error; if(!isCurrent()) return;
  const snapshot=(data??{}) as Snapshot; const current=snapshot.avatar??{}; const display=String(current.display_name??snapshot.profile?.display_name??snapshot.profile?.username??'Rich Avatar');
  root.innerHTML=`<main class="ac-shell"><header><a href="/profile.html">← PROFILE</a><div><small>RICH BIZNESS CHARACTER STUDIO</small><h1>Choose Your GTA Avatar</h1><p>Snap-style character building with a premium street-world finish.</p></div><a href="/avatar.html" class="enter">ENTER LOBBY</a></header><section class="ac-layout"><div class="ac-stage"><canvas id="characterCanvas"></canvas><div class="ac-stage-copy"><span>LIVE PREVIEW</span><strong id="previewName">${esc(display)}</strong><em id="previewGender">BOY</em></div></div><aside class="ac-editor"><div class="seg"><button data-gender="boy" class="active">BOY</button><button data-gender="girl">GIRL</button></div><label>CHARACTER NAME<input id="nameInput" value="${esc(display)}" maxlength="28"/></label><label>BUILD<select id="buildInput"><option value="athletic">ATHLETIC</option><option value="lean">LEAN</option><option value="heroic">HEROIC</option></select></label><label>STYLE<select id="styleInput"><option value="street">STREET LUXE</option><option value="boss">RICH BOSS</option><option value="tactical">TACTICAL</option><option value="cyber">CYBER</option></select></label><label>AURA<select id="auraInput"><option>Emerald Gold</option><option>Neon Phantom</option><option>Diamond Mist</option></select></label><div class="ac-actions"><button id="randomize">RANDOMIZE</button><button id="saveCharacter" class="primary">SAVE CHARACTER</button></div><p id="saveStatus">Saved characters sync to the avatar lobby.</p></aside></section></main>`;
  const canvas=root.querySelector<HTMLCanvasElement>('#characterCanvas')!; const scene=new THREE.Scene(); scene.background=new THREE.Color(0x102417); scene.fog=new THREE.Fog(0x102417,8,20);
  const camera=new THREE.PerspectiveCamera(34,1,.1,100); camera.position.set(0,2.2,8.7);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'}); renderer.setPixelRatio(Math.min(devicePixelRatio,2.25)); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.35; renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene.add(new THREE.HemisphereLight(0xc9ffe0,0x0a130d,2.15)); const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(4,7,5);key.castShadow=true;scene.add(key);const rim=new THREE.PointLight(0x42ff9a,35,15,2);rim.position.set(-3,2,2);scene.add(rim);const gold=new THREE.PointLight(0xffd95b,24,12,2);gold.position.set(3,1,3);scene.add(gold);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(5.2,64),new THREE.MeshStandardMaterial({color:0x183121,roughness:.5,metalness:.16}));floor.rotation.x=-Math.PI/2;floor.position.y=-1.06;floor.receiveShadow=true;scene.add(floor);
  const city=new THREE.Group(); for(let i=0;i<18;i++){const h=2.2+Math.random()*5.5;const b=new THREE.Mesh(new THREE.BoxGeometry(.8+Math.random()*1.2,h,.8+Math.random()*1.4),new THREE.MeshStandardMaterial({color:i%2?0x17311e:0x233f2a,roughness:.7,metalness:.08,emissive:i%3===0?0x082d16:0x000000,emissiveIntensity:.5}));b.position.set((Math.random()-.5)*14,h/2-1,(Math.random()-.5)*8-5);city.add(b);}scene.add(city);
  let gender:'boy'|'girl'='boy'; let character=makeCharacter(gender,0x24ff89); scene.add(character);
  const genderButtons=[...root.querySelectorAll<HTMLButtonElement>('[data-gender]')]; const previewGender=root.querySelector<HTMLElement>('#previewGender')!; const auraInput=root.querySelector<HTMLSelectElement>('#auraInput')!;
  const rebuild=()=>{scene.remove(character);character=makeCharacter(gender,auraInput.value==='Neon Phantom'?0x8058ff:auraInput.value==='Diamond Mist'?0x8fe8ff:0x24ff89);scene.add(character);};
  genderButtons.forEach(btn=>btn.onclick=()=>{gender=btn.dataset.gender==='girl'?'girl':'boy';genderButtons.forEach(x=>x.classList.toggle('active',x===btn));previewGender.textContent=gender.toUpperCase();rebuild();}); auraInput.onchange=rebuild;
  const nameInput=root.querySelector<HTMLInputElement>('#nameInput')!; nameInput.oninput=()=>{root.querySelector<HTMLElement>('#previewName')!.textContent=nameInput.value||'Rich Avatar';};
  root.querySelector<HTMLButtonElement>('#randomize')!.onclick=()=>{gender=Math.random()>.5?'girl':'boy';genderButtons.forEach(x=>x.classList.toggle('active',x.dataset.gender===gender));previewGender.textContent=gender.toUpperCase();auraInput.selectedIndex=Math.floor(Math.random()*auraInput.options.length);rebuild();};
  root.querySelector<HTMLButtonElement>('#saveCharacter')!.onclick=async()=>{const status=root.querySelector<HTMLElement>('#saveStatus')!;status.textContent='Saving character…';const {error:saveError}=await supabase.rpc('rb_save_avatar_studio',{p_display_name:nameInput.value||display,p_preset_key:`gta-${gender}`,p_aura:auraInput.value,p_outfit:{build:root.querySelector<HTMLSelectElement>('#buildInput')!.value,style:root.querySelector<HTMLSelectElement>('#styleInput')!.value,rig:'gta-avatar-v1'},p_accessories:{},p_smoke:{mode:'off'},p_emotes:{idle:true,walk:true,run:true},p_character_type:gender==='girl'?'female':'male'});status.textContent=saveError?saveError.message:'Character saved. Open the lobby to use it.';};
  const clock=new THREE.Clock(); let raf=0; const animate=()=>{if(disposed)return;const t=clock.getElapsedTime();character.rotation.y=Math.sin(t*.55)*.22;character.position.y=Math.sin(t*1.7)*.018;renderer.render(scene,camera);raf=requestAnimationFrame(animate);};
  const resize=()=>{const r=canvas.getBoundingClientRect();renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);camera.aspect=r.width/Math.max(1,r.height);camera.updateProjectionMatrix();}; window.addEventListener('resize',resize);resize();animate();
}