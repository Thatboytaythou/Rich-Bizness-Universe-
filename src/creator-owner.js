import { supabase } from './supabase-client.js';
import { getAuthoritativeIdentity, ensureProfile } from './rb-identity.js?v=identity-owner-2';

const $ = (selector) => document.querySelector(selector);
const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const money = (value) => '$' + (Number(value || 0) / 100).toFixed(2);

let user = null;
let profile = null;
let settings = null;
let channel = null;
let loadFlight = null;
let saveFlight = null;
let refreshTimer = null;

function say(text) {
  const el = $('#creatorStatus');
  if (el) el.textContent = text;
}

function optionRows(rows, label) {
  return [
    `<option value="">No featured ${esc(label)}</option>`,
    ...(rows || []).map((row) => `<option value="${esc(row.id)}">${esc(row.title || row.name || label)}</option>`),
  ].join('');
}

function safeHttpUrl(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  try {
    const url = new URL(input, location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function cssUrl(value) {
  const url = safeHttpUrl(value);
  return url ? `url("${url.replaceAll('"', '%22')}")` : '';
}

async function ownerRows() {
  const [tracks, products, live, games, worlds, balance, seller] = await Promise.all([
    supabase.from('music_tracks').select('id,title').or(`user_id.eq.${user.id},artist_user_id.eq.${user.id}`).order('created_at', { ascending:false }).limit(50),
    supabase.from('products').select('id,title').eq('seller_id', user.id).order('created_at', { ascending:false }).limit(50),
    supabase.from('live_streams').select('id,title').eq('creator_id', user.id).order('created_at', { ascending:false }).limit(50),
    supabase.from('games').select('id,title').order('created_at', { ascending:false }).limit(50),
    supabase.from('meta_worlds').select('id,title').eq('owner_id', user.id).order('created_at', { ascending:false }).limit(50),
    supabase.from('creator_available_balances').select('*').eq('artist_user_id', user.id).maybeSingle(),
    supabase.from('store_seller_profiles').select('*').eq('user_id', user.id).maybeSingle(),
  ]);

  return {
    tracks: tracks.data || [],
    products: products.data || [],
    live: live.data || [],
    games: games.data || [],
    worlds: worlds.data || [],
    balance: balance.data || {},
    seller: seller.data || {},
  };
}

function paintStats(extra) {
  $('#creatorEarned').textContent = money(extra.balance.earned_cents);
  $('#creatorAvailable').textContent = money(extra.balance.available_cents);
  $('#creatorPending').textContent = money(extra.balance.pending_cents);
  $('#creatorProducts').textContent = String(extra.products.length);
  $('#creatorTracks').textContent = String(extra.tracks.length);
  $('#creatorLive').textContent = String(extra.live.length);
  $('#recordCount').textContent = '1';
}

function fillForm(extra) {
  const row = settings || {};
  $('#creator_title').value = row.creator_title || profile.display_name || '';
  $('#creator_tagline').value = row.creator_tagline || profile.bio || '';
  $('#hero_background_url').value = row.hero_background_url || profile.banner_url || '';
  $('#intro_style').value = row.intro_style || 'cinematic';
  $('#page_theme').value = row.page_theme || 'smoke-cloud';
  $('#monetization_style').value = row.monetization_style || 'premium';
  ['show_music','show_live','show_store','show_gallery','show_games','show_meta'].forEach((id) => { $('#'+id).checked = row[id] !== false; });
  $('#featured_track_id').innerHTML = optionRows(extra.tracks, 'track');
  $('#featured_product_id').innerHTML = optionRows(extra.products, 'product');
  $('#featured_live_id').innerHTML = optionRows(extra.live, 'live room');
  $('#featured_game_id').innerHTML = optionRows(extra.games, 'game');
  $('#featured_world_id').innerHTML = optionRows(extra.worlds, 'world');
  ['featured_track_id','featured_product_id','featured_live_id','featured_game_id','featured_world_id'].forEach((id) => { if (row[id]) $('#'+id).value = row[id]; });
  paintPreview();
}

function paintPreview() {
  const title = $('#creator_title')?.value || profile?.display_name || 'Creator Page';
  const tagline = $('#creator_tagline')?.value || 'Build your Rich Bizness creator lane.';
  const hero = $('#hero_background_url')?.value || profile?.banner_url || '';
  $('#creatorPreviewTitle').textContent = title;
  $('#creatorPreviewTagline').textContent = tagline;
  const background = cssUrl(hero);
  $('#creatorPreview').style.backgroundImage = background ? `linear-gradient(rgba(0,0,0,.18),rgba(0,0,0,.78)),${background}` : '';
  $('#creatorPreviewMeta').textContent = `${$('#page_theme').value} • ${$('#monetization_style').value}`;
}

async function load() {
  if (loadFlight) return loadFlight;
  loadFlight = (async () => {
    const state = await getAuthoritativeIdentity();
    user = state.user;
    if (!user) {
      location.replace('/auth.html?next=/creator.html');
      return;
    }
    profile = await ensureProfile(user);
    const { data, error } = await supabase.from('creator_page_settings').select('*').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    settings = data || { user_id:user.id };
    const extra = await ownerRows();
    paintStats(extra);
    fillForm(extra);
    say('Creator Hub ready.');
  })();

  try {
    return await loadFlight;
  } catch (error) {
    say(error.message || String(error));
  } finally {
    loadFlight = null;
  }
}

function scheduleLoad() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    if (!saveFlight) load();
  }, 180);
}

