import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import './upload.css';

type Row = Record<string, any>;
type Channel = ReturnType<typeof supabase.channel>;

const esc = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] ?? char));
const formatSize = (bytes: number) => bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
const kindFor = (mime: string) => mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'file';
const routeIcon = (section: string) => ({ feed: '◫', gallery: '▣', gaming: '🎮', live: '◉', meta: '◎', music: '♪', podcast: '◌', profile: '◍', radio: '◉', sports: '🏆', store: '◆' } as Record<string, string>)[section] ?? '⬆';

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  if (root.dataset.uploadOwner === 'active') return;
  root.dataset.uploadOwner = 'active';

  const auth = getAuthSnapshot();
  const user = auth.user;
  if (!user) {
    location.replace(`/tap-in.html?next=${encodeURIComponent(location.pathname + location.search)}`);
    return;
  }

  root.innerHTML = `<main class="upload-shell"><div class="upload-atmosphere" aria-hidden="true"></div><div class="upload-wrap">
    <header class="upload-head"><a href="/portal.html" aria-label="Back to portal">←</a><div class="upload-brand"><p>RICH BIZNESS CREATOR NETWORK</p><h1>UPLOAD COMMAND</h1><small>Validated routing · secure ownership · universal publishing</small></div><div id="creatorChip" class="creator-chip"></div><span id="uploadState" class="upload-state">SYNCING</span></header>
    <section class="upload-hero"><div><span class="hero-kicker">GLOBAL MEDIA INGESTION</span><h2>DROP IT.<br><em>OWN THE UNIVERSE.</em></h2><p>One verified command deck routes every image, video, track, episode, game asset, product file, avatar model and live recording into its canonical destination.</p></div><div id="heroStats" class="hero-stats"></div></section>
    <section class="route-rail"><div class="route-rail-head"><div><small>QUICK DESTINATIONS</small><h3>Choose a universe</h3></div><span id="routeCount">0 secure routes</span></div><div id="routeChips" class="route-chips"></div></section>
    <section class="upload-grid"><form id="uploadForm" class="upload-card upload-console"><header class="console-head"><div><small>CREATOR CONSOLE</small><h2>Prepare your drop</h2></div><div id="securityBadge">SERVER VERIFIED</div></header>
      <div class="field-grid"><label><span>DESTINATION</span><select id="routeKey" required></select></label><label><span>VISIBILITY</span><select id="visibility"><option value="public">PUBLIC</option><option value="followers">FOLLOWERS</option><option value="unlisted">UNLISTED</option><option value="private">PRIVATE</option></select></label><label class="wide"><span>TITLE</span><input id="title" maxlength="120" placeholder="Name this Rich Bizness drop"></label><label class="wide"><span>DESCRIPTION</span><textarea id="description" maxlength="1000" rows="4" placeholder="Tell the universe what makes this release elite"></textarea></label></div>
      <section id="routeBlueprint" class="route-blueprint"></section><label id="dropZone" class="drop-zone"><input id="fileInput" type="file" hidden><div class="drop-orbit"><i></i><b>⬆</b></div><strong>DROP MEDIA INTO THE PORTAL</strong><small id="routeHint">Choose a destination</small><button type="button" id="pickFile">BROWSE DEVICE</button></label><div id="preview" class="upload-preview"><div class="preview-empty"><b>4K</b><span>Preview chamber ready</span></div></div><div class="meter"><i id="meterBar"></i></div><div class="upload-status-row"><p id="uploadMessage" class="upload-message">Creator pipeline standing by.</p><span id="fileMeta">NO FILE</span></div><button id="uploadButton" class="upload-button" type="submit"><span>UPLOAD TO RICH BIZNESS</span><b>→</b></button>
    </form><aside class="upload-sidebar"><section class="upload-card route-intel"><header class="panel-title"><div><p>ROUTE INTELLIGENCE</p><h2>Pipeline Details</h2></div><span>LIVE</span></header><div id="routeIntel"></div></section><section class="upload-card recent-panel"><div class="panel-title"><div><p>YOUR PIPELINE</p><h2>Recent Uploads</h2></div><button id="refreshUploads" type="button" aria-label="Refresh uploads">↻</button></div><div id="recentUploads" class="recent-list"></div></section></aside></section>
  </div></main>`;

  const form = document.querySelector<HTMLFormElement>('#uploadForm')!;
  const routeKey = document.querySelector<HTMLSelectElement>('#routeKey')!;
  const fileInput = document.querySelector<HTMLInputElement>('#fileInput')!;
  const dropZone = document.querySelector<HTMLElement>('#dropZone')!;
  const preview = document.querySelector<HTMLElement>('#preview')!;
  const message = document.querySelector<HTMLElement>('#uploadMessage')!;
  const state = document.querySelector<HTMLElement>('#uploadState')!;
  const bar = document.querySelector<HTMLElement>('#meterBar')!;
  const button = document.querySelector<HTMLButtonElement>('#uploadButton')!;
  const fileMeta = document.querySelector<HTMLElement>('#fileMeta')!;

  let routes: Row[] = [];
  let recentUploads: Row[] = [];
  let profile: Row = {};
  let selected: File | null = null;
  let previewUrl = '';
  let uploading = false;
  let disposed = false;
  let channel: Channel | null = null;

  const activeRoute = () => routes.find((route) => route.route_key === routeKey.value) ?? routes[0];
  const setMessage = (value: string) => { message.textContent = value; };
  const clearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    preview.querySelectorAll<HTMLMediaElement>('video,audio').forEach((media) => { media.pause(); media.removeAttribute('src'); media.load(); });
  };
  const accepted = (file: File, route: Row) => {
    const mime = String(file.type || 'application/octet-stream').toLowerCase();
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const mimes = Array.isArray(route.allowed_mime_types) ? route.allowed_mime_types : [];
    const extensions = Array.isArray(route.accepted_extensions) ? route.accepted_extensions : [];
    return (!mimes.length || mimes.includes(mime)) && (!extensions.length || extensions.includes(extension));
  };
  const acceptValue = (route: Row) => {
    const mimes = Array.isArray(route.allowed_mime_types) ? route.allowed_mime_types : [];
    const extensions = Array.isArray(route.accepted_extensions) ? route.accepted_extensions.map((value: string) => `.${value}`) : [];
    return [...mimes, ...extensions].join(',') || '*/*';
  };

  const renderRecent = () => {
    const recent = document.querySelector<HTMLElement>('#recentUploads')!;
    recent.innerHTML = recentUploads.length ? recentUploads.map((upload) => `<article class="status-${esc(upload.processing_status || 'completed')}"><span>${upload.media_type === 'image' ? '▣' : upload.media_type === 'video' ? '▶' : upload.media_type === 'audio' ? '♪' : '⬆'}</span><div><strong>${esc(upload.title || 'Untitled upload')}</strong><small>${esc(upload.section || upload.bucket)} · ${esc(upload.processing_status || 'completed')} ${Number.isFinite(Number(upload.processing_progress)) ? `· ${Number(upload.processing_progress)}%` : ''}</small>${upload.failure_reason ? `<em>${esc(upload.failure_reason)}</em>` : ''}</div><time>${upload.created_at ? new Date(upload.created_at).toLocaleDateString() : ''}</time></article>`).join('') : '<div class="empty"><b>⬆</b><strong>No uploads yet</strong><span>Your first elite drop will appear here.</span></div>';
  };

  const renderSnapshot = (snapshot: Row) => {
    routes = (snapshot.routes ?? []) as Row[];
    recentUploads = (snapshot.recent_uploads ?? []) as Row[];
    profile = (snapshot.profile ?? {}) as Row;
    if (!routes.length) throw new Error('No active upload routes are configured.');
    const sections = [...new Set(routes.map((route) => String(route.section)))];
    document.querySelector<HTMLElement>('#creatorChip')!.innerHTML = `<img src="${esc(profile.avatar_url || '/brand/icons/profile-placeholder.svg')}" alt=""><div><strong>${esc(profile.display_name || profile.username || 'Rich Creator')}</strong><span>${esc(profile.rank_title || 'CREATOR')} · LVL ${Number(profile.rich_level ?? 1)}</span></div>`;
    document.querySelector<HTMLElement>('#heroStats')!.innerHTML = `<article><small>DESTINATIONS</small><strong>${routes.length}</strong><span>${sections.length} connected sections</span></article><article><small>MY UPLOADS</small><strong>${Number(snapshot.total_uploads ?? 0)}</strong><span>${Number(snapshot.queued_uploads ?? 0)} processing</span></article><article><small>PIPELINE HEALTH</small><strong>${Number(snapshot.failed_uploads ?? 0) === 0 ? '100%' : 'CHECK'}</strong><span>${Number(snapshot.failed_uploads ?? 0)} failed uploads</span></article>`;
    document.querySelector<HTMLElement>('#routeCount')!.textContent = `${routes.length} secure routes`;
    routeKey.innerHTML = routes.map((route) => `<option value="${esc(route.route_key)}">${esc(String(route.section).toUpperCase())} · ${esc(route.route_key)}</option>`).join('');
    document.querySelector<HTMLElement>('#routeChips')!.innerHTML = sections.map((section) => `<button type="button" class="route-chip" data-section="${esc(section)}"><b>${routeIcon(section)}</b><span>${esc(section.toUpperCase())}</span><small>${routes.filter((route) => route.section === section).length}</small></button>`).join('');
    const requested = new URLSearchParams(location.search).get('route');
    const requestedRoute = routes.find((route) => route.route_key === requested) ?? routes.find((route) => route.section === requested);
    if (requestedRoute) routeKey.value = requestedRoute.route_key;
    document.querySelectorAll<HTMLButtonElement>('.route-chip').forEach((chip) => chip.onclick = () => {
      const first = routes.find((route) => route.section === chip.dataset.section);
      if (!first) return;
      routeKey.value = first.route_key;
      renderRoute();
      document.querySelector('.upload-console')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    renderRecent();
    renderRoute();
    state.textContent = 'SYSTEM READY';
  };

  const renderRoute = () => {
    const route = activeRoute();
    if (!route) return;
    fileInput.accept = acceptValue(route);
    document.querySelector<HTMLElement>('#routeHint')!.textContent = `${String(route.media_type ?? 'mixed').toUpperCase()} · max ${Number(route.max_file_size_mb ?? 300)} MB · ${route.processing_type ?? 'metadata'} processing`;
    document.querySelector<HTMLElement>('#routeBlueprint')!.innerHTML = `<article><small>SECTION</small><strong>${esc(String(route.section).toUpperCase())}</strong></article><article><small>BUCKET</small><strong>${esc(route.bucket)}</strong></article><article><small>MEDIA</small><strong>${esc(String(route.media_type ?? 'mixed').toUpperCase())}</strong></article><article><small>ACCESS</small><strong>${route.is_public === false ? 'PRIVATE VAULT' : 'PUBLIC CDN'}</strong></article>`;
    document.querySelector<HTMLElement>('#routeIntel')!.innerHTML = `<div class="intel-world"><b>${routeIcon(route.section)}</b><div><small>ACTIVE WORLD</small><h3>${esc(String(route.section).toUpperCase())}</h3><p>${esc(route.route_key)}</p></div></div><dl><div><dt>Storage bucket</dt><dd>${esc(route.bucket)}</dd></div><div><dt>Database target</dt><dd>${esc(route.target_table || 'uploads')}</dd></div><div><dt>Target field</dt><dd>${esc(route.target_column || 'public_url')}</dd></div><div><dt>Processing</dt><dd>${esc(route.processing_type || 'metadata')}</dd></div><div><dt>Maximum size</dt><dd>${Number(route.max_file_size_mb ?? 300)} MB</dd></div></dl>`;
    document.querySelectorAll<HTMLElement>('.route-chip').forEach((chip) => chip.classList.toggle('active', chip.dataset.section === route.section));
    if (selected && !accepted(selected, route)) setFile(null);
  };

  const setFile = (file: File | null) => {
    clearPreview();
    selected = file;
    if (!file) {
      preview.innerHTML = '<div class="preview-empty"><b>4K</b><span>Preview chamber ready</span></div>';
      fileMeta.textContent = 'NO FILE';
      fileInput.value = '';
      return;
    }
    const route = activeRoute();
    const max = Number(route.max_file_size_mb ?? 300) * 1024 * 1024;
    if (!accepted(file, route)) {
      selected = null;
      fileMeta.textContent = 'REJECTED';
      setMessage('This file type is not accepted by the selected destination.');
      return;
    }
    if (file.size > max) {
      selected = null;
      fileMeta.textContent = 'REJECTED';
      setMessage(`File exceeds the ${Number(route.max_file_size_mb ?? 300)} MB route limit.`);
      return;
    }
    previewUrl = URL.createObjectURL(file);
    const kind = kindFor(file.type);
    preview.innerHTML = kind === 'image' ? `<img src="${previewUrl}" alt="Upload preview">` : kind === 'video' ? `<video src="${previewUrl}" controls playsinline preload="metadata"></video>` : kind === 'audio' ? `<div class="audio-preview"><b>♪</b><strong>${esc(file.name)}</strong><audio src="${previewUrl}" controls preload="metadata"></audio></div>` : `<div class="file-preview"><b>⬆</b><strong>${esc(file.name)}</strong><small>${formatSize(file.size)}</small></div>`;
    fileMeta.textContent = `${kind.toUpperCase()} · ${formatSize(file.size)}`;
    setMessage('Media verified locally. Server validation will run on registration.');
  };

  const loadSnapshot = async () => {
    const { data, error } = await supabase.rpc('rb_upload_snapshot', { p_limit: 20 });
    if (error) throw error;
    if (!disposed) renderSnapshot((data ?? {}) as Row);
  };

  routeKey.onchange = renderRoute;
  document.querySelector<HTMLButtonElement>('#pickFile')!.onclick = () => fileInput.click();
  document.querySelector<HTMLButtonElement>('#refreshUploads')!.onclick = () => void loadSnapshot().catch((error) => setMessage(error.message));
  fileInput.onchange = () => setFile(fileInput.files?.[0] ?? null);
  const dragHandler = (event: DragEvent) => {
    event.preventDefault();
    dropZone.classList.toggle('active', event.type === 'dragenter' || event.type === 'dragover');
    if (event.type === 'drop') setFile(event.dataTransfer?.files?.[0] ?? null);
  };
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((name) => dropZone.addEventListener(name, dragHandler as EventListener));

  form.onsubmit = async (event) => {
    event.preventDefault();
    if (uploading || !selected) { if (!selected) setMessage('Choose a file first.'); return; }
    const route = activeRoute();
    if (!accepted(selected, route)) { setMessage('File validation no longer matches the selected route.'); return; }
    uploading = true;
    button.disabled = true;
    state.textContent = 'UPLOADING';
    state.classList.add('working');
    bar.style.width = '12%';
    const file = selected;
    let path = '';
    try {
      const extension = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
      path = `${user.id}/${route.route_key}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
      bar.style.width = '35%';
      const { error: storageError } = await supabase.storage.from(route.bucket).upload(path, file, { cacheControl: '31536000', contentType: file.type || 'application/octet-stream', upsert: false });
      if (storageError) throw storageError;
      bar.style.width = '72%';
      const publicUrl = route.is_public === false ? `private://${route.bucket}/${path}` : supabase.storage.from(route.bucket).getPublicUrl(path).data.publicUrl;
      const { error: registerError } = await supabase.rpc('rb_register_upload', {
        p_route_key: route.route_key,
        p_title: (document.querySelector<HTMLInputElement>('#title')!.value || '').trim(),
        p_description: (document.querySelector<HTMLTextAreaElement>('#description')!.value || '').trim(),
        p_file_path: path,
        p_public_url: publicUrl,
        p_mime_type: file.type || 'application/octet-stream',
        p_file_size: file.size,
        p_visibility: document.querySelector<HTMLSelectElement>('#visibility')!.value,
        p_metadata: { original_name: file.name, source: 'upload_command', client_kind: kindFor(file.type) }
      });
      if (registerError) {
        await supabase.storage.from(route.bucket).remove([path]);
        throw registerError;
      }
      bar.style.width = '100%';
      state.textContent = route.processing_type === 'metadata' ? 'PUBLISHED' : 'PROCESSING';
      setMessage(route.processing_type === 'metadata' ? 'Upload published successfully.' : 'Upload secured and queued for processing.');
      setFile(null);
      form.reset();
      routeKey.value = route.route_key;
      renderRoute();
      await loadSnapshot();
    } catch (error) {
      state.textContent = 'UPLOAD FAILED';
      setMessage(error instanceof Error ? error.message : 'Upload failed.');
      bar.style.width = '0%';
    } finally {
      uploading = false;
      button.disabled = false;
      state.classList.remove('working');
    }
  };

  channel = supabase.channel(`upload-owner:${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'uploads', filter: `user_id=eq.${user.id}` }, () => void loadSnapshot()).subscribe();

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    clearPreview();
    if (channel) void supabase.removeChannel(channel);
  };
  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });

  await loadSnapshot();
}
