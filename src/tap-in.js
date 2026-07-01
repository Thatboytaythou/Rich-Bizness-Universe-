import { supabase } from './supabase-client.js';
import { ensureProfile, signOutAndGoHome, slugName } from './rb-identity.js';

const form = document.getElementById('authForm');
const createBtn = document.getElementById('createBtn');
const outBtn = document.getElementById('outBtn');
const status = document.getElementById('status');
const email = document.getElementById('email');
const password = document.getElementById('password');
const displayName = document.getElementById('displayName');
const say = (text) => { if (status) status.textContent = text; };

async function next(user) {
  if (!user) return;
  const profile = await ensureProfile(user);
  location.replace(profile?.avatar_url ? '/profile.html' : '/avatar.html');
}

async function completeAuthReturn() {
  const url = new URL(location.href);
  const hasAuthReturn = url.hash.includes('access_token') || url.searchParams.has('code') || url.searchParams.get('type') === 'signup';
  if (!hasAuthReturn) return false;
  say('Confirming portal...');
  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) {
    await next(data.session.user);
    return true;
  }
  const userRes = await supabase.auth.getUser();
  if (userRes.data?.user) {
    await next(userRes.data.user);
    return true;
  }
  say('Confirmed. Tap In to finish.');
  return true;
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  say('Opening portal...');
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
  if (error) return say(error.message);
  await next(data.user);
});

createBtn?.addEventListener('click', async () => {
  say('Creating identity...');
  const name = displayName.value.trim() || email.value.split('@')[0] || 'Rich Bizness Elite';
  const redirectTo = `${location.origin}/auth.html`;
  const { data, error } = await supabase.auth.signUp({
    email: email.value.trim(),
    password: password.value,
    options: { emailRedirectTo: redirectTo, data: { display_name: name, username: slugName(name) } },
  });
  if (error) return say(error.message);
  if (!data.user || !data.session) return say('Check email, then confirm to enter Avatar.');
  await ensureProfile(data.user);
  location.replace('/avatar.html');
});

outBtn?.addEventListener('click', signOutAndGoHome);

(async () => {
  document.body.classList.add('auth-checking');
  const handled = await completeAuthReturn();
  if (handled) return;
  const { data } = await supabase.auth.getUser();
  if (data?.user) return next(data.user);
  document.body.classList.remove('auth-checking');
})();
