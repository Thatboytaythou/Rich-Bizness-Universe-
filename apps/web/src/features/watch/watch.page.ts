import { getAuthSnapshot } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import '../../styles/broadcast-cinema-podcast.css';
import './watch.css';

type Row = Record<string, any>;
type Channel = ReturnType<typeof supabase.channel>;

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
const itemKey = (row: Row) => `${row.source_type}:${row.source_id}`;
const progressPercent = (row: Row | undefined) => row && Number(row.duration_seconds) > 0 ? Math.min(100, Math.round(Number(row.position_seconds) / Number(row.duration_seconds) * 100)) : 0;
const safeUrl = (value: unknown) => { try { const url = new URL(String(value || ''), location.origin); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  if (root.dataset.watchOwner === 'true') return;
  root.dataset.watchOwner = 'true';

  const auth = getAuthSnapshot();
  const user = auth.user;
  const userId = user?.id ?? null;
  const sessionId = localStorage.getItem('rb_watch_session') || crypto.randomUUID();
  localStorage.setItem('rb_watch_session', sessionId);

  let items: Row[] = [];
  let progress = new Map<string, Row>();
  let liked = new Set<string>();
  let saved = new Set<string>();
  let comments: Row[] = [];
  let metrics: Row = {};
  let lane = 'featured';
  let active: Row | null = null;
  let player: HTMLVideoElement | null = null;
  let progressTimer: number | null = null;
  let catalogChannel: Channel | null = null;
  let interactionChannel: Channel | null = null;
  let ownerChannel: Channel | null = null;
  let loading = false;
  let queued = false;
  let disposed = false;
  let switching = false;
  let activeSessionKey = '';
  let lastSyncedSecond = -1;

  const requireUser = () => {
    if (userId) return true;
    location.href = '/tap-in.html?next=%2Fwatch.html';
    return false;
  };

  const action = async (name: string, item: Row, payload: Row = {}) => supabase.rpc('rb_watch_action', {
    p_action: name,
    p_source_type: item.source_type,
    p_source_id: item.source_id,
    p_payload: payload
  });

  const setWatchUrl = (item: Row | null) => {
    const url = new URL(location.href);
    if (item) {
      url.searchParams.set('type', String(item.source_type));
      url.searchParams.set('id', String(item.source_id));
    } else {
      url.searchParams.delete('type');
      url.searchParams.delete('id');
    }
    history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const apply = (data: unknown) => {
    const snapshot = (data ?? {}) as Row;
    items = (snapshot.items ?? []) as Row[];
    progress = new Map(((snapshot.progress ?? []) as Row[]).map((row) => [`${row.source_type}:${row.source_id}`, row]));
    liked = new Set(((snapshot.likes ?? []) as Row[]).map((row) => `${row.source_type}:${row.source_id}`));
    saved = new Set(((snapshot.watchlist ?? []) as Row[]).map((row) => `${row.source_type}:${row.source_id}`));
    comments = (snapshot.comments ?? []) as Row[];
    metrics = snapshot.metrics ?? {};
    if (!active || !items.some((item) => itemKey(item) === itemKey(active!))) active = items[0] ?? null;
  };

  const load = async (selected: Row | null = active) => {
    if (loading) { queued = true; return; }
    loading = true;
    try {
      const { data, error } = await supabase.rpc('rb_watch_snapshot', {
        p_source_type: selected?.source_type ?? null,
        p_source_id: selected?.source_id ?? null
      });
      if (error) throw error;
      apply(data);
      renderMetrics();
      render();
      if (active) await open(active, false, false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Watch network failed to load.';
      document.querySelector<HTMLElement>('#watchHero')!.innerHTML = `<div class="media-ultimate__empty">${esc(message)}</div>`;
    } finally {
      loading = false;
      if (queued && !disposed) { queued = false; void load(); }
    }
  };

  root.innerHTML = `<main class="media-ultimate watch-universe"><div class="media-ultimate__wrap">
    <header class="media-ultimate__head"><a href="/portal.html" aria-label="Back to Portal">←</a><div><p>RICH BIZNESS CINEMA NETWORK</p><h1>WE 🔥 📺</h1></div><span class="media-ultimate__status">${user ? '● PERSONALIZED' : 'PUBLIC CINEMA'}</span></header>
    <nav class="watch-command"><a href="/live.html">WE LIT 🔥</a><a href="/feed.html">FEED</a><a href="/gallery.html">GALLERY</a><a href="/sports.html">SPORTS</a><a href="/gaming.html">GAMING</a><a href="/podcast.html">PODCAST</a><a href="/creator.html">CREATOR</a><a href="${user ? '/upload.html?route=feed' : '/tap-in.html?next=%2Fupload.html'}">DROP VIDEO</a></nav>
    <section id="watchHero" class="media-ultimate__hero"><div class="media-ultimate__empty">Loading the cinema network…</div></section>
    <section class="media-ultimate__metrics"><article><small>GLOBAL LIBRARY</small><strong id="watchLibraryCount">0</strong></article><article><small>CONTINUE WATCHING</small><strong id="watchContinueCount">0</strong></article><article><small>MY LIST</small><strong id="watchSavedCount">0</strong></article><article><small>COMPLETED</small><strong id="watchCompletedCount">0</strong></article></section>
    <nav class="media-ultimate__tabs">${[['featured','FEATURED'],['continue','CONTINUE'],['live','LIVE REPLAYS'],['podcast','PODCAST'],['gaming','GAMING'],['sports','SPORTS'],['feed','CREATOR FEED'],['saved','MY LIST']].map(([value,label],index)=>`<button class="${index===0?'active':''}" data-lane="${value}">${label}</button>`).join('')}</nav>
    <section class="media-ultimate__section"><header><div><h3 id="watchLaneTitle">Featured Cinema</h3><p>Replays, podcasts, creator films, game clips and sports moments in one ranked network.</p></div></header><div id="watchRail" class="cinema-rail"></div></section>
    <section class="media-ultimate__split"><article class="media-ultimate__panel"><header><h4>NOW WATCHING INTELLIGENCE</h4></header><div id="watchDetail" class="media-ultimate__list"></div></article><article class="media-ultimate__panel"><header><h4>RICH REACTIONS</h4></header><div id="watchComments" class="media-ultimate__chat"><div class="media-ultimate__empty">Choose a video.</div></div><form id="watchCommentForm" class="media-ultimate__form"><input id="watchCommentInput" maxlength="2000" placeholder="React to this drop..." ${user?'':'disabled'}><button class="media-ultimate__btn primary">${user?'POST':'TAP IN'}</button></form></article></section>
    <section class="media-ultimate__section"><header><div><h3>Because You Watch</h3><p>More from the sections and creators already in your history.</p></div></header><div id="recommendGrid" class="media-ultimate__grid"></div></section>
  </div></main>`;

  const rail = document.querySelector<HTMLElement>('#watchRail')!;
  const detail = document.querySelector<HTMLElement>('#watchDetail')!;
  const commentsEl = document.querySelector<HTMLElement>('#watchComments')!;
  const recs = document.querySelector<HTMLElement>('#recommendGrid')!;

  const continueRows = () => items.filter((item) => {
    const row = progress.get(itemKey(item));
    return row && Number(row.position_seconds) > 0 && !row.completed;
  });

  const visible = () => lane === 'continue'
    ? continueRows()
    : lane === 'saved'
      ? items.filter((item) => saved.has(itemKey(item)))
      : lane === 'featured'
        ? items
        : items.filter((item) => String(item.section) === lane);

  const card = (item: Row) => `<article class="media-ultimate__card" data-key="${esc(itemKey(item))}"><img src="${esc(safeUrl(item.thumbnail_url) || '/images/brand/IMG_5997.png')}" alt="" onerror="this.src='/images/brand/IMG_5997.png'"><div class="watch-progress"><span style="width:${progressPercent(progress.get(itemKey(item)))}%"></span></div><div class="media-ultimate__card-body"><h4>${esc(item.title || 'Rich Cinema')}</h4><p>${esc(item.creator_name || 'Rich Creator')} · ${Number(item.view_count ?? 0).toLocaleString()} views</p><div class="media-ultimate__meta"><span>${esc((item.section || 'WATCH').toUpperCase())}</span><span>${progress.get(itemKey(item))?.completed ? 'COMPLETED' : `${progressPercent(progress.get(itemKey(item)))}%`}</span></div></div></article>`;

  const bind = (host: HTMLElement) => host.querySelectorAll<HTMLElement>('[data-key]').forEach((element) => {
    element.onclick = () => {
      const item = items.find((candidate) => itemKey(candidate) === element.dataset.key);
      if (item) void open(item);
    };
  });

  const renderMetrics = () => {
    document.querySelector<HTMLElement>('#watchLibraryCount')!.textContent = String(metrics.library_count ?? items.length);
    document.querySelector<HTMLElement>('#watchContinueCount')!.textContent = String(metrics.continue_count ?? continueRows().length);
    document.querySelector<HTMLElement>('#watchSavedCount')!.textContent = String(metrics.saved_count ?? saved.size);
    document.querySelector<HTMLElement>('#watchCompletedCount')!.textContent = String(metrics.completed_count ?? [...progress.values()].filter((row) => row.completed).length);
  };

  const renderComments = () => {
    commentsEl.innerHTML = comments.length
      ? comments.map((comment) => `<article><p>${esc(comment.body)}</p><small>${esc(comment.display_name || comment.username || 'Rich Viewer')} · ${new Date(comment.created_at).toLocaleString()}</small></article>`).join('')
      : '<div class="media-ultimate__empty">Start the conversation.</div>';
    commentsEl.scrollTop = commentsEl.scrollHeight;
  };

  const render = () => {
    const rows = visible();
    rail.innerHTML = rows.map(card).join('') || '<div class="media-ultimate__empty">Nothing in this lane yet.</div>';
    bind(rail);
    const basis = active?.section ? items.filter((item) => item.section === active!.section && itemKey(item) !== itemKey(active!)) : items.slice(1);
    recs.innerHTML = basis.slice(0, 8).map(card).join('') || '<div class="media-ultimate__empty">Recommendations build as you watch.</div>';
    bind(recs);
    renderComments();
  };

  const sync = async (force = false) => {
    if (!userId || !active || !player || (!force && player.currentTime < 1)) return;
    const duration = Number.isFinite(player.duration) ? Math.floor(player.duration) : Number(active.duration_seconds ?? 0);
    const position = Math.floor(player.currentTime);
    if (!force && position === lastSyncedSecond) return;
    const completed = duration > 0 && position / duration > 0.92;
    const { error } = await action('progress', active, {
      position_seconds: position,
      duration_seconds: duration,
      completed,
      session_id: sessionId,
      device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
    });
    if (error) return;
    lastSyncedSecond = position;
    const row = { source_type: active.source_type, source_id: active.source_id, position_seconds: position, duration_seconds: duration, completed, last_watched_at: new Date().toISOString() };
    progress.set(itemKey(active), row);
    metrics.continue_count = continueRows().length;
    metrics.completed_count = [...progress.values()].filter((entry) => entry.completed).length;
    renderMetrics();
    render();
  };

  const endActiveSession = async () => {
    if (!userId || !activeSessionKey) return;
    const [sourceType, sourceId] = activeSessionKey.split(':');
    const item = items.find((candidate) => String(candidate.source_type) === sourceType && String(candidate.source_id) === sourceId);
    activeSessionKey = '';
    if (item) await action('end_session', item, { session_id: sessionId });
  };

  const teardown = async (save = true) => {
    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
    if (player) {
      if (save) await sync(true);
      player.pause();
      player.removeAttribute('src');
      player.load();
      player = null;
    }
    await endActiveSession();
    lastSyncedSecond = -1;
  };

  const replaceChannel = async (item: Row) => {
    if (interactionChannel) await supabase.removeChannel(interactionChannel);
    interactionChannel = supabase.channel(`watch-owner:${item.source_type}:${item.source_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watch_comments', filter: `source_id=eq.${item.source_id}` }, () => void load(item))
      .subscribe();
  };

  const open = async (item: Row, savePrevious = true, refreshComments = true) => {
    if (switching) return;
    switching = true;
    try {
      if (savePrevious) await teardown(true);
      active = item;
      setWatchUrl(item);
      if (refreshComments) {
        const { data, error } = await supabase.rpc('rb_watch_snapshot', { p_source_type: item.source_type, p_source_id: item.source_id });
        if (!error) apply(data);
      }
      document.querySelector<HTMLElement>('#watchHero')!.innerHTML = hero(item, liked.has(itemKey(item)), saved.has(itemKey(item)), Boolean(userId));
      detail.innerHTML = [['TITLE', `${item.title || 'Rich Cinema'} · ${item.section || 'watch'}`], ['CREATOR', item.creator_name || 'Rich Creator'], ['AUDIENCE', `${Number(item.view_count ?? 0).toLocaleString()} views`], ['PROGRESS', `${progressPercent(progress.get(itemKey(item)))}% watched · ${progress.get(itemKey(item))?.completed ? 'completed' : 'in progress'}`], ['LIBRARY', `${liked.has(itemKey(item)) ? 'liked' : 'not liked'} · ${saved.has(itemKey(item)) ? 'saved' : 'not saved'}`]].map(([label, value]) => `<div class="media-ultimate__row"><div><h5>${label}</h5><p>${esc(value)}</p></div></div>`).join('');
      player = document.querySelector<HTMLVideoElement>('#watchPlayer');
      if (player) {
        player.disablePictureInPicture = true;
        player.disableRemotePlayback = true;
        player.playsInline = true;
        const currentProgress = progress.get(itemKey(item));
        player.addEventListener('loadedmetadata', () => {
          if (currentProgress?.position_seconds && Number(currentProgress.position_seconds) < player!.duration - 5) player!.currentTime = Number(currentProgress.position_seconds);
        }, { once: true });
        player.addEventListener('play', () => { activeSessionKey = itemKey(item); void sync(true); });
        player.addEventListener('pause', () => void sync(true));
        player.addEventListener('ended', () => void sync(true));
        player.addEventListener('stalled', () => { detail.insertAdjacentHTML('afterbegin', '<div class="media-ultimate__empty watch-warning">STREAM STALLED — retrying playback…</div>'); player?.load(); });
        player.addEventListener('error', () => { detail.insertAdjacentHTML('afterbegin', '<div class="media-ultimate__empty watch-warning">This media source is unavailable.</div>'); });
        progressTimer = window.setInterval(() => void sync(false), 15000);
      }
      document.querySelector<HTMLButtonElement>('#watchPlayBtn')?.addEventListener('click', () => void player?.play().catch(() => undefined));
      document.querySelector<HTMLButtonElement>('#watchLikeBtn')?.addEventListener('click', async () => {
        if (!requireUser()) return;
        const { data, error } = await action('toggle_like', item);
        if (!error) { if ((data as Row)?.active) liked.add(itemKey(item)); else liked.delete(itemKey(item)); await open(item, false, false); }
      });
      document.querySelector<HTMLButtonElement>('#watchSaveBtn')?.addEventListener('click', async () => {
        if (!requireUser()) return;
        const { data, error } = await action('toggle_save', item);
        if (!error) { if ((data as Row)?.active) saved.add(itemKey(item)); else saved.delete(itemKey(item)); metrics.saved_count = saved.size; renderMetrics(); render(); await open(item, false, false); }
      });
      render();
      await replaceChannel(item);
    } finally {
      switching = false;
    }
  };

  document.querySelectorAll<HTMLButtonElement>('[data-lane]').forEach((button) => {
    button.onclick = () => {
      lane = button.dataset.lane!;
      document.querySelectorAll('[data-lane]').forEach((node) => node.classList.toggle('active', node === button));
      document.querySelector<HTMLElement>('#watchLaneTitle')!.textContent = button.textContent ?? 'Watch';
      render();
      const first = visible()[0];
      if (first) void open(first);
    };
  });

  document.querySelector<HTMLFormElement>('#watchCommentForm')!.onsubmit = async (event) => {
    event.preventDefault();
    if (!requireUser() || !active) return;
    const input = document.querySelector<HTMLInputElement>('#watchCommentInput')!;
    const body = input.value.trim();
    if (!body) return;
    const submit = event.submitter as HTMLButtonElement | null;
    if (submit) submit.disabled = true;
    try {
      const { error } = await action('comment', active, { body });
      if (error) throw error;
      input.value = '';
      await load(active);
    } finally {
      if (submit) submit.disabled = false;
    }
  };

  catalogChannel = supabase.channel('watch-catalog-owner')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_recordings' }, () => void load())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'podcast_episodes' }, () => void load())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_posts' }, () => void load())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_clips' }, () => void load())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_uploads' }, () => void load())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_broadcasts' }, () => void load())
    .subscribe();

  if (userId) {
    ownerChannel = supabase.channel(`watch-user:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watch_progress', filter: `user_id=eq.${userId}` }, () => void load(active))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watch_likes', filter: `user_id=eq.${userId}` }, () => void load(active))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watchlist_items', filter: `user_id=eq.${userId}` }, () => void load(active))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watch_sessions', filter: `user_id=eq.${userId}` }, () => void load(active))
      .subscribe();
  }

  const cleanup = async () => {
    if (disposed) return;
    disposed = true;
    await teardown(true);
    if (catalogChannel) await supabase.removeChannel(catalogChannel);
    if (interactionChannel) await supabase.removeChannel(interactionChannel);
    if (ownerChannel) await supabase.removeChannel(ownerChannel);
    catalogChannel = null;
    interactionChannel = null;
    ownerChannel = null;
  };

  window.addEventListener('pagehide', () => void cleanup(), { once: true });
  window.addEventListener('beforeunload', () => void cleanup(), { once: true });

  await load();
  const params = new URLSearchParams(location.search);
  const requestedType = params.get('type');
  const requestedId = params.get('id');
  const requested = items.find((item) => String(item.source_type) === requestedType && String(item.source_id) === requestedId);
  if (requested) await open(requested);
}

