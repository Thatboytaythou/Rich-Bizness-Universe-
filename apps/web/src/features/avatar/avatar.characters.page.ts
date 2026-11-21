import * as THREE from 'three';
import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import {
  applyAvatarBodyShape,
  attachSkinnedWearable,
  disposeSkinnedAvatar,
  loadSkinnedAvatar,
  loadSkinnedWearable,
  qualityProfile,
  removeSkinnedWearable,
  resolveAvatarItemUrl,
  resolveAvatarModelUrl,
  setAvatarMotion,
  updateSkinnedAvatar,
  type AvatarGender,
  type AvatarMotion,
  type AvatarAssetDescriptor,
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
  presets?: Array<Record<string, any>>;
};
type CleanupHost = Window & { __rbPageCleanup?: (() => void | Promise<void>) | null };
const OWNER = 'rich-bizness-avatar-characters-v1';
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c] ?? c));
const auraColor = (aura: string) => aura === 'Neon Phantom' ? 0x765dff : aura === 'Diamond Mist' ? 0x76d8ff : 0x21df81;

type StoreDrop = { id:string; title:string; description?:string|null; category?:string|null; product_type?:string|null; fulfillment_type?:string|null; price_cents?:number|null; currency?:string|null; image_url?:string|null; cover_url?:string|null; preview_url?:string|null; inventory_count?:number|null; is_digital?:boolean|null; is_featured?:boolean|null; avatar_item_key?:string|null; seller_name?:string|null };

