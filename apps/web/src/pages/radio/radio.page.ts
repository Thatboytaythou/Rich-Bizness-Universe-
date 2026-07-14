import { supabase } from '../../core/supabase/client';
import '../../styles/rich-sound.css';

type Row = Record<string, any>;
const esc = (v: any) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
const fmt = (n: any) => Number(n ?? 0).toLocaleString();
const safe = (v: any) => { try { const u = new URL(String(v || ''), location.origin); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };

export async function mount(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app mount');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { location.replace('/tap-in.html?next=%2Fradio.html'); return; }

  const { data, error } = await supabase.from('radio_stations').select('*').eq('is_public', true).order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  const stations = (data ?? []) as Row[];
  let active: Row | null = stations[0] ?? null;
  let liked = false;
  let channel: any = null;

  root.innerHTML = `<main class="sound-universe"><div class="sound-wrap"><header class="sound-head"><a href="/portal.html">←</a><div class="sound-brand"><small>RICH BIZNESS LIVE AUDIO</small><h1>RADIO UNIVERSE</h1></div><nav class="sound-nav"><a href="/music.html">MUSIC</a><a href="/podcast.html">PODCAST</a><a class="active" href="/radio.html">RADIO</a></nav></header><section class="sound-hero"><article id="radioHero" class="sound-now"></article><aside class="sound-panel"><section class="sound-metrics"><article><small>STATIONS</small><strong>${fmt(stations.length)}</strong></article><article><small>LIVE NOW</small><strong>${fmt(stations.filter((x) => x.is_live).length)}</strong></article><article><small>LISTENERS</small><strong>${fmt(stations.reduce((n, x) => n + Number(x.listener_count ?? 0), 0))}</strong></article><article><small>LIKES</small><strong>${fmt(stations.reduce((n, x) => n + Number(x.like_count ?? 0), 0))}</strong></article></section><div id="radioList" class="sound-list"></div></aside></section><section class="sound-lower"><article class="sound-panel"><h3>ON AIR NETWORK</h3><div class="sound-empty">Continuous Rich Bizness radio, creator takeovers, interviews, DJ sets and live community broadcasts.</div></article><article class="sound-panel"><h3>STATION STATUS</h3><div id="radioStatus" class="sound-empty">Select a station to connect.</div></article></section><aside id="radioPlayer" class="sound-player" hidden><img id="radioPlayerCover" alt=""><div><strong id="radioPlayerTitle"></strong><small id="radioPlayerMeta"></small></div><audio id="radioAudio" controls autoplay preload="none"></audio></aside></div></main>`;

  const list = document.querySelector<HTMLElement>('#radioList')!;
  const hero = document.querySelector<HTMLElement>('#radioHero')!;
  const status = document.querySelector<HTMLElement>('#radioStatus')!;
  const player = document.querySelector<HTMLElement>('#radioPlayer')!;
  const audio = document.querySelector<HTMLAudioElement>('#radioAudio')!;

  const refreshLike = async () => {
    liked = false;
    if (!active) return;
    const { data } = await supabase.from('radio_likes').select('id').eq('user_id', session.user.id).eq('station_id', active.id).maybeSingle();
    liked = !!data;
  };

  const openStation = async (station: Row) => {
    active = station;
    await refreshLike();
    const cover = safe(station.cover_url) || '/images/brand/IMG_5997.png';
    hero.innerHTML = `<img src="${esc(cover)}" alt=""><div class="sound-copy"><span>${station.is_live ? '● LIVE NOW' : 'RICH RADIO'} · ${esc(station.station_tag || station.genre || 'GLOBAL')}</span><h2>${esc(station.station_name || station.title || 'Rich Radio')}</h2><p>${esc(station.description || 'Streaming the Rich Bizness universe live and worldwide.')}</p><div class="sound-actions"><button id="radioPlayBtn" class="sound-btn primary">▶ LISTEN LIVE</button><button id="radioLikeBtn" class="sound-btn">${liked ? '♥ LIKED' : '♡ LIKE'}</button><a class="sound-btn" href="/profile.html?id=${esc(station.creator_id || station.user_id)}">STATION PROFILE</a></div></div>`;
    player.hidden = false;
    document.querySelector<HTMLImageElement>('#radioPlayerCover')!.src = cover;
    document.querySelector<HTMLElement>('#radioPlayerTitle')!.textContent = station.station_name || station.title || 'Rich Radio';
    document.querySelector<HTMLElement>('#radioPlayerMeta')!.textContent = `${station.is_live ? 'LIVE' : 'RADIO'} · ${station.station_tag || station.genre || 'Rich Bizness'}`;
    const src = safe(station.stream_url || station.audio_url);
    audio.src = src;
    status.textContent = src ? `${station.is_live ? 'LIVE SIGNAL' : 'STREAM READY'} · ${fmt(station.listener_count)} LISTENERS` : 'STREAM URL NOT AVAILABLE';
    document.querySelector<HTMLButtonElement>('#radioPlayBtn')!.onclick = () => void audio.play();
    document.querySelector<HTMLButtonElement>('#radioLikeBtn')!.onclick = async () => {
      const result = liked ? await supabase.from('radio_likes').delete().eq('user_id', session.user.id).eq('station_id', station.id) : await supabase.from('radio_likes').insert({ user_id: session.user.id, station_id: station.id });
      if (!result.error) await openStation(station);
    };
    list.querySelectorAll('.sound-card').forEach((node) => node.classList.toggle('active', (node as HTMLElement).dataset.id === String(station.id)));
    history.replaceState({}, '', `/radio.html?id=${encodeURIComponent(station.id)}`);
  };

  list.innerHTML = stations.map((station) => `<button class="sound-card" data-id="${station.id}"><img src="${esc(safe(station.cover_url) || '/images/brand/IMG_5997.png')}" alt=""><span><b>${esc(station.station_name || station.title || 'Rich Radio')}</b><small>${station.is_live ? '● LIVE' : 'RADIO'} · ${esc(station.station_tag || station.genre || 'Global')}</small></span><strong>${fmt(station.listener_count)} ◉</strong></button>`).join('') || '<div class="sound-empty">The Radio Universe is ready for its first station.</div>';
  list.querySelectorAll<HTMLElement>('[data-id]').forEach((node) => { node.onclick = () => { const station = stations.find((x) => String(x.id) === node.dataset.id); if (station) void openStation(station); }; });

  channel = supabase.channel('rich-radio-stations').on('postgres_changes', { event: '*', schema: 'public', table: 'radio_stations' }, () => location.reload()).on('postgres_changes', { event: '*', schema: 'public', table: 'radio_likes' }, () => { if (active) void refreshLike(); }).subscribe();
  window.addEventListener('pagehide', () => { audio.pause(); if (channel) void supabase.removeChannel(channel); }, { once: true });
  const requested = new URLSearchParams(location.search).get('id');
  const initial = stations.find((x) => String(x.id) === requested) ?? stations[0];
  if (initial) await openStation(initial); else hero.innerHTML = '<div class="sound-empty">No radio stations are public yet.</div>';
}