function hero(item: Row, isLiked: boolean, isSaved: boolean, signedIn: boolean) {
  const poster = safeUrl(item.thumbnail_url) || '/images/brand/IMG_5997.png';
  const media = safeUrl(item.media_url);
  return `<video id="watchPlayer" class="media-ultimate__hero-media" controls playsinline webkit-playsinline disablePictureInPicture disableRemotePlayback preload="metadata" poster="${esc(poster)}" src="${esc(media)}"></video><div class="media-ultimate__hero-copy"><span class="media-ultimate__eyebrow">WE 🔥 📺 · ${esc((item.section || 'WATCH').toUpperCase())}</span><h2>${esc(item.title || 'Rich Cinema')}</h2><p>${esc(item.description || 'Premium creator video from across the Rich Bizness universe.')}</p><div class="media-ultimate__actions"><button id="watchPlayBtn" class="media-ultimate__btn primary" type="button">▶ WATCH NOW</button><button id="watchLikeBtn" class="media-ultimate__btn" type="button">${isLiked ? '♥ LIKED' : '♡ LIKE'}</button><button id="watchSaveBtn" class="media-ultimate__btn" type="button">${isSaved ? '✓ MY LIST' : '+ MY LIST'}</button><a class="media-ultimate__btn" href="${signedIn ? '/messages.html' : '/tap-in.html?next=%2Fmessages.html'}">SHARE IN RICH-DM’S</a></div></div>`;
}
