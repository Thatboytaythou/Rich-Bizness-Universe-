import * as THREE from 'three';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import {
  disposeSkinnedAvatar,
  loadSkinnedAvatar,
  qualityProfile,
  resolveAvatarModelUrl,
  setAvatarMotion,
  updateSkinnedAvatar,
  type AvatarGender,
  type AvatarMotion,
  type SkinnedAvatarRuntime
} from './avatar.skinned.runtime';
import './avatar.characters.css';

type Snapshot = {
  profile?: Record<string, any>;
  avatar?: Record<string, any>;
  loadout?: Record<string, any>;
  model?: Record<string, any>;
  inventory?: Array<{ item: Record<string, any>; equipped: boolean }>;
  product_unlocks?: Array<Record<string, any>>;
  items?: Array<Record<string, any>>;
  products?: StoreDrop[];
  presets?: Array<Record<string, any>>;
};
type CleanupHost = Window & { __rbPageCleanup?: (() => void | Promise<void>) | null };
const OWNER = 'rich-bizness-avatar-characters-v1';
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c] ?? c));
const auraColor = (aura: string) => aura === 'Neon Phantom' ? 0x765dff : aura === 'Diamond Mist' ? 0x76d8ff : 0x21df81;

type StoreDrop = { id:string; title:string; description?:string|null; category?:string|null; product_type?:string|null; fulfillment_type?:string|null; price_cents?:number|null; currency?:string|null; image_url?:string|null; cover_url?:string|null; preview_url?:string|null; inventory_count?:number|null; is_digital?:boolean|null; is_featured?:boolean|null; avatar_item_key?:string|null; seller_name?:string|null };
type AvatarCatalogSnapshot = { items?:Record<string,any>[]; inventory?:Array<{item:Record<string,any>;equipped:boolean}> };
const formatDropPrice=(value:unknown,currency='usd')=>new Intl.NumberFormat('en-US',{style:'currency',currency:String(currency||'usd').toUpperCase()}).format(Number(value??0)/100);

