import { supabase } from './supabase-client.js';
import { ensureTapInFoundation, slugName, safeNextRoute } from './rb-identity.js?v=tap-in-foundation-1';
import { loadCurrentXp, awardXp } from './rb-xp.js?v=realtime-2';

const form = document.getElementById('authForm');
const createBtn = document.getElementById('createBtn');
const status = document.getElementById('status');
const email = document.getElementById('email');
const password = document.getElementById('password');
const displayName = document.getElementById('displayName');
const next = safeNextRoute(new URL(location.href).searchParams.get('next') || '/', '/');
const say = (text) => { if (status) status.textContent = text; };
const lock = (on) => { document.body.classList.toggle('auth-working', !!on); form?.querySelectorAll('button,input').forEach((el) => { el.disabled = !!on; }); if (createBtn) createBtn.disabled = !!on; };
const calm = () => { document.querySelectorAll('.rb-overlay:not([data-rb-keep]),.rb-blocker:not([data-rb-keep])').forEach((el) => { el.style.pointerEvents = 'none'; el.setAttribute('aria-hidden','true'); }); };
const fail = (error) => { console.warn(error); lock(false); document.body.classList.remove('auth-checking'); say(error?.message || 'Tap In blocked. Check Profile Lock.'); };
async function finish(user) { calm(); say('Locking Profile, Avatar, and XP...'); const found = await ensureTapInFoundation(user, { next }); try { await loadCurrentXp(); } catch (_) {} location.replace(found?.route || next || '/'); }
async function checkReturned() { const url = new URL(location.href); if (!(url.hash.includes('access_token') || url.searchParams.has('code') || url.searchParams.get('type') === 'signup')) return false; const session = await supabase.auth.getSession(); if (session.data?.session?.user) { await finish(session.data.session.user); return true; } const user = await supabase.auth.getUser(); if (user.data?.user) { await finish(user.data.user); return true; } say('Confirmed. Tap In to finish.'); return true; }
form?.addEventListener('submit', async (event) => { event.preventDefault(); lock(true); calm(); say('Opening portal...'); try { const result = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: password.value }); if (result.error) throw result.error; try { await awardXp('daily_tap_in', { section: 'auth' }); } catch (_) {} await finish(result.data.user); } catch (error) { fail(error); } });
createBtn?.addEventListener('click', async () => { lock(true); calm(); say('Creating Rich identity...'); try { const mail = email.value.trim(); const pass = password.value; const name = displayName.value.trim() || mail.split('@')[0] || 'Rich Bizness User'; if (!mail || !pass) throw new Error('Email and password required.'); const result = await supabase.auth.signUp({ email: mail, password: pass, options: { emailRedirectTo: `${location.origin}/auth.html?next=${encodeURIComponent(next)}`, data: { display_name: name, username: slugName(name) } } }); if (result.error) throw result.error; if (!result.data.user || !result.data.session) { lock(false); say('Check email, then confirm to Tap In.'); return; } const found = await ensureTapInFoundation(result.data.user, { next }); try { await awardXp('daily_tap_in', { section: 'auth' }); } catch (_) {} location.replace(found?.route || '/avatar.html'); } catch (error) { fail(error); } });
loadCurrentXp().catch(() => {});
calm();
(async () => { document.body.classList.add('auth-checking'); try { if (await checkReturned()) return; const session = await supabase.auth.getSession(); if (session.data?.session?.user) { await finish(session.data.session.user); return; } document.body.classList.remove('auth-checking'); } catch (error) { fail(error); } })();
