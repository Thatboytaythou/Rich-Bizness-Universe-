import { supabase } from './supabase-client.js';
import { ensureProfile, slugName } from './rb-identity.js?v=connected-identity-1';
import { loadCurrentXp, awardXp } from './rb-xp.js?v=no-floating-badge-1';

const form = document.getElementById('authForm');
const createBtn = document.getElementById('createBtn');
const status = document.getElementById('status');
const email = document.getElementById('email');
const password = document.getElementById('password');
const displayName = document.getElementById('displayName');
const say = (text) => { if (status) status.textContent = text; };
const lock = (yes) => { document.body.classList.toggle('auth-working', !!yes); form?.querySelectorAll('button,input').forEach((el) => { el.disabled = !!yes; }); if (createBtn) createBtn.disabled = !!yes; };
const fail = (error, fallback = 'Auth blocked. Check profile policies.') => { console.warn(error); lock(false); say(error?.message || fallback); document.body.classList.remove('auth-checking'); };

function nextRoute(profile) {
  const state = profile?.onboarding_state || (profile?.has_avatar || profile?.avatar_url ? 'complete' : 'needs_avatar');
  if (state === 'needs_avatar' || state === 'new') return '/avatar.html';
  if (state === 'needs_profile') return '/profile.html';
  const last = profile?.last_route;
  return last && last !== '/auth.html' && last !== '/profile.html' ? last : '/';
}

async function next(user) {
  if (!user) return;
  say('Syncing profile...');
  const profile = await ensureProfile(user);
  try { await loadCurrentXp(); } catch (_) {}
  const route = nextRoute(profile);
  try { await supabase.from('profiles').update({ last_route: route }).eq('id', user.id); } catch (_) {}
  location.replace(route);
}

async function completeAuthReturn() {
  const url = new URL(location.href);
  const hasAuthReturn = url.hash.includes('access_token') || url.searchParams.has('code') || url.searchParams.get('type') === 'signup';
  if (!hasAuthReturn) return false;
  say('Confirming portal...');
  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) { await next(data.session.user); return true; }
  const userRes = await supabase.auth.getUser();
  if (userRes.data?.user) { await next(userRes.data.user); return true; }
  say('Confirmed. Tap In to finish.');
  return true;
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  lock(true);
  say('Opening portal...');
  try {
    const mail = email.value.trim();
    const pass = password.value;
    const { data, error } = await supabase.auth.signInWithPassword({ email: mail, password: pass });
    if (error) throw error;
    try { await awardXp('daily_tap_in', { section: 'auth' }); } catch (_) {}
    await next(data.user);
  } catch (error) { fail(error); }
});

createBtn?.addEventListener('click', async () => {
  lock(true);
  say('Creating Rich identity...');
  try {
    const mail = email.value.trim();
    const pass = password.value;
    const name = displayName.value.trim() || mail.split('@')[0] || 'Rich Bizness Elite';
    if (!mail || !pass) throw new Error('Email and password required.');
    const redirectTo = `${location.origin}/auth.html`;
    const { data, error } = await supabase.auth.signUp({ email: mail, password: pass, options: { emailRedirectTo: redirectTo, data: { display_name: name, username: slugName(name) } } });
    if (error) throw error;
    if (!data.user || !data.session) { lock(false); return say('Check email, then confirm to enter Avatar.'); }
    const profile = await ensureProfile(data.user);
    await supabase.from('profiles').update({ onboarding_state: 'needs_avatar', has_profile_identity: true, last_route: '/avatar.html' }).eq('id', data.user.id);
    try { await awardXp('daily_tap_in', { section: 'auth' }); } catch (_) {}
    location.replace(nextRoute({ ...profile, onboarding_state: 'needs_avatar', last_route: '/avatar.html' }));
  } catch (error) { fail(error); }
});

loadCurrentXp().catch(() => {});

(async () => {
  document.body.classList.add('auth-checking');
  try {
    const handled = await completeAuthReturn();
    if (handled) return;
    const { data } = await supabase.auth.getUser();
    if (data?.user) return next(data.user);
    document.body.classList.remove('auth-checking');
  } catch (error) { fail(error); }
})();