type TabKey = 'fashion' | 'closet' | 'avatar';
type CategoryKey = 'featured' | 'hair' | 'head' | 'face' | 'neck' | 'outfit' | 'bottom' | 'shoes' | 'back' | 'hand' | 'aura';
const CATEGORY_LABELS: Record<CategoryKey, string> = { featured:'Featured', hair:'Hair', head:'Headwear', face:'Face & Eyewear', neck:'Jewelry', outfit:'Tops & Jackets', bottom:'Bottoms', shoes:'Footwear', back:'Back', hand:'Handheld', aura:'Auras' };
const CATEGORY_TYPES: Record<CategoryKey, string[]> = { featured:[], hair:['hair'], head:['head','hat'], face:['face','glasses','mask','eyewear','ear'], neck:['neck','chain','jewelry','bracelet','watch','ring'], outfit:['outfit','top','jacket','coat','hoodie','vest'], bottom:['bottom','pants','shorts','skirt'], shoes:['shoes','shoe','boots','slides'], back:['back','backpack','wings','cape'], hand:['hand','weapon','prop','glove'], aura:['aura'] };
const GLYPHS: Record<CategoryKey,string> = { featured:'✦',hair:'♧',head:'♜',face:'◉',neck:'◇',outfit:'T',bottom:'▤',shoes:'⌁',back:'♧',hand:'⚔',aura:'✧' };

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
  const { data, error } = await supabase.rpc('rb_avatar_runtime_snapshot', {});
  if (error) throw error;
  if (!isCurrent()) return;

  const snap = (data ?? {}) as Snapshot;
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
  let equippedKeys = new Set((snap.inventory ?? []).filter(row => row.equipped).map(row => String(row.item?.item_key ?? '')));
  let catalog = (snap.items ?? []).filter(item => item.is_active !== false);
  const categoryMarkup = () => (Object.keys(CATEGORY_LABELS) as CategoryKey[]).map(key =>
    '<button type="button" class="ac-category '+(category===key?'active':'')+'" data-category="'+key+'"><span>'+GLYPHS[key]+'</span><small>'+CATEGORY_LABELS[key]+'</small></button>'
  ).join('');
  const itemMarkup = () => {
    const types = CATEGORY_TYPES[category];
    const visible = catalog.filter(item => category==='featured' || types.includes(String(item.config?.asset?.slot ?? item.item_type ?? '').toLowerCase()) || types.includes(String(item.item_type ?? '').toLowerCase()))
      .filter(item => tab!=='closet' || ownedKeys.has(String(item.item_key)));
    const pieces = visible.map(item => {
      const key=String(item.item_key ?? ''), owned=ownedKeys.has(key), equipped=equippedKeys.has(key);
      const image=String(item.config?.thumbnail_url ?? item.config?.image_url ?? '');
      const slot=String(item.config?.asset?.slot ?? item.item_type ?? '');
      const assetTagged=Boolean(item.config?.asset?.mesh_path && item.config?.asset?.thumbnail_path && item.config?.asset?.rig_key);
      const state=equipped?'SAVED LOADOUT':owned?'IN CLOSET':assetTagged?'ASSET TAGGED':'ART PENDING';
      return '<button type="button" class="ac-item '+(selectedItemKey===key?'selected':'')+'" data-item="'+esc(key)+'" aria-pressed="'+(selectedItemKey===key)+'"><span class="ac-item-art">'+(image?'<img src="'+esc(image)+'" alt="">':GLYPHS[category])+'</span><span class="ac-item-title">'+esc(item.title)+'</span><small>'+esc(String(item.rarity ?? 'common').toUpperCase())+'</small><em>'+state+'</em><i class="ac-item-slot">'+esc(slot.toUpperCase())+'</i></button>';
    });
    return pieces.join('') || '<div class="ac-empty"><strong>'+ (tab==='closet'?'Your closet is waiting':'No exclusive pieces in this lane yet') +'</strong><span>'+ (tab==='closet'?'Purchased avatar gear will appear here after payment clears.':'New collections will appear here when exclusive drops are released.') +'</span></div>';
  };
  const renderCatalog = () => {
    root.querySelector<HTMLElement>('#acCategories')!.innerHTML=categoryMarkup();
    root.querySelector<HTMLElement>('#acItems')!.innerHTML=itemMarkup();
    root.querySelector<HTMLElement>('#acCollectionTitle')!.textContent=tab==='closet'?'YOUR CLOSET':category==='featured'?'TRENDING NOW':CATEGORY_LABELS[category].toUpperCase();
    root.querySelector<HTMLElement>('#acCollectionCount')!.textContent=String(catalog.filter(item=>tab!=='closet'||ownedKeys.has(String(item.item_key))).length)+' PIECES';
  };

  root.innerHTML = '<main class="ac-shell ac-studio"><header class="ac-appbar"><a class="back" href="/profile.html" aria-label="Back to profile">×</a><div><small>RICH BIZNESS AVATAR STUDIO</small><h1>Build Your Look</h1></div><button type="button" class="ac-save" id="saveCharacter">Save</button></header><section class="ac-layout"><div class="ac-stage"><canvas id="characterCanvas"></canvas><div class="ac-stage-top"><span>LIVE CHARACTER PREVIEW</span><b id="previewGender">'+gender.toUpperCase()+'</b></div><div class="ac-stage-copy"><strong id="previewName">'+esc(display)+'</strong><em id="previewStyle">'+esc(initialBuild.toUpperCase())+' · '+esc(initialStyle.toUpperCase())+'</em></div><div class="ac-motion"><button type="button" data-motion="idle" class="active">IDLE</button><button type="button" data-motion="walk">WALK</button><button type="button" data-motion="run">RUN</button><button type="button" data-motion="power">POSE</button></div><div class="ac-loading" id="characterLoading">LOADING CHARACTER…</div></div><div class="ac-wardrobe"><nav class="ac-main-tabs" role="tablist" aria-label="Avatar studio sections"><button type="button" data-tab="fashion" class="active"><span>♙</span>Fashion</button><button type="button" data-tab="closet"><span>♡</span>Closet</button><button type="button" data-tab="avatar"><span>◎</span>Avatar</button></nav><div class="ac-category-rail" id="acCategories">'+categoryMarkup()+'</div><div class="ac-collection-head"><span class="ac-brand-mark">RB</span><strong id="acCollectionTitle">TRENDING NOW</strong><small id="acCollectionCount"></small></div><div class="ac-grid" id="acItems">'+itemMarkup()+'</div><div class="ac-selected-panel" id="acSelectedPanel"><strong>Select a piece to preview it</strong><span>Tap an item to see its details and outfit options</span></div><div class="ac-editor"><div class="section-title"><span>YOUR CHARACTER</span></div><div class="seg"><button type="button" data-gender="boy" class="'+(gender==='boy'?'active':'')+'">BOY</button><button type="button" data-gender="girl" class="'+(gender==='girl'?'active':'')+'">GIRL</button></div><label>DISPLAY NAME<input id="nameInput" value="'+esc(display)+'" maxlength="28"/></label><div class="edit-grid"><label>BODY<select id="buildInput"><option value="athletic">ATHLETIC</option><option value="lean">LEAN</option><option value="heroic">HEROIC</option></select></label><label>STYLE<select id="styleInput"><option value="street">STREET</option><option value="boss">BOSS</option><option value="tactical">TACTICAL</option><option value="cyber">CYBER</option></select></label></div><label>AURA<select id="auraInput"><option>Emerald Gold</option><option>Neon Phantom</option><option>Diamond Mist</option></select></label><div class="ac-actions"><button type="button" id="randomize">SURPRISE ME</button><p id="saveStatus" role="status">Your changes appear on the character preview.</p></div></div></div></section></main>';
  root.querySelector<HTMLElement>('.ac-editor')!.hidden = true;

  const canvas = root.querySelector<HTMLCanvasElement>('#characterCanvas')!;
  const buildInput = root.querySelector<HTMLSelectElement>('#buildInput')!;
  const styleInput = root.querySelector<HTMLSelectElement>('#styleInput')!;
  const auraInput = root.querySelector<HTMLSelectElement>('#auraInput')!;
  const nameInput = root.querySelector<HTMLInputElement>('#nameInput')!;
  buildInput.value = ['athletic','lean','heroic'].includes(initialBuild) ? initialBuild : 'athletic';
  styleInput.value = ['street','boss','tactical','cyber'].includes(initialStyle) ? initialStyle : 'street';
  auraInput.value = ['Emerald Gold','Neon Phantom','Diamond Mist'].includes(initialAura) ? initialAura : 'Emerald Gold';


  const itemByKey = (key:string) => catalog.find(item => String(item.item_key) === key);
  const selectedPanel = root.querySelector<HTMLElement>('#acSelectedPanel')!;
  const expectedRigKey = () => String(modelForGender(gender)?.metadata?.rig_key ?? 'rb-humanoid-v1');
  const showItem = (key:string) => {
    selectedItemKey = key;
    const item = itemByKey(key);
    if (!item) {
      selectedPanel.innerHTML = '<strong>Choose a wardrobe piece</strong><span>Choose a piece to see its details</span>';
      return;
    }
    const owned = ownedKeys.has(key);
    const equipped = equippedKeys.has(key);
    const asset = (item.config?.asset ?? {}) as AvatarAssetDescriptor;
    const tagged = Boolean(asset.mesh_path && asset.thumbnail_path && asset.rig_key);
    const readyToAttempt = Boolean(owned && tagged && runtime && modelForGender(gender));
    selectedPanel.innerHTML = '<strong>' + esc(item.title) + '</strong><span>' +
      esc(String(item.rarity ?? 'common').toUpperCase()) + ' · ' + (owned ? 'In your closet' : 'Preview only') +
      ' · ' + (tagged ? 'Asset metadata linked; GLB still validated on load' : '3D asset pending') +
      '</span><button type="button" id="acEquip" ' + (readyToAttempt ? '' : 'disabled') + '>' +
      (equipped ? 'REMOVE ITEM' : readyToAttempt ? 'WEAR ITEM' : owned ? 'ASSET NOT READY' : 'NOT UNLOCKED') +
      '</button>';
    selectedPanel.querySelector<HTMLButtonElement>('#acEquip')?.addEventListener('click', async () => {
      const button = selectedPanel.querySelector<HTMLButtonElement>('#acEquip')!;
      button.disabled = true;
      const status = root.querySelector<HTMLElement>('#saveStatus')!;
      try {
        if (!runtime) throw new Error('Load a production Rich Bizness character before equipping wardrobe assets.');
        if (!owned) throw new Error('Unlock this item before equipping it.');
        if (!tagged) throw new Error('This catalog piece does not yet have a complete 3D wearable asset.');
        if (equipped) {
          const { error: saveError } = await supabase.rpc('rb_avatar_set_item', { p_item_key: key, p_equipped: false });
          if (saveError) throw saveError;
          removeSkinnedWearable(runtime, key);
        } else {
          const meshUrl = await resolveAvatarItemUrl(asset, abort.signal);
          const wearable = await loadSkinnedWearable({ meshUrl, itemKey: key, signal: abort.signal });
          attachSkinnedWearable(runtime, wearable, {
            itemKey: key,
            rigKey: String(asset.rig_key),
            expectedRigKey: expectedRigKey(),
            renderOrder: Number(asset.render_order ?? 0)
          });
          const { error: saveError } = await supabase.rpc('rb_avatar_set_item', { p_item_key: key, p_equipped: true });
          if (saveError) {
            removeSkinnedWearable(runtime, key);
            throw saveError;
          }
        }
        const { data: snapshotData, error: snapshotError } = await supabase.rpc('rb_avatar_runtime_snapshot', {});
        if (snapshotError) throw snapshotError;
        const snapshot = (snapshotData ?? {}) as Snapshot;
        const rows = snapshot.inventory ?? [];
        equippedKeys = new Set(rows.filter(row => row.equipped).map(row => String(row.item?.item_key ?? '')));
        renderCatalog();
        showItem(key);
        status.textContent = equipped ? 'Wearable removed from character and saved loadout.' : 'Wearable GLB validated, attached to the live rig, and saved to your loadout.';
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : 'Could not update wearable item.';
        button.disabled = false;
      }
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

  const modelForGender = (nextGender: AvatarGender) => {
    const model = snap.model ?? null;
    const expectedBody = nextGender === 'girl' ? 'female' : 'male';
    if (!model || String(model.body_type ?? '').toLowerCase() !== expectedBody) return null;
    return model;
  };

  const applyBuildScale = () => {
    if (!runtime) return;
    const applied = applyAvatarBodyShape(runtime, buildInput.value as 'lean' | 'athletic' | 'heroic');
    root.querySelector<HTMLElement>('#saveStatus')!.textContent = applied
      ? 'Body shape applied to the live character.'
      : 'Body shape selected; this character rig does not yet include the matching morph target.';
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
      const selectedModel = modelForGender(gender);
      const animationUrl = String(selectedModel?.metadata?.animation_url ?? '') || null;
      const next = await loadSkinnedAvatar({
        modelUrl: await resolveAvatarModelUrl({ model: selectedModel }, gender, abort.signal),
        animationUrl,
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
      if (target) target.textContent = `RICH BIZNESS CHARACTER ASSET REQUIRED: ${loadError instanceof Error ? loadError.message : 'UNKNOWN ERROR'}`;
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
  buildInput.onchange=()=>{applyBuildScale();root.querySelector<HTMLElement>('#previewStyle')!.textContent=buildInput.value.toUpperCase()+' · '+styleInput.value.toUpperCase();root.querySelector<HTMLElement>('#saveStatus')!.textContent='Body preference selected. Visible body shaping requires a production rig with morph targets.'};
  styleInput.onchange=()=>{root.querySelector<HTMLElement>('#previewStyle')!.textContent=buildInput.value.toUpperCase()+' · '+styleInput.value.toUpperCase();root.querySelector<HTMLElement>('#saveStatus')!.textContent='Style preference selected. Visible outfits require matched 3D garment assets.'};
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
      const activeModel = modelForGender(gender);
      if (!activeModel || activeModel.is_realistic !== true || activeModel.is_active !== true || activeModel.rig_type !== 'skinned-humanoid') {
        throw new Error('This character is still assigned to a temporary demo model. A Rich Bizness production rig must be installed before saving it as a finished character.');
      }
      const {error:saveError}=await supabase.rpc('rb_save_avatar_studio',{
        p_display_name:nameInput.value||display,
        p_preset_key:gender==='girl'?'street_queen_hd':'street_king_hd',
        p_aura:auraInput.value,
        p_outfit:{build:buildInput.value,style:styleInput.value,rig:activeModel.rig_type,model_key:activeModel.model_key},
        p_accessories:Object.fromEntries([...equippedKeys].map(key=>[key,true])),
        p_smoke:{mode:'off'},p_emotes:{idle:true,walk:true,run:true,jump:true,power:true},
        p_character_type:gender==='girl'?'female':'male'
      });
      status.textContent=saveError?saveError.message:'Saved. Your settings are linked to the selected production model.';
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
