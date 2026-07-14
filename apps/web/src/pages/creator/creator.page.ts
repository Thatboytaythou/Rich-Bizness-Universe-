import { supabase } from '../../core/supabase/client';
import './creator.css';

type Row = Record<string, any>;
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
const money = (value: unknown, currency = 'usd') => new Intl.NumberFormat('en-US', { style: 'currency', currency: String(currency || 'usd').toUpperCase() }).format(Number(value ?? 0) / 100);
const safeMedia = (value: unknown) => { try { const url = new URL(String(value || ''), location.origin); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
const safeRoute = (value: string) => { try { const url = new URL(value, location.origin); return url.origin === location.origin && ['http:', 'https:'].includes(url.protocol) ? `${url.pathname}${url.search}${url.hash}` : '/creator.html'; } catch { return '/creator.html'; } };

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { location.replace('/tap-in.html?next=%2Fcreator.html'); return; }

  root.innerHTML = `<main class="creator-shell"><div class="creator-wrap">
    <header class="creator-head"><a href="/portal.html" aria-label="Back to portal">←</a><div><p>RICH BIZNESS CREATOR COMMAND</p><h1>Creator Universe</h1></div><span class="creator-live"><i></i> MONETIZATION LIVE</span></header>
    <section id="creatorHero" class="creator-hero"><div class="creator-hero__copy"><span class="creator-kicker">BUILD · PUBLISH · EARN · CONTROL</span><h2 id="creatorTitle">YOUR CREATOR UNIVERSE</h2><p id="creatorTagline">Connect every section of your brand from one command center.</p><div class="creator-actions"><a class="creator-btn primary" href="/upload.html">CREATE DROP</a><a class="creator-btn" href="/live.html">GO LIVE</a><a class="creator-btn" href="/store.html">MANAGE STORE</a><a class="creator-btn" href="/profile.html">VIEW PROFILE</a></div></div></section>
    <section id="creatorMetrics" class="creator-metrics"></section><nav id="creatorTabs" class="creator-tabs"></nav><section id="creatorContent"></section><p id="creatorStatus" class="creator-status" role="status"></p>
  </div></main>`;

  const hero = document.querySelector<HTMLElement>('#creatorHero')!;
  const metrics = document.querySelector<HTMLElement>('#creatorMetrics')!;
  const tabs = document.querySelector<HTMLElement>('#creatorTabs')!;
  const content = document.querySelector<HTMLElement>('#creatorContent')!;
  const status = document.querySelector<HTMLElement>('#creatorStatus')!;
  let lane = 'dashboard';
  let profile: Row = {};
  let settings: Row = {};
  let balance: Row = {};
  let tracks: Row[] = [];
  let products: Row[] = [];
  let streams: Row[] = [];
  let worlds: Row[] = [];
  let games: Row[] = [];
  let posts: Row[] = [];
  let alertSubscribers = 0;
  const channels: any[] = [];

  const setStatus = (message: string, error = false) => {
    status.textContent = message;
    status.dataset.error = String(error);
    window.setTimeout(() => { if (status.textContent === message) status.textContent = ''; }, 3000);
  };

  const lanes = [
    ['dashboard', 'DASHBOARD'], ['page', 'CREATOR PAGE'], ['content', 'CONTENT'], ['earnings', 'EARNINGS'], ['alerts', 'ALERTS']
  ];

  const card = (title: string, subtitle: string, url: string, image?: unknown, badge = 'CREATOR', meta = '') => {
    const art = safeMedia(image) || '/images/brand/IMG_5997.png';
    return `<article class="creator-card"><div class="creator-card__media"><img src="${esc(art)}" alt="" loading="lazy"><span class="creator-card__badge">${esc(badge)}</span></div><div class="creator-card__body"><h3>${esc(title)}</h3><p>${esc(subtitle)}</p>${meta ? `<div class="creator-card__meta"><span>${esc(meta)}</span></div>` : ''}<div class="creator-card__actions"><a href="${esc(safeRoute(url))}">OPEN</a></div></div></article>`;
  };

  const renderTabs = () => {
    tabs.innerHTML = lanes.map(([key, label]) => `<button class="creator-tab ${lane === key ? 'active' : ''}" data-lane="${key}">${label}</button>`).join('');
    tabs.querySelectorAll<HTMLButtonElement>('[data-lane]').forEach((button) => {
      button.onclick = () => { lane = button.dataset.lane || 'dashboard'; renderTabs(); render(); };
    });
  };

  const render = () => {
    const heroArt = safeMedia(settings.hero_background_url) || safeMedia(profile.banner_url) || '/images/brand/IMG_5997.png';
    hero.style.setProperty('--creator-hero', `url("${heroArt.replaceAll('"', '%22')}")`);
    document.querySelector<HTMLElement>('#creatorTitle')!.textContent = settings.creator_title || profile.display_name || 'YOUR CREATOR UNIVERSE';
    document.querySelector<HTMLElement>('#creatorTagline')!.textContent = settings.creator_tagline || profile.bio || 'Connect every section of your brand from one command center.';
    metrics.innerHTML = `<article><small>AVAILABLE</small><strong>${money(balance.available_cents, balance.currency)}</strong></article><article><small>PENDING</small><strong>${money(balance.pending_cents, balance.currency)}</strong></article><article><small>TOTAL DROPS</small><strong>${posts.length + tracks.length + products.length}</strong></article><article><small>ALERT MEMBERS</small><strong>${alertSubscribers.toLocaleString()}</strong></article>`;

    if (lane === 'dashboard') {
      content.innerHTML = `<section class="creator-section"><header><div><p>CONNECTED CHANNELS</p><h2>Your active business lanes</h2></div><a class="creator-btn" href="/upload.html">NEW DROP</a></header><div class="creator-grid">
        ${card('Creator Profile', profile.rank_title || 'Rich Creator', '/profile.html', profile.avatar_url, profile.is_verified ? 'VERIFIED' : 'PROFILE', `${Number(profile.rich_points ?? 0).toLocaleString()} Rich Points`)}
        ${settings.show_music === false ? '' : card('Music Catalog', `${tracks.length} tracks published`, '/music.html', tracks[0]?.cover_url, 'MUSIC', `${tracks.reduce((sum, row) => sum + Number(row.play_count ?? 0), 0).toLocaleString()} plays`)}
        ${settings.show_store === false ? '' : card('Storefront', `${products.length} products active`, '/store.html', products[0]?.image_url || products[0]?.cover_url, 'STORE', `${products.reduce((sum, row) => sum + Number(row.sales_count ?? 0), 0).toLocaleString()} sales`)}
        ${settings.show_live === false ? '' : card('Live Network', `${streams.length} streams created`, '/live.html', streams[0]?.thumbnail_url || streams[0]?.cover_url, 'LIVE', `${streams.reduce((sum, row) => sum + Number(row.viewer_count ?? 0), 0).toLocaleString()} viewers`)}
        ${settings.show_meta === false ? '' : card('Meta Worlds', `${worlds.length} connected worlds`, '/meta.html', worlds[0]?.cover_url || worlds[0]?.background_url, 'META', `${worlds.reduce((sum, row) => sum + Number(row.visit_count ?? 0), 0).toLocaleString()} visits`)}
        ${settings.show_games === false ? '' : card('Gaming', `${games.length} featured games`, '/gaming.html', games[0]?.cover_url || games[0]?.thumbnail_url, 'GAMING', `${games.reduce((sum, row) => sum + Number(row.total_plays ?? 0), 0).toLocaleString()} plays`)}
      </div></section>`;
    } else if (lane === 'page') {
      content.innerHTML = `<section class="creator-section"><header><div><p>PUBLIC CREATOR IDENTITY</p><h2>Control your universe</h2></div></header><form id="creatorForm" class="creator-form">
        <div class="creator-form-row"><input id="creatorTitleInput" maxlength="100" placeholder="Creator title" value="${esc(settings.creator_title)}"><input id="creatorTaglineInput" maxlength="180" placeholder="Creator tagline" value="${esc(settings.creator_tagline)}"></div>
        <div class="creator-form-row"><input id="heroBackground" placeholder="Hero background URL" value="${esc(settings.hero_background_url)}"><input id="heroVideo" placeholder="Hero video URL" value="${esc(settings.hero_video_url)}"></div>
        <div class="creator-form-row"><select id="pageTheme"><option value="smoke-cloud">SMOKE CLOUD</option><option value="cinematic">CINEMATIC</option><option value="neon">NEON</option></select><select id="introStyle"><option value="cinematic">CINEMATIC</option><option value="clean">CLEAN</option><option value="portal">PORTAL</option></select></div>
        <div class="creator-form-row"><select id="monetizationStyle"><option value="premium">PREMIUM</option><option value="balanced">BALANCED</option><option value="community">COMMUNITY</option></select><select id="featuredTrack"><option value="">NO FEATURED TRACK</option>${tracks.map((row) => `<option value="${row.id}">${esc(row.title)}</option>`).join('')}</select></div>
        <div class="creator-form-row"><select id="featuredProduct"><option value="">NO FEATURED PRODUCT</option>${products.map((row) => `<option value="${row.id}">${esc(row.title)}</option>`).join('')}</select><select id="featuredLive"><option value="">NO FEATURED LIVE</option>${streams.map((row) => `<option value="${row.id}">${esc(row.title)}</option>`).join('')}</select></div>
        <div class="creator-form-row"><select id="featuredWorld"><option value="">NO FEATURED WORLD</option>${worlds.map((row) => `<option value="${row.id}">${esc(row.title)}</option>`).join('')}</select><select id="featuredGame"><option value="">NO FEATURED GAME</option>${games.map((row) => `<option value="${row.id}">${esc(row.title)}</option>`).join('')}</select></div>
        <div class="creator-form-row"><label><input id="showMusic" type="checkbox" ${settings.show_music !== false ? 'checked' : ''}> SHOW MUSIC</label><label><input id="showStore" type="checkbox" ${settings.show_store !== false ? 'checked' : ''}> SHOW STORE</label></div>
        <div class="creator-form-row"><label><input id="showLive" type="checkbox" ${settings.show_live !== false ? 'checked' : ''}> SHOW LIVE</label><label><input id="showMeta" type="checkbox" ${settings.show_meta !== false ? 'checked' : ''}> SHOW META</label></div>
        <div class="creator-form-row"><label><input id="showGallery" type="checkbox" ${settings.show_gallery !== false ? 'checked' : ''}> SHOW GALLERY</label><label><input id="showGames" type="checkbox" ${settings.show_games !== false ? 'checked' : ''}> SHOW GAMES</label></div>
        <button class="creator-btn primary" type="submit">SAVE CREATOR UNIVERSE</button>
      </form></section>`;
      const setSelect = (id: string, value: unknown) => { const element = document.querySelector<HTMLSelectElement>(`#${id}`); if (element && value != null) element.value = String(value); };
      setSelect('pageTheme', settings.page_theme || 'smoke-cloud'); setSelect('introStyle', settings.intro_style || 'cinematic'); setSelect('monetizationStyle', settings.monetization_style || 'premium'); setSelect('featuredTrack', settings.featured_track_id || ''); setSelect('featuredProduct', settings.featured_product_id || ''); setSelect('featuredLive', settings.featured_live_id || ''); setSelect('featuredWorld', settings.featured_world_id || ''); setSelect('featuredGame', settings.featured_game_id || '');
      document.querySelector<HTMLFormElement>('#creatorForm')!.onsubmit = async (event) => {
        event.preventDefault();
        const heroBackground = (document.querySelector<HTMLInputElement>('#heroBackground')!.value.trim());
        const heroVideo = (document.querySelector<HTMLInputElement>('#heroVideo')!.value.trim());
        if (heroBackground && !safeMedia(heroBackground)) return setStatus('Hero background must use a safe HTTP or HTTPS URL.', true);
        if (heroVideo && !safeMedia(heroVideo)) return setStatus('Hero video must use a safe HTTP or HTTPS URL.', true);
        const payload = {
          user_id: session.user.id,
          creator_title: document.querySelector<HTMLInputElement>('#creatorTitleInput')!.value.trim(),
          creator_tagline: document.querySelector<HTMLInputElement>('#creatorTaglineInput')!.value.trim(),
          hero_background_url: heroBackground || null,
          hero_video_url: heroVideo || null,
          page_theme: document.querySelector<HTMLSelectElement>('#pageTheme')!.value,
          intro_style: document.querySelector<HTMLSelectElement>('#introStyle')!.value,
          monetization_style: document.querySelector<HTMLSelectElement>('#monetizationStyle')!.value,
          featured_track_id: document.querySelector<HTMLSelectElement>('#featuredTrack')!.value || null,
          featured_product_id: document.querySelector<HTMLSelectElement>('#featuredProduct')!.value || null,
          featured_live_id: document.querySelector<HTMLSelectElement>('#featuredLive')!.value || null,
          featured_world_id: document.querySelector<HTMLSelectElement>('#featuredWorld')!.value || null,
          featured_game_id: document.querySelector<HTMLSelectElement>('#featuredGame')!.value || null,
          show_music: document.querySelector<HTMLInputElement>('#showMusic')!.checked,
          show_store: document.querySelector<HTMLInputElement>('#showStore')!.checked,
          show_live: document.querySelector<HTMLInputElement>('#showLive')!.checked,
          show_meta: document.querySelector<HTMLInputElement>('#showMeta')!.checked,
          show_gallery: document.querySelector<HTMLInputElement>('#showGallery')!.checked,
          show_games: document.querySelector<HTMLInputElement>('#showGames')!.checked,
          updated_at: new Date().toISOString()
        };
        setStatus('SAVING YOUR CREATOR UNIVERSE...');
        const { error } = await supabase.from('creator_page_settings').upsert(payload, { onConflict: 'user_id' });
        if (error) return setStatus(error.message, true);
        await supabase.from('profiles').update({ is_creator: true, updated_at: new Date().toISOString() }).eq('id', session.user.id);
        await supabase.rpc('rb_award_xp', { p_event_key: 'creator_publish', p_section: 'creator', p_source_table: 'creator_page_settings', p_source_id: null, p_amount: null });
        setStatus('CREATOR UNIVERSE SAVED — XP SYNCED');
        await load();
      };
    } else if (lane === 'content') {
      const rows = [
        ...posts.map((row) => card(row.title || row.body || 'Feed Drop', row.section || row.post_type || 'feed', `/feed.html?post=${row.id}`, row.thumbnail_url || row.cover_url || row.media_url, 'FEED', `${Number(row.view_count ?? 0).toLocaleString()} views`)),
        ...tracks.map((row) => card(row.title || 'Music Drop', row.genre || 'music', `/music.html?track=${row.id}`, row.cover_url, 'MUSIC', `${Number(row.play_count ?? 0).toLocaleString()} plays`)),
        ...products.map((row) => card(row.title || 'Store Drop', money(row.price_cents, row.currency), `/store.html?product=${row.id}`, row.image_url || row.cover_url, 'STORE', `${Number(row.sales_count ?? 0).toLocaleString()} sold`)),
        ...streams.map((row) => card(row.title || 'Live Broadcast', row.status || 'live', `/live.html?id=${row.id}`, row.thumbnail_url || row.cover_url, 'LIVE', `${Number(row.viewer_count ?? 0).toLocaleString()} viewers`))
      ];
      content.innerHTML = `<section class="creator-section"><header><div><p>YOUR PUBLISHED UNIVERSE</p><h2>Content command</h2></div><a class="creator-btn primary" href="/upload.html">CREATE DROP</a></header><div class="creator-grid">${rows.join('') || '<div class="creator-empty">Your creator content will appear here.</div>'}</div></section>`;
    } else if (lane === 'earnings') {
      content.innerHTML = `<section class="creator-section"><header><div><p>CREATOR WALLET</p><h2>Revenue position</h2></div></header><div class="creator-metrics"><article><small>EARNED</small><strong>${money(balance.earned_cents, balance.currency)}</strong></article><article><small>AVAILABLE</small><strong>${money(balance.available_cents, balance.currency)}</strong></article><article><small>PENDING</small><strong>${money(balance.pending_cents, balance.currency)}</strong></article><article><small>PAID OUT</small><strong>${money(balance.paid_out_cents, balance.currency)}</strong></article></div><div class="creator-actions"><a class="creator-btn primary" href="/settings.html">PAYOUT SETTINGS</a><a class="creator-btn" href="/store.html">ORDER CENTER</a></div></section>`;
    } else {
      content.innerHTML = `<section class="creator-section"><header><div><p>CREATOR ALERTS</p><h2>Audience subscriptions</h2></div></header><div class="creator-panel"><div class="creator-row"><img src="${esc(safeMedia(profile.avatar_url) || '/images/brand/Avatar-hero-Banner.png.jpeg')}" alt=""><div><h4>${alertSubscribers.toLocaleString()} active alert members</h4><p>Followers can subscribe to all activity, posts, Live, Store, or Music updates.</p></div><a class="creator-btn" href="/notifications.html">OPEN</a></div></div></section>`;
    }
  };

  const load = async () => {
    const id = session.user.id;
    const [profileResult, settingsResult, balanceResult, tracksResult, productsResult, streamsResult, worldsResult, postsResult, alertResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('creator_page_settings').select('*').eq('user_id', id).maybeSingle(),
      supabase.from('creator_available_balances').select('*').eq('artist_user_id', id).maybeSingle(),
      supabase.from('music_tracks').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(30),
      supabase.from('products').select('*').eq('seller_id', id).order('created_at', { ascending: false }).limit(30),
      supabase.from('live_streams').select('*').eq('creator_id', id).order('created_at', { ascending: false }).limit(30),
      supabase.from('meta_worlds').select('*').eq('owner_id', id).order('created_at', { ascending: false }).limit(30),
      supabase.from('feed_posts').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(30),
      supabase.from('creator_alert_subscriptions').select('id', { count: 'exact', head: true }).eq('creator_id', id).eq('is_active', true)
    ]);
    const firstError = [profileResult, settingsResult, balanceResult, tracksResult, productsResult, streamsResult, worldsResult, postsResult].find((result) => result.error)?.error;
    if (firstError) return setStatus(firstError.message, true);
    profile = profileResult.data ?? {};
    settings = settingsResult.data ?? {};
    balance = balanceResult.data ?? {};
    tracks = tracksResult.data ?? [];
    products = productsResult.data ?? [];
    streams = streamsResult.data ?? [];
    worlds = worldsResult.data ?? [];
    posts = postsResult.data ?? [];
    alertSubscribers = alertResult.count ?? 0;
    const { data: gameRows } = await supabase.from('games').select('*').eq('is_active', true).order('is_featured', { ascending: false }).limit(30);
    games = gameRows ?? [];
    render();
  };

  renderTabs();
  await load();
  ['creator_page_settings', 'creator_available_balances', 'music_tracks', 'products', 'live_streams', 'meta_worlds', 'feed_posts', 'creator_alert_subscriptions'].forEach((table) => {
    const channel = supabase.channel(`creator:${table}:${session.user.id}`).on('postgres_changes', { event: '*', schema: 'public', table }, () => void load()).subscribe();
    channels.push(channel);
  });
  window.addEventListener('pagehide', () => { channels.forEach((channel) => void supabase.removeChannel(channel)); }, { once: true });
}
