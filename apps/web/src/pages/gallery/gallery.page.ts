import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import '../../styles/deep-sections.css';
import './gallery.css';

type GalleryRow = {
  id: string;
  user_id: string;
  display_name: string | null;
  username: string | null;
  title: string | null;
  body: string | null;
  media_url: string | null;
  file_url: string | null;
  thumbnail_url: string | null;
  cover_url: string | null;
  media_type: string | null;
  post_type: string | null;
  like_count: number | null;
  comment_count: number | null;
  view_count: number | null;
  is_featured?: boolean | null;
  created_at: string | null;
};

type Channel = ReturnType<typeof supabase.channel>;

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
const media = (row: GalleryRow) => row.media_url || row.file_url || row.thumbnail_url || row.cover_url || '';
const isVideo = (row: GalleryRow) => Boolean(row.media_type?.startsWith('video') || row.post_type === 'video');
const relativeTime = (value: string | null) => {
  if (!value) return '';
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app');
  if (root.dataset.mounted === 'gallery') return;
  root.dataset.mounted = 'gallery';

  const auth = getAuthSnapshot();
  const userId = auth.user?.id ?? null;
  const profileResult = userId
    ? await supabase.from('profiles').select('username,display_name').eq('id', userId).maybeSingle()
    : { data: null, error: null };
  const profile = profileResult.data;

  root.innerHTML = `<main class="deep-shell gallery-universe"><div class="gallery-gridlines" aria-hidden="true"></div><div class="deep-wrap"><header class="deep-top"><a href="/portal.html">←</a><div><p>RICH BIZNESS VISUAL DISTRICT</p><h1>Gallery</h1></div><span class="deep-live">REALTIME</span></header><section class="deep-hero gallery-hero" style="--hero-image:url('/images/brand/IMG_5997.png')"><div class="gallery-hero-copy"><small>ART • PHOTOS • MOTION • CREATOR DROPS</small><h2>THE VISUAL UNIVERSE</h2><p>Discover original creator visuals, cinematic uploads, photography, artwork, and motion drops connected to every Rich Bizness identity.</p><div class="gallery-hero-badges"><span>LIVE CREATOR DROPS</span><span>PHOTO + MOTION</span><span>PROFILE CONNECTED</span><span>REALTIME INTERACTIONS</span></div><div class="deep-actions"><a class="deep-btn primary" href="/upload.html?route=gallery">DROP VISUAL</a><a class="deep-btn" href="/search.html?category=gallery">DISCOVER CREATORS</a><a class="deep-btn" href="/feed.html?section=gallery">OPEN FEED</a><a class="deep-btn" href="/watch.html?source=gallery">WATCH</a></div></div></section><nav id="tabs" class="deep-tabs"></nav><section class="deep-stats" id="stats"></section><section id="grid" class="deep-grid gallery-grid"></section><p id="status" class="deep-status" role="status"></p></div><div id="galleryLightbox" class="gallery-lightbox" hidden><article class="gallery-lightbox-card"><button id="galleryLightboxClose" class="gallery-lightbox-close" aria-label="Close visual">×</button><div class="gallery-lightbox-layout"><div id="galleryLightboxMedia" class="gallery-lightbox-media"></div><aside class="gallery-lightbox-side"><div class="gallery-lightbox-copy"><h2 id="galleryLightboxTitle"></h2><p id="galleryLightboxCreator"></p><div id="galleryLightboxMeta" class="gallery-lightbox-meta"></div></div><div id="galleryComments" class="gallery-comments"></div><form id="galleryCommentForm" class="gallery-comment-form"><input id="galleryCommentInput" maxlength="2000" placeholder="Add to the visual conversation..."><button class="deep-btn primary" type="submit">POST</button></form></aside></div></article></div></main>`;

  const grid = document.querySelector<HTMLElement>('#grid')!;
  const tabs = document.querySelector<HTMLElement>('#tabs')!;
  const stats = document.querySelector<HTMLElement>('#stats')!;
  const status = document.querySelector<HTMLElement>('#status')!;
  const lightbox = document.querySelector<HTMLElement>('#galleryLightbox')!;
  const lightboxMedia = document.querySelector<HTMLElement>('#galleryLightboxMedia')!;
  const lightboxTitle = document.querySelector<HTMLElement>('#galleryLightboxTitle')!;
  const lightboxCreator = document.querySelector<HTMLElement>('#galleryLightboxCreator')!;
  const lightboxMeta = document.querySelector<HTMLElement>('#galleryLightboxMeta')!;
  const comments = document.querySelector<HTMLElement>('#galleryComments')!;
  const commentForm = document.querySelector<HTMLFormElement>('#galleryCommentForm')!;
  const commentInput = document.querySelector<HTMLInputElement>('#galleryCommentInput')!;

  let rows: GalleryRow[] = [];
  let lane = 'all';
  let active: GalleryRow | null = null;
  let catalogChannel: Channel | null = null;
  let interactionChannel: Channel | null = null;
  let loadingCatalog: Promise<void> | null = null;
  let catalogQueued = false;
  let loadingComments: Promise<void> | null = null;
  let commentsQueued = false;
  let destroyed = false;
  let statusTimer = 0;

  const setStatus = (value: string) => {
    status.textContent = value;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => { if (status.textContent === value) status.textContent = ''; }, 2600);
  };

  const requireAuth = () => {
    if (userId) return true;
    location.assign(`/tap-in.html?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`);
    return false;
  };

  const lanes = [['all', 'ALL VISUALS'], ['image', 'PHOTOS + ART'], ['video', 'MOTION'], ['featured', 'FEATURED'], ['mine', 'MY DROPS']];
  const visible = () => rows.filter((row) => lane === 'all'
    || (lane === 'image' && (!isVideo(row)))
    || (lane === 'video' && isVideo(row))
    || (lane === 'featured' && Boolean(row.is_featured))
    || (lane === 'mine' && row.user_id === userId));

  const renderTabs = () => {
    tabs.innerHTML = lanes.map(([key, label]) => `<button class="deep-tab ${lane === key ? 'active' : ''}" data-lane="${key}">${label}</button>`).join('');
    tabs.querySelectorAll<HTMLButtonElement>('[data-lane]').forEach((button) => {
      button.onclick = () => {
        if (button.dataset.lane === 'mine' && !requireAuth()) return;
        lane = button.dataset.lane!;
        renderTabs();
        render();
      };
    });
  };

  const loadComments = async () => {
    if (!active) {
      comments.innerHTML = '<div class="deep-empty">Select a visual.</div>';
      return;
    }
    if (loadingComments) {
      commentsQueued = true;
      return loadingComments;
    }
    loadingComments = (async () => {
      const selectedId = active?.id;
      const { data, error } = await supabase.from('feed_comments').select('id,user_id,username,display_name,body,created_at').eq('post_id', selectedId).order('created_at', { ascending: true }).limit(120);
      if (destroyed || selectedId !== active?.id) return;
      if (error) {
        comments.innerHTML = `<div class="deep-empty">${esc(error.message)}</div>`;
        return;
      }
      comments.innerHTML = (data ?? []).map((comment) => `<article class="gallery-comment"><div><strong>${esc(comment.display_name || comment.username || 'Rich Member')}</strong><span>${relativeTime(comment.created_at)}</span></div><p>${esc(comment.body)}</p></article>`).join('') || '<div class="deep-empty">Start the visual conversation.</div>';
      comments.scrollTop = comments.scrollHeight;
    })().finally(async () => {
      loadingComments = null;
      if (commentsQueued && !destroyed) {
        commentsQueued = false;
        await loadComments();
      }
    });
    return loadingComments;
  };

  const replaceInteractionChannel = async () => {
    if (interactionChannel) await supabase.removeChannel(interactionChannel);
    interactionChannel = null;
    if (!active || destroyed) return;
    interactionChannel = supabase.channel(`gallery-interactions:${active.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_comments', filter: `post_id=eq.${active.id}` }, () => void loadComments())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_post_likes', filter: `post_id=eq.${active.id}` }, () => void loadCatalog())
      .subscribe();
  };

  const trackView = async (row: GalleryRow) => {
    const key = `rb_gallery_session_${row.id}`;
    let sessionId = sessionStorage.getItem(key);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem(key, sessionId);
    }
    await supabase.from('feed_post_views').upsert({ post_id: row.id, user_id: userId, session_id: sessionId }, { onConflict: 'post_id,session_id', ignoreDuplicates: true });
  };

  const openVisual = async (row: GalleryRow) => {
    const url = media(row);
    if (!url) return;
    active = row;
    lightboxMedia.innerHTML = isVideo(row)
      ? `<video src="${esc(url)}" poster="${esc(row.thumbnail_url || row.cover_url)}" controls autoplay playsinline></video>`
      : `<img src="${esc(url)}" alt="${esc(row.title || 'Gallery visual')}">`;
    lightboxTitle.textContent = row.title || row.body || 'Rich Visual';
    lightboxCreator.textContent = row.display_name || row.username || 'Rich Creator';
    lightboxMeta.innerHTML = `<span>♥ ${row.like_count ?? 0}</span><span>◌ ${row.comment_count ?? 0}</span><span>◉ ${row.view_count ?? 0}</span><a href="/profile.html?id=${encodeURIComponent(row.user_id)}">CREATOR PROFILE</a>`;
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    history.replaceState({}, '', `/gallery.html?id=${encodeURIComponent(row.id)}`);
    await Promise.allSettled([loadComments(), replaceInteractionChannel(), trackView(row)]);
  };

  const closeVisual = async () => {
    lightbox.hidden = true;
    const video = lightboxMedia.querySelector<HTMLVideoElement>('video');
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    lightboxMedia.innerHTML = '';
    document.body.style.overflow = '';
    active = null;
    if (interactionChannel) await supabase.removeChannel(interactionChannel);
    interactionChannel = null;
    history.replaceState({}, '', '/gallery.html');
  };

  const toggleLike = async (postId: string) => {
    if (!requireAuth()) return;
    const { error } = await supabase.rpc('rb_feed_toggle_like', { p_post_id: postId });
    if (error) setStatus(error.message);
    else await loadCatalog();
  };

  const render = () => {
    const list = visible();
    stats.innerHTML = `<article><small>VISUAL DROPS</small><strong>${rows.length}</strong></article><article><small>CREATORS</small><strong>${new Set(rows.map((row) => row.user_id)).size}</strong></article><article><small>LIKES</small><strong>${rows.reduce((total, row) => total + (row.like_count ?? 0), 0).toLocaleString()}</strong></article><article><small>VIEWS</small><strong>${rows.reduce((total, row) => total + (row.view_count ?? 0), 0).toLocaleString()}</strong></article>`;
    grid.innerHTML = list.length ? list.map((row) => {
      const url = media(row);
      return `<article class="deep-card gallery-card"><div class="deep-card-media">${url ? (isVideo(row) ? `<video src="${esc(url)}" poster="${esc(row.thumbnail_url || row.cover_url)}" muted playsinline preload="metadata"></video>` : `<img src="${esc(url)}" alt="${esc(row.title || 'Gallery visual')}" loading="lazy">`) : ''}<span>${esc((row.post_type || row.media_type || 'VISUAL').toUpperCase())}</span>${url ? `<button class="gallery-open" data-open="${row.id}" aria-label="Open visual">↗</button>` : ''}</div><div class="deep-card-body"><h3>${esc(row.title || row.body || 'Rich Visual')}</h3><p>${esc(row.display_name || row.username || 'Rich Creator')}</p><div class="deep-card-meta"><span>♥ ${row.like_count ?? 0} · ◌ ${row.comment_count ?? 0}</span><span>◉ ${row.view_count ?? 0}</span></div><div class="deep-card-actions"><a href="/profile.html?id=${encodeURIComponent(row.user_id)}">CREATOR</a><button data-like="${row.id}">LIKE</button><button data-open="${row.id}">COMMENT</button></div></div></article>`;
    }).join('') : '<div class="deep-empty">No visuals in this lane yet.</div>';
    grid.querySelectorAll<HTMLButtonElement>('[data-open]').forEach((button) => {
      button.onclick = () => {
        const row = rows.find((item) => item.id === button.dataset.open);
        if (row) void openVisual(row);
      };
    });
    grid.querySelectorAll<HTMLButtonElement>('[data-like]').forEach((button) => {
      button.onclick = () => void toggleLike(button.dataset.like!);
    });
  };

  const loadCatalog = async () => {
    if (loadingCatalog) {
      catalogQueued = true;
      return loadingCatalog;
    }
    loadingCatalog = (async () => {
      const { data, error } = await supabase.from('feed_posts').select('id,user_id,display_name,username,title,body,media_url,file_url,thumbnail_url,cover_url,media_type,post_type,like_count,comment_count,view_count,is_featured,created_at').eq('section', 'gallery').neq('moderation_state', 'blocked').order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(120);
      if (destroyed) return;
      if (error) {
        setStatus(error.message);
        return;
      }
      rows = (data ?? []) as GalleryRow[];
      if (active) active = rows.find((row) => row.id === active?.id) ?? active;
      render();
    })().finally(async () => {
      loadingCatalog = null;
      if (catalogQueued && !destroyed) {
        catalogQueued = false;
        await loadCatalog();
      }
    });
    return loadingCatalog;
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !lightbox.hidden) void closeVisual();
  };
  const onBackdropClick = (event: MouseEvent) => {
    if (event.target === lightbox) void closeVisual();
  };

  document.querySelector<HTMLButtonElement>('#galleryLightboxClose')!.onclick = () => void closeVisual();
  lightbox.addEventListener('click', onBackdropClick);
  window.addEventListener('keydown', onKeyDown);
  commentForm.onsubmit = async (event) => {
    event.preventDefault();
    if (!active || !requireAuth()) return;
    const body = commentInput.value.trim();
    if (!body) return;
    const submit = commentForm.querySelector<HTMLButtonElement>('button')!;
    submit.disabled = true;
    const { error } = await supabase.from('feed_comments').insert({ post_id: active.id, user_id: userId, username: profile?.username ?? 'member', display_name: profile?.display_name ?? 'Rich Bizness Member', body, metadata: { source: 'gallery-lightbox' } });
    submit.disabled = false;
    if (error) setStatus(error.message);
    else {
      commentInput.value = '';
      await Promise.all([loadComments(), loadCatalog()]);
    }
  };

  renderTabs();
  await loadCatalog();
  catalogChannel = supabase.channel('gallery-universe')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_posts', filter: 'section=eq.gallery' }, () => void loadCatalog())
    .subscribe();

  const requested = new URLSearchParams(location.search).get('id');
  const initial = requested ? rows.find((row) => row.id === requested) : null;
  if (initial) await openVisual(initial);

  const cleanup = () => {
    if (destroyed) return;
    destroyed = true;
    window.clearTimeout(statusTimer);
    window.removeEventListener('keydown', onKeyDown);
    lightbox.removeEventListener('click', onBackdropClick);
    document.body.style.overflow = '';
    const video = lightboxMedia.querySelector<HTMLVideoElement>('video');
    if (video) video.pause();
    if (catalogChannel) void supabase.removeChannel(catalogChannel);
    if (interactionChannel) void supabase.removeChannel(interactionChannel);
  };
  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });
}
