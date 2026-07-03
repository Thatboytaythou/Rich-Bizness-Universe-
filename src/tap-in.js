import { supabase } from './supabase-client.js';
import { ensureProfile, signOutAndGoHome, slugName } from './rb-identity.js';
import { loadCurrentXp, awardXp } from './rb-xp.js';

const form = document.getElementById('authForm');
const createBtn = document.getElementById('createBtn');
const outBtn = document.getElementById('outBtn');
const status = document.getElementById('status');
const email = document.getElementById('email');
const password = document.getElementById('password');
const displayName = document.getElementById('displayName');
const say = (text) => { if (status) status.textContent = text; };
const lock = (yes) => { document.body.classList.toggle('auth-working', !!yes); form?.querySelectorAll('button,input').forEach((el) => { el.disabled = !!yes; }); if (createBtn) createBtn.disabled = !!yes; };

async function next(user) {
  if (!user) return;
  say('Syncing profile...');
  const profile = await ensureProfile(user);
  try { await loadCurrentXp(); } catch (_) {}
  location.replace(profile?.avatar_url ? '/profile.html' : '/avatar.html');
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
  const mail = email.value.trim();
  const pass = password.value;
  const { data, error } = await supabase.auth.signInWithPassword({ email: mail, password: pass });
  if (error) { lock(false); return say(error.message); }
  try { await awardXp('daily_tap_in', { section: 'auth' }); } catch (_) {}
  await next(data.user);
});

createBtn?.addEventListener('click', async () => {
  lock(true);
  say('Creating Rich identity...');
  const mail = email.value.trim();
  const pass = password.value;
  const name = displayName.value.trim() || mail.split('@')[0] || 'Rich Bizness Elite';
  if (!mail || !pass) { lock(false); return say('Email and password required.'); }
  const redirectTo = `${location.origin}/auth.html`;
  const { data, error } = await supabase.auth.signUp({ email: mail, password: pass, options: { emailRedirectTo: redirectTo, data: { display_name: name, username: slugName(name) } } });
  if (error) { lock(false); return say(error.message); }
  if (!data.user || !data.session) { lock(false); return say('Check email, then confirm to enter Avatar.'); }
  await ensureProfile(data.user);
  try { await awardXp('daily_tap_in', { section: 'auth' }); } catch (_) {}
  location.replace('/avatar.html');
});

outBtn?.addEventListener('click', signOutAndGoHome);
loadCurrentXp().catch(() => {});

(async () => {
  document.body.classList.add('auth-checking');
  const handled = await completeAuthReturn();
  if (handled) return;
  const { data } = await supabase.auth.getUser();
  if (data?.user) return next(data.user);
  document.body.classList.remove('auth-checking');
})();