async function save(event) {
  event.preventDefault();
  if (saveFlight) return saveFlight;
  saveFlight = (async () => {
    say('Saving Creator Hub...');
    const heroBackgroundUrl = safeHttpUrl($('#hero_background_url').value);
    if ($('#hero_background_url').value.trim() && !heroBackgroundUrl) throw new Error('Hero background must use a valid http or https URL.');
    const row = {
      user_id:user.id,
      creator_title:$('#creator_title').value.trim().slice(0,80),
      creator_tagline:$('#creator_tagline').value.trim().slice(0,240),
      hero_background_url:heroBackgroundUrl || null,
      intro_style:$('#intro_style').value,
      page_theme:$('#page_theme').value,
      monetization_style:$('#monetization_style').value,
      show_music:$('#show_music').checked,
      show_live:$('#show_live').checked,
      show_store:$('#show_store').checked,
      show_gallery:$('#show_gallery').checked,
      show_games:$('#show_games').checked,
      show_meta:$('#show_meta').checked,
      featured_track_id:$('#featured_track_id').value || null,
      featured_product_id:$('#featured_product_id').value || null,
      featured_live_id:$('#featured_live_id').value || null,
      featured_game_id:$('#featured_game_id').value || null,
      featured_world_id:$('#featured_world_id').value || null,
      updated_at:new Date().toISOString(),
    };
    const { data, error } = await supabase.from('creator_page_settings').upsert(row, { onConflict:'user_id' }).select('*').single();
    if (error) throw error;
    settings = data;
    await supabase.from('profiles').update({ is_creator:true, updated_at:new Date().toISOString() }).eq('id', user.id);
    fillForm(await ownerRows());
    say('Creator Hub saved.');
  })();

  try {
    return await saveFlight;
  } catch (error) {
    say(error.message || String(error));
  } finally {
    saveFlight = null;
  }
}

$('#creatorForm')?.addEventListener('submit', save);
$('#creatorForm')?.addEventListener('input', paintPreview);
$('#creatorForm')?.addEventListener('change', paintPreview);

addEventListener('pagehide', () => {
  clearTimeout(refreshTimer);
  if (channel) supabase.removeChannel(channel);
}, { once:true });

load().then(() => {
  if (!user) return;
  channel = supabase.channel('creator-owner-' + user.id)
    .on('postgres_changes', { event:'*', schema:'public', table:'creator_page_settings', filter:'user_id=eq.' + user.id }, scheduleLoad)
    .on('postgres_changes', { event:'*', schema:'public', table:'creator_available_balances', filter:'artist_user_id=eq.' + user.id }, scheduleLoad)
    .subscribe();
});