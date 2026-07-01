import { supabase } from './supabase-client.js';
import { ensureProfile, signOutAndGoHome, slugName } from './rb-identity.js';

const form = document.getElementById('authForm');
const createBtn = document.getElementById('createBtn');
const outBtn = document.getElementById('outBtn');
const status = document.getElementById('status');
const email = document.getElementById('email');
const password = document.getElementById('password');
const displayName = document.getElementById('displayName');
const say = (text) => { status.textContent = text; };

async function next(user) {
  const profile = await ensureProfile(user);
  location.href = profile?.avatar_url ? '/profile.html' : '/avatar.html';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  say('Opening portal...');
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
  if (error) return say(error.message);
  next(data.user);
});

createBtn.addEventListener('click', async () => {
  say('Creating identity...');
  const name = displayName.value.trim() || email.value.split('@')[0] || 'Rich Bizness Elite';
  const { data, error } = await supabase.auth.signUp({ email: email.value.trim(), password: password.value, options: { data: { display_name: name, username: slugName(name) } } });
  if (error) return say(error.message);
  if (!data.user) return say('Check email, then Tap In.');
  await ensureProfile(data.user);
  location.href = '/avatar.html';
});

outBtn.addEventListener('click', signOutAndGoHome);
supabase.auth.getUser().then(({ data }) => { if (data?.user) next(data.user); });