type TabKey = 'fashion' | 'closet' | 'avatar';
type CategoryKey = 'featured' | 'head' | 'outfit' | 'bottom' | 'shoes' | 'face' | 'neck' | 'back' | 'hand' | 'aura';
const CATEGORY_LABELS: Record<CategoryKey, string> = { featured:'Featured', head:'Headwear', outfit:'Tops', bottom:'Bottoms', shoes:'Shoes', face:'Face', neck:'Chains', back:'Back', hand:'Handheld', aura:'Auras' };
const CATEGORY_TYPES: Record<CategoryKey, string[]> = { featured:[], head:['head'], outfit:['outfit'], bottom:['bottom'], shoes:['shoes'], face:['face','glasses'], neck:['neck','chain'], back:['back'], hand:['hand','weapon'], aura:['aura'] };
const GLYPHS: Record<CategoryKey,string> = { featured:'✦',head:'♜',outfit:'T',bottom:'▤',shoes:'⌁',face:'◉',neck:'◇',back:'♧',hand:'⚔',aura:'✧' };

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  const epoch = root.dataset.pageEpoch ?? '';
  let disposed = false;
  let renderer: THREE.WebGLRenderer | null = null;
  let runtime: SkinnedAvatarRuntime | null = null;
  let raf = 0;
  let resize = () => {};
  const abort = new AbortController();
  const isCurrent = () => !disposed && root.dataset.pageEpoch === epoch && root.dataset.pageOwner === OWNER;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    abort.abort();
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    if (runtime) disposeSkinnedAvatar(runtime);
    renderer?.dispose();
    const host = window as CleanupHost;
    if (host.__rbPageCleanup === cleanup) host.__rbPageCleanup = null;
  };
  (window as CleanupHost).__rbPageCleanup = cleanup;
  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });

  const user = getAuthSnapshot().user;
  if (!user) { location.replace('/tap-in.html?next=%2Favatar-characters.html'); return; }
  const [{data,error},{data:dropData,error:dropError}] = await Promise.all([supabase.rpc('rb_avatar_runtime_snapshot', {}),supabase.rpc('rb_store_catalog',{p_limit:120})]);
  if (error) throw error;
  if (!isCurrent()) return;

  const snap = (data ?? {}) as Snapshot;
  const drops = ((dropData ?? []) as StoreDrop[]).filter(drop => Boolean(drop.avatar_item_key) && drop.is_digital !== false);
  if (dropError) console.warn('Avatar drop catalog unavailable:',dropError.message);
  const current = snap.avatar ?? {};
  const loadout = snap.loadout ?? {};
  const outfit = loadout.outfit_config ?? current.metadata?.outfit ?? {};
  const display = String(current.display_name ?? loadout.display_name ?? snap.profile?.display_name ?? snap.profile?.username ?? 'Rich Avatar');
  const currentKind = String(current.character_type ?? 'male');
  let gender: AvatarGender = currentKind === 'female' ? 'girl' : 'boy';
  const initialBuild = String(outfit.build ?? 'athletic');
  const initialStyle = String(outfit.style ?? 'street');
  const initialAura = String(current.aura ?? loadout.aura_config?.name ?? 'Emerald Gold');

  let tab: TabKey = 'fashion';
  let category: CategoryKey = 'featured';
  let selectedItemKey = '';
  let ownedKeys = new Set((snap.inventory ?? []).map(row => String(row.item?.item_key ?? '')).filter(Boolean));
  const unlockedProductIds = new Set((snap.product_unlocks ?? []).map(row => String(row.product_id ?? '')));
  let equippedKeys = new Set((snap.inventory ?? []).filter(row => row.equipped).map(row => String(row.item?.item_key ?? '')));
  let catalog = (snap.items ?? []).filter(item => item.is_active !== false);
  const categoryMarkup = () => (Object.keys(CATEGORY_LABELS) as CategoryKey[]).map(key =>
    '<button type="button" class="ac-category '+(category===key?'active':'')+'" data-category="'+key+'"><span>'+GLYPHS[key]+'</span><small>'+CATEGORY_LABELS[key]+'</small></button>'
  ).join('');
  const itemMarkup = () => {
    const types = CATEGORY_TYPES[category];
    const visible = catalog.filter(item => category==='featured' || types.includes(String(item.item_type ?? '').toLowerCase()))
      .filter(item => tab!=='closet' || ownedKeys.has(String(item.item_key)));
    const drops = (snap.product_unlocks ?? []);
    const pieces = visible.map(item => {
      const key=String(item.item_key ?? ''), owned=ownedKeys.has(key), equipped=equippedKeys.has(key);
      const image=String(item.config?.image_url ?? item.config?.thumbnail_url ?? '');
      return '<button type="button" class="ac-item '+(selectedItemKey===key?'selected':'')+'" data-item="'+esc(key)+'" aria-pressed="'+(selectedItemKey===key)+'"><span class="ac-item-art">'+(image?'<img src="'+esc(image)+'" alt="">':GLYPHS[category])+'</span><span class="ac-item-title">'+esc(item.title)+'</span><small>'+esc(String(item.rarity ?? 'common').toUpperCase())+'</small><em>'+(equipped?'EQUIPPED':owned?'IN CLOSET':'PREVIEW')+'</em></button>';
    });
    const linkedDrops = tab==='closet' ? drops : [];
    const dropCards=linkedDrops.map(drop=>{
      const product=drop.product ?? {};
      const image=product.cover_url||product.image_url||'';
      return '<article class="ac-drop-card"><div class="ac-drop-image">'+(image?'<img src="'+esc(image)+'" alt="">':'<span>RB</span>')+'<b>UNLOCKED</b></div><div class="ac-drop-body"><strong>'+esc(product.title||'Exclusive Rich Bizness Drop')+'</strong><span>OWNED</span><small>Unlocked '+esc(new Date(String(drop.unlocked_at||'')).toLocaleDateString())+'</small><button type="button" data-drop="'+esc(drop.product_id)+'">VIEW DROP</button></div></article>';
    });
    const empty=!pieces.length&&!dropCards.length;
    return (pieces.join('')+dropCards.join('')) || '<div class="ac-empty"><strong>'+ (tab==='closet'?'Your closet is waiting':'No exclusive drops in this lane yet') +'</strong><span>'+ (tab==='closet'?'Paid avatar unlocks and owned gear will show here.':'New collections will appear here when exclusive drops are released.') +'</span></div>';
  };
  const renderCatalog = () => {
    root.querySelector<HTMLElement>('#acCategories')!.innerHTML=categoryMarkup();
    root.querySelector<HTMLElement>('#acItems')!.innerHTML=itemMarkup();
    root.querySelector<HTMLElement>('#acCollectionTitle')!.textContent=tab==='closet'?'YOUR CLOSET':category==='featured'?'TRENDING NOW':CATEGORY_LABELS[category].toUpperCase();
    root.querySelector<HTMLElement>('#acCollectionCount')!.textContent=String(catalog.filter(item=>tab!=='closet'||ownedKeys.has(String(item.item_key))).length)+' PIECES';
  };

  root.innerHTML = '<main class="ac-shell ac-studio"><header class="ac-appbar"><a class="back" href="/profile.html" aria-label="Back to profile">×</a><div><small>RICH BIZNESS AVATAR STUDIO</small><h1>Build Your Look</h1></div><button type="button" class="ac-save" id="saveCharacter">Save</button></header><section class="ac-layout"><div class="ac-stage"><canvas id="characterCanvas"></canvas><div class="ac-stage-top"><span>LIVE CHARACTER PREVIEW</span><b id="previewGender">'+gender.toUpperCase()+'</b></div><div class="ac-stage-copy"><strong id="previewName">'+esc(display)+'</strong><em id="previewStyle">'+esc(initialBuild.toUpperCase())+' · '+esc(initialStyle.toUpperCase())+'</em></div><div class="ac-motion"><button type="button" data-motion="idle" class="active">IDLE</button><button type="button" data-motion="walk">WALK</button><button type="button" data-motion="run">RUN</button><button type="button" data-motion="power">POSE</button></div><div class="ac-loading" id="characterLoading">LOADING CHARACTER…</div></div><div class="ac-wardrobe"><nav class="ac-main-tabs" role="tablist" aria-label="Avatar studio sections"><button type="button" data-tab="fashion" class="active"><span>♙</span>Fashion</button><button type="button" data-tab="closet"><span>♡</span>Closet</button><button type="button" data-tab="avatar"><span>◎</span>Avatar</button></nav><div class="ac-category-rail" id="acCategories">'+categoryMarkup()+'</div><div class="ac-collection-head"><span class="ac-brand-mark">RB</span><strong id="acCollectionTitle">TRENDING NOW</strong><small id="acCollectionCount"></small></div><div class="ac-grid" id="acItems">'+itemMarkup()+'</div><div class="ac-selected-panel" id="acSelectedPanel"><strong>Select a piece to preview it</strong><span>Tap an item to see its details and outfit options</span></div><div class="ac-editor"><div class="section-title"><span>YOUR CHARACTER</span></div><div class="seg"><button type="button" data-gender="boy" class="'+(gender==='boy'?'active':'')+'">BOY</button><button type="button" data-gender="girl" class="'+(gender==='girl'?'active':'')+'">GIRL</button></div><label>DISPLAY NAME<input id="nameInput" value="'+esc(display)+'" maxlength="28"/></label><div class="edit-grid"><label>BODY<select id="buildInput"><option value="athletic">ATHLETIC</option><option value="lean">LEAN</option><option value="heroic">HEROIC</option></select></label><label>STYLE<select id="styleInput"><option value="street">STREET</option><option value="boss">BOSS</option><option value="tactical">TACTICAL</option><option value="cyber">CYBER</option></select></label></div><label>AURA<select id="auraInput"><option>Emerald Gold</option><option>Neon Phantom</option><option>Diamond Mist</option></select></label><div class="ac-actions"><button type="button" id="randomize">SURPRISE ME</button><p id="saveStatus" role="status">Your changes appear on the character preview.</p></div></div></div></section></main>';
  root.querySelector<HTMLElement>('.ac-editor')!.hidden = true;
  root.querySelector<HTMLElement>('#acCategories')!.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-category]');
    if (!button) return;
    category = button.dataset.category as CategoryKey;
    tab = 'fashion';
    root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(item => item.classList.toggle('active', item.dataset.tab === 'fashion'));
    root.querySelector<HTMLElement>('.ac-editor')!.hidden = true;
    renderCatalog();
  });

  const canvas = root.querySelector<HTMLCanvasElement>('#characterCanvas')!;
  const buildInput = root.querySelector<HTMLSelectElement>('#buildInput')!;
  const styleInput = root.querySelector<HTMLSelectElement>('#styleInput')!;
  const auraInput = root.querySelector<HTMLSelectElement>('#auraInput')!;
  const nameInput = root.querySelector<HTMLInputElement>('#nameInput')!;
  buildInput.value = ['athletic','lean','heroic'].includes(initialBuild) ? initialBuild : 'athletic';
  styleInput.value = ['street','boss','tactical','cyber'].includes(initialStyle) ? initialStyle : 'street';
  auraInput.value = ['Emerald Gold','Neon Phantom','Diamond Mist'].includes(initialAura) ? initialAura : 'Emerald Gold';


  const itemByKey=(key:string)=>catalog.find(item=>String(item.item_key)===key);
  const selectedPanel=root.querySelector<HTMLElement>('#acSelectedPanel')!;
  const showItem=(key:string)=>{
    selectedItemKey=key;
    const item=itemByKey(key);
    if (!item) { selectedPanel.innerHTML='<strong>Choose a wardrobe piece</strong><span>Choose a piece to see its details</span>'; return; }
    const owned=ownedKeys.has(key),equipped=equippedKeys.has(key);
    selectedPanel.innerHTML='<strong>'+esc(item.title)+'</strong><span>'+esc(String(item.rarity??'common').toUpperCase())+' · '+(owned?'In your closet':'Preview only')+'</span><button type="button" id="acEquip" '+(owned?'':'disabled')+'>'+(equipped?'REMOVE ITEM':owned?'WEAR ITEM':'NOT UNLOCKED')+'</button>';
    selectedPanel.querySelector<HTMLButtonElement>('#acEquip')?.addEventListener('click',async()=>{
      const btn=selectedPanel.querySelector<HTMLButtonElement>('#acEquip')!;btn.disabled=true;
      const {data,error}=await supabase.rpc('rb_avatar_set_item',{p_item_key:key,p_equipped:!equipped});
      if(error){root.querySelector<HTMLElement>('#saveStatus')!.textContent=error.message;btn.disabled=false;return;}
      const rows=(data as Snapshot)?.inventory??[];
      equippedKeys=new Set(rows.filter(row=>row.equipped).map(row=>String(row.item?.item_key??'')));
      renderCatalog();showItem(key);
      root.querySelector<HTMLElement>('#saveStatus')!.textContent=equipped?'Removed from outfit':'Item equipped and saved';
    });
  };
  root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button=>button.addEventListener('click',()=>{
    tab=button.dataset.tab as TabKey;
    root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(el=>el.classList.toggle('active',el===button));
    root.querySelector<HTMLElement>('.ac-editor')!.hidden=tab!=='avatar';
    root.querySelector<HTMLElement>('#acCategories')!.hidden=tab==='closet';
    selectedItemKey='';
    selectedPanel.innerHTML='<strong>Select a wardrobe piece</strong><span>Owned items are ready to equip from your closet</span>';
    renderCatalog();
  }));
  root.querySelector<HTMLElement>('#acCategories')!.addEventListener('click',event=>{
    const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-category]');
    if(!button)return;
    category=button.dataset.category as CategoryKey;tab='fashion';
    root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(el=>el.classList.toggle('active',el.dataset.tab==='fashion'));
    renderCatalog();
  });
  root.querySelector<HTMLElement>('#acItems')!.addEventListener('click',event=>{
    const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-item]');
    if(button)showItem(button.dataset.item??'');
  });
  renderCatalog();

  root.querySelector<HTMLElement>('#acItems')!.addEventListener('click',event=>{
    const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-drop]');
    if(button) location.href='/store.html?product='+encodeURIComponent(button.dataset.drop||'');
  });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb9d4df);
  scene.fog = new THREE.Fog(0xb9d4df, 16, 42);
  const camera = new THREE.PerspectiveCamera(34, 1, .08, 70);
  camera.position.set(0, 1.55, 4.8);
  const quality = qualityProfile();
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(quality.dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.add(new THREE.HemisphereLight(0xf5fcff, 0x5a655d, 2.7));
  const key = new THREE.DirectionalLight(0xfff0d3, 3.1);
  key.position.set(5, 9, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fd7ff, 1.35);
  fill.position.set(-5, 4, 3);
  scene.add(fill);
  const auraLight = new THREE.PointLight(auraColor(auraInput.value), 2.2, 7, 2);
  auraLight.position.set(-2, 1.4, 2.2);
  scene.add(auraLight);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(3.4, 72), new THREE.MeshStandardMaterial({ color: 0x52605a, roughness: .82 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.02;
  floor.receiveShadow = true;
  scene.add(floor);
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), new THREE.MeshStandardMaterial({ color: 0x8aa9b3, roughness: .86 }));
  backWall.position.set(0, 2.15, -2.2);
  scene.add(backWall);

  let motion: AvatarMotion = 'idle';
  let loadGeneration = 0;
  let userYaw = 0;
  let dragging = false;
  let dragStartX = 0;
  let dragStartYaw = 0;

  const modelSnapshotFor = (nextGender: AvatarGender) => {
    const modelBodyType = String(snap.model?.body_type ?? '').toLowerCase();
    const matches = (nextGender === 'girl' && modelBodyType === 'female') || (nextGender === 'boy' && modelBodyType === 'male');
    return matches ? snap as Record<string, any> : ({ model: null } as Record<string, any>);
  };

  const applyBuildScale = () => {
    if (!runtime) return;
    const xScale = buildInput.value === 'lean' ? .95 : buildInput.value === 'heroic' ? 1.035 : 1;
    runtime.root.scale.x = xScale;
    runtime.root.updateMatrixWorld(true);
  };

  const loadCharacter = async () => {
    const generation = ++loadGeneration;
    const loading = root.querySelector<HTMLElement>('#characterLoading');
    if (loading) loading.textContent = 'LOADING CHARACTER…';
    if (runtime) {
      scene.remove(runtime.root);
      disposeSkinnedAvatar(runtime);
      runtime = null;
    }
    try {
      const next = await loadSkinnedAvatar({
        modelUrl: resolveAvatarModelUrl(modelSnapshotFor(gender), gender),
        targetHeight: gender === 'girl' ? 1.72 : 1.82,
        signal: abort.signal
      });
      if (!isCurrent() || generation !== loadGeneration) { disposeSkinnedAvatar(next); return; }
      runtime = next;
      runtime.root.position.set(0, 0, 0);
      runtime.root.rotation.y = userYaw;
      applyBuildScale();
      scene.add(runtime.root);
      setAvatarMotion(runtime, motion, 0);
      root.querySelector<HTMLElement>('#characterLoading')?.remove();
    } catch (loadError) {
      if (!isCurrent()) return;
      const target = root.querySelector<HTMLElement>('#characterLoading');
      if (target) target.textContent = `CHARACTER LOAD FAILED: ${loadError instanceof Error ? loadError.message : 'UNKNOWN ERROR'}`;
    }
  };

  await loadCharacter();


  root.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach(button=>button.onclick=async()=>{
    gender=button.dataset.gender==='girl'?'girl':'boy';
    root.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach(item=>item.classList.toggle('active',item===button));
    root.querySelector<HTMLElement>('#previewGender')!.textContent=gender.toUpperCase();
    await loadCharacter();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-motion]').forEach(button=>button.onclick=()=>{
    motion=(button.dataset.motion??'idle') as AvatarMotion;
    root.querySelectorAll<HTMLButtonElement>('[data-motion]').forEach(item=>item.classList.toggle('active',item===button));
    if(runtime)setAvatarMotion(runtime,motion);
  });
  buildInput.onchange=()=>{applyBuildScale();root.querySelector<HTMLElement>('#previewStyle')!.textContent=buildInput.value.toUpperCase()+' · '+styleInput.value.toUpperCase()};
  styleInput.onchange=()=>{root.querySelector<HTMLElement>('#previewStyle')!.textContent=buildInput.value.toUpperCase()+' · '+styleInput.value.toUpperCase()};
  auraInput.onchange=()=>auraLight.color.setHex(auraColor(auraInput.value));
  nameInput.oninput=()=>root.querySelector<HTMLElement>('#previewName')!.textContent=nameInput.value||'Rich Avatar';
  root.querySelector<HTMLButtonElement>('#randomize')!.onclick=async()=>{
    gender=Math.random()>.5?'girl':'boy';
    buildInput.selectedIndex=Math.floor(Math.random()*buildInput.options.length);
    styleInput.selectedIndex=Math.floor(Math.random()*styleInput.options.length);
    auraInput.selectedIndex=Math.floor(Math.random()*auraInput.options.length);
    auraLight.color.setHex(auraColor(auraInput.value));
    root.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach(item=>item.classList.toggle('active',item.dataset.gender===gender));
    root.querySelector<HTMLElement>('#previewGender')!.textContent=gender.toUpperCase();
    root.querySelector<HTMLElement>('#previewStyle')!.textContent=buildInput.value.toUpperCase()+' · '+styleInput.value.toUpperCase();
    await loadCharacter();
  };
  root.querySelector<HTMLButtonElement>('#saveCharacter')!.onclick=async()=>{
    const status=root.querySelector<HTMLElement>('#saveStatus')!,button=root.querySelector<HTMLButtonElement>('#saveCharacter')!;
    status.textContent='Saving character…';button.disabled=true;
    try{
      const {error:saveError}=await supabase.rpc('rb_save_avatar_studio',{
        p_display_name:nameInput.value||display,
        p_preset_key:gender==='girl'?'street_queen_hd':'street_king_hd',
        p_aura:auraInput.value,
        p_outfit:{build:buildInput.value,style:styleInput.value,rig:'skinned-humanoid-v1'},
        p_accessories:Object.fromEntries([...equippedKeys].map(key=>[key,true])),
        p_smoke:{mode:'off'},p_emotes:{idle:true,walk:true,run:true,jump:true,power:true},
        p_character_type:gender==='girl'?'female':'male'
      });
      status.textContent=saveError?saveError.message:'Saved. Your character and outfit are linked to your profile.';
    }catch(error){status.textContent=error instanceof Error?error.message:'Could not save character'}
    finally{button.disabled=false}
  };

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    dragStartX = event.clientX;
    dragStartYaw = userYaw;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    userYaw = dragStartYaw + (event.clientX - dragStartX) * .012;
    if (runtime) runtime.root.rotation.y = userYaw;
  });
  const stopDrag = () => { dragging = false; };
  canvas.addEventListener('pointerup', stopDrag);
  canvas.addEventListener('pointercancel', stopDrag);

  resize = () => {
    if (!renderer) return;
    const rect = canvas.getBoundingClientRect();
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
    camera.aspect = rect.width / Math.max(1, rect.height);
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  const clock = new THREE.Clock();
  const loop = () => {
    if (disposed || !renderer) return;
    const dt = Math.min(clock.getDelta(), .04);
    if (runtime) {
      updateSkinnedAvatar(runtime, dt);
      const target = new THREE.Vector3(0, runtime.height * .52, 0);
      camera.lookAt(target);
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  loop();
}
