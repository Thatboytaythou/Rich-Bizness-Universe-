import { RB_CONFIG } from './config.js';
import { supabase } from './supabase-client.js';
import { watchConnection } from './ui-state.js';

const $ = (selector) => document.querySelector(selector);
const setText = (selector, value) => {
  const node = $(selector);
  if (node) node.textContent = String(value ?? 0);
};

let disposed = false;
let stopConnectionWatch = null;

async function count(table, configure) {
  if (!supabase) return 0;
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  if (typeof configure === 'function') query = configure(query);
  const { count: total, error } = await query;
  if (error) throw error;
  return total || 0;
}

function setHomeState(message, tone = 'ready') {
  const status = $('#systemStatus');
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

async function renderAccountState() {
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  const user = data?.user || null;
  const tapIn = document.querySelector('.rb-account a[href="/auth.html"]');
  const profile = document.querySelector('.rb-account a[href="/profile.html"]');
  if (user) {
    tapIn.textContent = 'SIGNED IN';
    tapIn.href = '/settings.html';
    profile.textContent = 'MY RICH ID';
    document.body.dataset.authState = 'signed-in';
  } else {
    document.body.dataset.authState = 'signed-out';
  }
}

async function loadPlatformStatus() {
  if (!supabase) {
    setHomeState('SUPABASE ENV REQUIRED', 'error');
    return;
  }
  setHomeState('SYNCING THE UNIVERSE');
  try {
    const [live, games, worlds, users] = await Promise.all([
      count(RB_CONFIG.tables.liveStreams, (query) => query.in('status', ['live', 'active', 'scheduled'])),
      count(RB_CONFIG.tables.games),
      count(RB_CONFIG.tables.metaWorlds),
      count(RB_CONFIG.tables.profiles)
    ]);
    if (disposed) return;
    setText('#statLive', live);
    setText('#statGames', games);
    setText('#statWorlds', worlds);
    setText('#statUsers', users);
    setHomeState('SUPABASE CONNECTED');
  } catch (error) {
    if (!disposed) setHomeState(`DATA CHECK FAILED • ${error.message}`, 'error');
  }
}

function bindPortalState() {
  document.querySelectorAll('.lane').forEach((lane) => {
    lane.addEventListener('pointerdown', () => lane.dataset.pressed = 'true');
    lane.addEventListener('pointerup', () => delete lane.dataset.pressed);
    lane.addEventListener('pointercancel', () => delete lane.dataset.pressed);
  });
}

async function boot() {
  document.documentElement.dataset.rbApp = 'original-rebuild';
  bindPortalState();
  stopConnectionWatch = watchConnection((online) => {
    document.documentElement.dataset.network = online ? 'online' : 'offline';
    if (!online) setHomeState('OFFLINE • PORTAL PAUSED', 'error');
    else loadPlatformStatus();
  });
  await renderAccountState();
}

window.addEventListener('pagehide', () => {
  disposed = true;
  stopConnectionWatch?.();
}, { once: true });

boot();
