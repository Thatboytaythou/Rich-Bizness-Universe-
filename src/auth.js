import { supabase } from './supabase-client.js';

const form = document.querySelector('#authForm');
const createButton = document.querySelector('#createAccount');
const status = document.querySelector('#authStatus');
let busy = false;

function say(message, error = false) {
  if (!status) return;
  status.textContent = message;
  status.dataset.error = error ? 'true' : 'false';
}

function fields() {
  return {
    email: String(document.querySelector('#email')?.value || '').trim(),
    password: String(document.querySelector('#password')?.value || ''),
    displayName: String(document.querySelector('#displayName')?.value || '').trim()
  };
}

async function signIn(event) {
  event.preventDefault();
  if (!supabase || busy) return;
  const { email, password } = fields();
  if (!email || !password) return say('ENTER EMAIL AND PASSWORD', true);
  busy = true;
  say('TAPPING IN...');
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    location.href = new URLSearchParams(location.search).get('next') || '/profile.html';
  } catch (error) {
    say(error.message || 'SIGN IN FAILED', true);
  } finally {
    busy = false;
  }
}

async function createAccount() {
  if (!supabase || busy) return;
  const { email, password, displayName } = fields();
  if (!email || password.length < 6) return say('USE A VALID EMAIL AND 6+ CHARACTER PASSWORD', true);
  busy = true;
  say('CREATING RICH ID...');
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName || 'Rich Bizness User' } }
    });
    if (error) throw error;
    if (data.user && data.session) location.href = '/profile.html';
    else say('CHECK YOUR EMAIL TO FINISH TAP IN');
  } catch (error) {
    say(error.message || 'CREATE ID FAILED', true);
  } finally {
    busy = false;
  }
}

if (!supabase) say('SUPABASE ENV VARIABLES REQUIRED', true);
form?.addEventListener('submit', signIn);
createButton?.addEventListener('click', createAccount);
