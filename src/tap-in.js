import { supabase } from './supabase-client.js';
import { ensureProfile, slugName, profileRoute } from './rb-identity.js?v=connected-identity-2';
import { loadCurrentXp, awardXp } from './rb-xp.js?v=realtime-1';

const form = document.getElementById('authForm');
const createBtn = document.getElementById('createBtn');
const status = document.getElementById('status');
const email = document.getElementById('email');
const password = document.getElementById('password');
const displayName = document.getElementById('displayName');
const say = (text) => { if (status) status.textContent = text; };
const lock = (yes) => { document.body.classList.toggle('auth-working', !!yes); form?.querySelectorAll('button,input').forEach((el) => { el.disabled = !!yes; }); if (createBtn) createBtn.disabled = !!yes; };
const fail = (error) => { console.warn(error); lock(false); say(error?.message || 'Auth blocked. Check profile policies.'); document.body.classList.remove('auth-checking'); };
function cleanAuthArtifacts() { document.querySelectorAll('#globalXpBadge,#xpToast,.xp-gauge,[data-rich-money],[data-balance-cents],[data-wallet-money],.rb-overlay,.rb-blocker,.miniProfile,.composerPanel,.hero-art').forEach((el) => el.remove()); document.body?.removeAttribute('data-rich-money'); }

async function enter(user) {
  cleanAuthArtifacts();
  say('Syncing profile...');
  const profile = await ensureProfile(user);
  try { await loadCurrentXp(); } catch (_) {}
  location.replace(profileRoute(profile));
}

async function returned() {
  const url = new URL(location.href);
  if (!(url.hash.includes('access_token') || url.searchParams.has('code') || url.searchParams.get('type') === 'signup')) return false;
  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) { await enter(data.session.user); return true; }
  const userRes = await supabase.auth.getUser();
  if (userRes.data?.user) { await enter(userRes.data.user); return true; }
  say('Confirmed. Tap In to finish.');
  return true;
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault(); lock(true); cleanAuthArtifacts(); say('Opening portal...');
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
    if (error) throw error;
    try { await awardXp('daily_tap_in', { section: 'auth' }); } catch (_) {}
    await enter(data.user);
  } catch (error) { fail(error); }
});

createBtn?.addEventListener('click', async () => {
  lock(true); cleanAuthArtifacts(); say('Creating Rich identity...');
  try {
    const mail = email.value.trim();
    const pass = password.value;
    const name = displayName.value.trim() || mail.split('@')[0] || 'Rich Bizness User';
    if (!mail || !pass) throw new Error('Email and password required.');
    const { data, error } = await supabase.auth.signUp({ email: mail, password: pass, options: { emailRedirectTo: `${location.origin}/auth.html`, data: { display_name: name, username: slugName(name) } } });
    if (error) throw error;
    if (!data.user || !data.session) { lock(false); return say('Check email, then confirm to enter Avatar.'); }
    await ensureProfile(data.user);
    await supabase.from('profiles').update({ onboarding_state: 'needs_avatar', has_profile_identity: true, last_route: '/avatar.html' }).eq('id', data.user.id);
    try { await awardXp('daily_tap_in', { section: 'auth' }); } catch (_) {}
    location.replace('/avatar.html');
  } catch (error) { fail(error); }
});

loadCurrentXp().catch(() => {});
cleanAuthArtifacts();

(async () => {
  document.body.classList.add('auth-checking');
  try {
    if (await returned()) return;
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) return enter(data.session.user);
    document.body.classList.remove('auth-checking');
  } catch (error) { fail(error); }
})();