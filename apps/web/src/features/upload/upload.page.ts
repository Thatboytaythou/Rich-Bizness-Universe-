import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import './upload.css';

type Row = Record<string, any>;
type Channel = ReturnType<typeof supabase.channel>;
type CleanupHost = Window & { __rbPageCleanup?: (() => void | Promise<void>) | null };

const PAGE_OWNER = 'rich-bizness-upload-v3';
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] ?? char));
const formatSize = (bytes: number) => bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
const kindFor = (mime: string) => mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : mime.includes('gltf') ? 'model' : 'file';
const routeIcon = (section: string) => ({ feed: '◫', gallery: '▣', gaming: '🎮', live: '◉', meta: '◎', music: '♪', podcast: '◌', profile: '◍', radio: '◉', sports: '🏆', store: '◆' } as Record<string, string>)[section] ?? '⬆';

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  if (root.dataset.pageOwner !== PAGE_OWNER) return;
  const epoch = root.dataset.pageEpoch ?? '';
  let disposed = false;
  const isCurrent = () => !disposed && root.dataset.pageOwner === PAGE_OWNER && root.dataset.pageEpoch === epoch;
  const user = getAuthSnapshot().user;
  if (!user) { location.replace(`/tap-in.html?next=${encodeURIComponent(location.pathname + location.search)}`); return; }

  root.innerHTML = `<main class="upload-shell"><div class="upload-wrap">
    <header class="upload-head"><a href="/portal.html" aria-label="Back to portal">←</a><div class="upload-brand"><p>RICH BIZNESS CREATOR</p><h1>UPLOAD</h1></div><div id="creatorChip" class="creator-chip"></div><span id="uploadState" class="upload-state">READY</span></header>
    <section class="route-rail"><div class="route-rail-head"><div><small>POST TO</small><h2>Choose where this drop belongs</h2></div></div><div id="routeChips" class="route-chips"></div></section>
    <section class="upload-grid"><form id="uploadForm" class="upload-card upload-console"><header class="console-head"><div><small>NEW DROP</small><h2>Create your release</h2></div></header>
      <div class="field-grid"><label><span>DESTINATION</span><select id="routeKey" required></select></label><label><span>VISIBILITY</span><select id="visibility"><option value="public">PUBLIC</option><option value="followers">FOLLOWERS</option><option value="unlisted">UNLISTED</option><option value="private">PRIVATE</option></select></label><label class="wide"><span>TITLE</span><input id="title" maxlength="120" placeholder="Name this drop"></label><label class="wide"><span>DESCRIPTION</span><textarea id="description" maxlength="1000" rows="3" placeholder="Tell people what this is"></textarea></label></div>
      <label id="dropZone" class="drop-zone"><input id="fileInput" type="file" hidden><div class="drop-mark"><b>⬆</b></div><strong>ADD MEDIA</strong><small id="routeHint">Choose a destination</small><button type="button" id="pickFile">BROWSE DEVICE</button></label>
      <div id="preview" class="upload-preview"><div class="preview-empty"><b>RB</b><span>Your preview appears here</span></div></div><div class="meter"><i id="meterBar"></i></div><div class="upload-status-row"><p id="uploadMessage" class="upload-message">Ready to upload.</p><span id="fileMeta">NO FILE</span></div><button id="uploadButton" class="upload-button" type="submit"><span>PUBLISH DROP</span><b>→</b></button>
    </form><aside class="upload-sidebar"><section class="upload-card recent-panel"><div class="panel-title"><div><p>RECENT</p><h2>Your uploads</h2></div><button id="refreshUploads" type="button" aria-label="Refresh uploads">↻</button></div><div id="recentUploads" class="recent-list"></div></section></aside></section>
  </div></main>`;

  const form = root.querySelector<HTMLFormElement>('#uploadForm')!;
  const routeKey = root.querySelector<HTMLSelectElement>('#routeKey')!;
  const visibility = root.querySelector<HTMLSelectElement>('#visibility')!;
  const title = root.querySelector<HTMLInputElement>('#title')!;
  const description = root.querySelector<HTMLTextAreaElement>('#description')!;
  const fileInput = root.querySelector<HTMLInputElement>('#fileInput')!;
  const dropZone = root.querySelector<HTMLElement>('#dropZone')!;
  const preview = root.querySelector<HTMLElement>('#preview')!;
  const message = root.querySelector<HTMLElement>('#uploadMessage')!;
  const state = root.querySelector<HTMLElement>('#uploadState')!;
  const bar = root.querySelector<HTMLElement>('#meterBar')!;
  const button = root.querySelector<HTMLButtonElement>('#uploadButton')!;
  const fileMeta = root.querySelector<HTMLElement>('#fileMeta')!;
  const controller = new AbortController();
  const { signal } = controller;

  let routes: Row[] = [], recentUploads: Row[] = [], profile: Row = {}, selected: File | null = null, previewUrl = '', uploading = false, refreshTimer = 0;
  let uploadChannel: Channel | null = null, queueChannel: Channel | null = null;
  const activeRoute = () => routes.find((route) => route.route_key === routeKey.value) ?? routes[0];
  const setMessage = (value: string) => { if (isCurrent()) message.textContent = value; };
  const clearPreview = () => { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = ''; preview.querySelectorAll<HTMLMediaElement>('video,audio').forEach((media) => { media.pause(); media.removeAttribute('src'); media.load(); }); };
  const accepted = (file: File, route: Row) => { const mime = String(file.type || 'application/octet-stream').toLowerCase(); const extension = file.name.split('.').pop()?.toLowerCase() ?? ''; const mimes = Array.isArray(route.allowed_mime_types) ? route.allowed_mime_types : []; const extensions = Array.isArray(route.accepted_extensions) ? route.accepted_extensions : []; return (!mimes.length || mimes.includes(mime)) && (!extensions.length || extensions.includes(extension)); };
  const acceptValue = (route: Row) => { const mimes = Array.isArray(route.allowed_mime_types) ? route.allowed_mime_types : []; const extensions = Array.isArray(route.accepted_extensions) ? route.accepted_extensions.map((value: string) => `.${value}`) : []; return [...mimes, ...extensions].join(',') || '*/*'; };
  const syncUrl = () => { const route = activeRoute(); if (!route || !isCurrent()) return; const url = new URL(location.href); url.searchParams.set('route', route.route_key); history.replaceState({}, '', url); };

  const renderRecent = () => { if (!isCurrent()) return; const recent = root.querySelector<HTMLElement>('#recentUploads')!; recent.innerHTML = recentUploads.length ? recentUploads.slice(0, 8).map((upload) => `<article><span>${upload.media_type === 'image' ? '▣' : upload.media_type === 'video' ? '▶' : upload.media_type === 'audio' ? '♪' : upload.media_type === 'model' ? '◎' : '⬆'}</span><div><strong>${esc(upload.title || 'Untitled upload')}</strong><small>${esc(upload.section || upload.bucket)} · ${esc(upload.processing_status || 'completed')}</small></div><time>${upload.created_at ? new Date(upload.created_at).toLocaleDateString() : ''}</time></article>`).join('') : '<div class="empty"><b>⬆</b><strong>No uploads yet</strong><span>Your latest drops will show here.</span></div>'; };
  const renderRoute = () => { if (!isCurrent()) return; const route = activeRoute(); if (!route) return; fileInput.accept = acceptValue(route); const isPrivate = route.is_public === false; if (isPrivate && visibility.value === 'public') visibility.value = 'private'; visibility.querySelector<HTMLOptionElement>('option[value="public"]')!.disabled = isPrivate; root.querySelector<HTMLElement>('#routeHint')!.textContent = `${String(route.media_type ?? 'mixed').toUpperCase()} · max ${Number(route.max_file_size_mb ?? 300)} MB`; root.querySelectorAll<HTMLElement>('.route-chip').forEach((chip) => chip.classList.toggle('active', chip.dataset.section === route.section)); if (selected && !accepted(selected, route)) setFile(null); };
  const renderSnapshot = (snapshot: Row) => { if (!isCurrent()) return; routes = (snapshot.routes ?? []) as Row[]; recentUploads = (snapshot.recent_uploads ?? []) as Row[]; profile = (snapshot.profile ?? {}) as Row; if (!routes.length) throw new Error('No active upload routes are configured.'); const sections = [...new Set(routes.map((route) => String(route.section)))]; root.querySelector<HTMLElement>('#creatorChip')!.innerHTML = `<img src="${esc(profile.avatar_url || '/brand/icons/profile-placeholder.svg')}" alt=""><div><strong>${esc(profile.display_name || profile.username || 'Rich Creator')}</strong><span>${esc(profile.rank_title || 'CREATOR')} · LVL ${Number(profile.rich_level ?? 1)}</span></div>`; const previous = routeKey.value; routeKey.innerHTML = routes.map((route) => `<option value="${esc(route.route_key)}">${esc(String(route.section).toUpperCase())}</option>`).join(''); root.querySelector<HTMLElement>('#routeChips')!.innerHTML = sections.map((section) => `<button type="button" class="route-chip" data-section="${esc(section)}"><b>${routeIcon(section)}</b><span>${esc(section.toUpperCase())}</span></button>`).join(''); const requested = new URLSearchParams(location.search).get('route'); const requestedRoute = routes.find((route) => route.route_key === requested) ?? routes.find((route) => route.section === requested) ?? routes.find((route) => route.route_key === previous); if (requestedRoute) routeKey.value = requestedRoute.route_key; root.querySelectorAll<HTMLButtonElement>('.route-chip').forEach((chip) => chip.addEventListener('click', () => { const first = routes.find((route) => route.section === chip.dataset.section); if (!first || !isCurrent()) return; routeKey.value = first.route_key; renderRoute(); syncUrl(); }, { signal })); renderRecent(); renderRoute(); state.textContent = Number(snapshot.queued_uploads ?? 0) > 0 ? 'PROCESSING' : 'READY'; };
  const setFile = (file: File | null) => { if (!isCurrent()) return; clearPreview(); selected = file; if (!file) { preview.innerHTML = '<div class="preview-empty"><b>RB</b><span>Your preview appears here</span></div>'; fileMeta.textContent = 'NO FILE'; fileInput.value = ''; button.disabled = false; return; } const route = activeRoute(); const max = Number(route.max_file_size_mb ?? 300) * 1024 * 1024; if (!accepted(file, route) || file.size > max) { selected = null; fileMeta.textContent = 'REJECTED'; button.disabled = true; setMessage(file.size > max ? `File exceeds ${route.max_file_size_mb ?? 300} MB.` : 'This file type is not accepted for this destination.'); return; } button.disabled = false; previewUrl = URL.createObjectURL(file); const kind = kindFor(file.type); preview.innerHTML = kind === 'image' ? `<img src="${previewUrl}" alt="Preview">` : kind === 'video' ? `<video src="${previewUrl}" controls playsinline></video>` : kind === 'audio' ? `<div class="audio-preview"><b>♪</b><audio src="${previewUrl}" controls></audio></div>` : `<div class="file-preview"><b>${kind === 'model' ? '◎' : '⬆'}</b><strong>${esc(file.name)}</strong></div>`; fileMeta.textContent = `${formatSize(file.size)} · ${kind.toUpperCase()}`; if (!title.value.trim()) title.value = file.name.replace(/\.[^.]+$/, ''); setMessage('Preview ready.'); };
  const loadSnapshot = async () => { const { data, error } = await supabase.rpc('rb_upload_snapshot', {}); if (error) throw error; if (isCurrent()) renderSnapshot((data ?? {}) as Row); };
  const scheduleSnapshot = () => { clearTimeout(refreshTimer); refreshTimer = window.setTimeout(() => { if (isCurrent()) void loadSnapshot().catch((error) => setMessage(error.message)); }, 180); };

  routeKey.addEventListener('change', () => { renderRoute(); syncUrl(); }, { signal });
  root.querySelector<HTMLButtonElement>('#pickFile')!.addEventListener('click', (event) => { event.preventDefault(); fileInput.click(); }, { signal });
  fileInput.addEventListener('change', () => setFile(fileInput.files?.[0] ?? null), { signal });
  dropZone.addEventListener('dragover', (event) => { event.preventDefault(); dropZone.classList.add('active'); }, { signal });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('active'), { signal });
  dropZone.addEventListener('drop', (event) => { event.preventDefault(); dropZone.classList.remove('active'); setFile(event.dataTransfer?.files?.[0] ?? null); }, { signal });
  root.querySelector<HTMLButtonElement>('#refreshUploads')!.addEventListener('click', () => void loadSnapshot().catch((error) => setMessage(error.message)), { signal });
  form.addEventListener('submit', async (event) => { event.preventDefault(); if (!isCurrent() || uploading || !selected) return setMessage('Add a file first.'); const route = activeRoute(); if (!route) return; uploading = true; button.disabled = true; state.textContent = 'UPLOADING'; state.classList.add('working'); bar.style.width = '10%'; setMessage('Uploading…'); const ext = selected.name.split('.').pop()?.toLowerCase() || 'bin'; const objectPath = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`; const { error: storageError } = await supabase.storage.from(route.bucket).upload(objectPath, selected, { cacheControl: '3600', upsert: false, contentType: selected.type || undefined }); if (!isCurrent()) return; if (storageError) { uploading = false; button.disabled = false; state.textContent = 'READY'; state.classList.remove('working'); bar.style.width = '0%'; return setMessage(storageError.message); } bar.style.width = '60%'; const { data: publicData } = supabase.storage.from(route.bucket).getPublicUrl(objectPath); const publicUrl = route.is_public === false ? null : publicData.publicUrl; const { error: insertError } = await supabase.from('uploads').insert({ user_id: user.id, section: route.section, route_key: route.route_key, bucket: route.bucket, object_path: objectPath, public_url: publicUrl, media_type: kindFor(selected.type), mime_type: selected.type || 'application/octet-stream', file_name: selected.name, file_size: selected.size, title: title.value.trim() || selected.name, description: description.value.trim(), visibility: visibility.value, processing_status: route.processing_type && route.processing_type !== 'none' ? 'queued' : 'completed', processing_progress: route.processing_type && route.processing_type !== 'none' ? 0 : 100 }); if (!isCurrent()) return; if (insertError) { uploading = false; button.disabled = false; state.textContent = 'READY'; state.classList.remove('working'); bar.style.width = '0%'; return setMessage(insertError.message); } bar.style.width = '100%'; setMessage('Published.'); state.textContent = 'READY'; state.classList.remove('working'); uploading = false; button.disabled = false; form.reset(); setFile(null); await loadSnapshot().catch(() => undefined); }, { signal });

  await loadSnapshot();
  if (!isCurrent()) return;
  uploadChannel = supabase.channel(`upload-page-${epoch}`).on('postgres_changes', { event: '*', schema: 'public', table: 'uploads', filter: `user_id=eq.${user.id}` }, scheduleSnapshot).subscribe();
  queueChannel = supabase.channel(`upload-queue-${epoch}`).on('postgres_changes', { event: '*', schema: 'public', table: 'upload_processing_queue' }, scheduleSnapshot).subscribe();
  const cleanup = async () => { if (disposed) return; disposed = true; controller.abort(); clearTimeout(refreshTimer); clearPreview(); if (uploadChannel) await supabase.removeChannel(uploadChannel); if (queueChannel) await supabase.removeChannel(queueChannel); };
  (window as CleanupHost).__rbPageCleanup = cleanup;
  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });
}
