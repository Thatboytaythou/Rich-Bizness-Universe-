import { safeInternalRoute } from '@rb/config/routes';
import { supabase } from '../../core/supabase/client';

const esc = (value: string | null | undefined) => (value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char] ?? char));

export async function mountTapInPage(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) throw new Error('Missing #app mount');

  const params = new URLSearchParams(location.search);
  const next = safeInternalRoute(params.get('next'));
  const recoveryMode = params.get('mode') === 'recovery';
  const { data: { session } } = await supabase.auth.getSession();
  if (session && !recoveryMode) {
    location.replace(next);
    return;
  }

  app.innerHTML = `
    <main class="auth-shell">
      <div class="auth-atmosphere" aria-hidden="true"><i></i><i></i><i></i></div>
      <a class="auth-back" href="/" aria-label="Back to portal">←</a>
      <section class="auth-visual">
        <div class="auth-mark"><span>RB</span></div>
        <p>RICH BIZNESS LLC</p>
        <h1>ONE ID.<br>EVERY WORLD.</h1>
        <div class="auth-route-strip">
          <span>PROFILE</span><span>AVATAR</span><span>LIVE</span><span>STORE</span><span>META</span>
        </div>
      </section>
      <section class="auth-card">
        <header>
          <p class="eyebrow">SECURE UNIVERSE ACCESS</p>
          <h2>${recoveryMode ? 'RESET ACCESS' : 'TAP IN'}</h2>
          <span>Your profile, avatar, level, creator tools, and purchases stay locked to one identity.</span>
        </header>
        ${recoveryMode ? `
          <form id="recoveryForm" class="auth-form">
            <label>NEW PASSWORD<div class="auth-input"><input id="newPassword" type="password" minlength="8" autocomplete="new-password" required placeholder="Minimum 8 characters"><button type="button" data-toggle-password="newPassword">SHOW</button></div></label>
            <button class="auth-primary" type="submit">SAVE NEW PASSWORD</button>
          </form>
        ` : `
          <div class="auth-tabs" role="tablist">
            <button class="active" type="button" data-auth-mode="signin">SIGN IN</button>
            <button type="button" data-auth-mode="signup">CREATE RICH ID</button>
          </div>
          <form id="authForm" class="auth-form">
            <label id="displayNameLabel" hidden>DISPLAY NAME<div class="auth-input"><input id="displayName" name="displayName" autocomplete="name" maxlength="80" placeholder="ThatboyTayThou"></div></label>
            <label>EMAIL<div class="auth-input"><input id="email" name="email" type="email" autocomplete="email" required placeholder="you@example.com"></div></label>
            <label>PASSWORD<div class="auth-input"><input id="password" name="password" type="password" minlength="8" required autocomplete="current-password" placeholder="Minimum 8 characters"><button type="button" data-toggle-password="password">SHOW</button></div></label>
            <button id="submitButton" class="auth-primary" type="submit">ENTER THE UNIVERSE</button>
            <button id="recoverButton" class="auth-link" type="button">RECOVER PASSWORD</button>
          </form>
        `}
        <p id="authStatus" class="auth-status" role="status">RICH ACCESS READY</p>
        <footer><span>PROFILE</span><i></i><span>AVATAR</span><i></i><span>LEVEL</span><i></i><span>UNIVERSE</span></footer>
      </section>
    </main>`;

  const status = document.querySelector<HTMLParagraphElement>('#authStatus');
  if (!status) throw new Error('Tap In status failed to mount');
  const setStatus = (message: string, error = false) => {
    status.textContent = message;
    status.dataset.error = String(error);
  };

  document.querySelectorAll<HTMLButtonElement>('[data-toggle-password]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.querySelector<HTMLInputElement>(`#${button.dataset.togglePassword}`);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      button.textContent = input.type === 'password' ? 'SHOW' : 'HIDE';
    });
  });

  if (recoveryMode) {
    const form = document.querySelector<HTMLFormElement>('#recoveryForm');
    const password = document.querySelector<HTMLInputElement>('#newPassword');
    if (!form || !password) throw new Error('Recovery form failed to mount');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setStatus('UPDATING ACCESS...');
      const { error } = await supabase.auth.updateUser({ password: password.value });
      if (error) return setStatus(error.message, true);
      setStatus('PASSWORD UPDATED — ENTERING UNIVERSE');
      window.setTimeout(() => location.assign('/profile.html'), 700);
    });
    return;
  }

  let mode: 'signin' | 'signup' = 'signin';
  const form = document.querySelector<HTMLFormElement>('#authForm');
  const email = document.querySelector<HTMLInputElement>('#email');
  const password = document.querySelector<HTMLInputElement>('#password');
  const displayName = document.querySelector<HTMLInputElement>('#displayName');
  const displayNameLabel = document.querySelector<HTMLElement>('#displayNameLabel');
  const submitButton = document.querySelector<HTMLButtonElement>('#submitButton');
  if (!form || !email || !password || !displayName || !displayNameLabel || !submitButton) throw new Error('Tap In form failed to mount');

  document.querySelectorAll<HTMLButtonElement>('[data-auth-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      mode = button.dataset.authMode === 'signup' ? 'signup' : 'signin';
      document.querySelectorAll('[data-auth-mode]').forEach((node) => node.classList.toggle('active', node === button));
      displayNameLabel.hidden = mode !== 'signup';
      displayName.required = mode === 'signup';
      password.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
      submitButton.textContent = mode === 'signup' ? 'CREATE MY RICH ID' : 'ENTER THE UNIVERSE';
      setStatus(mode === 'signup' ? 'CREATE ONE ID FOR EVERY ROUTE' : 'RICH ACCESS READY');
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    setStatus(mode === 'signup' ? 'CREATING YOUR RICH ID...' : 'VERIFYING YOUR ID...');
    const credentials = { email: email.value.trim(), password: password.value };
    const result = mode === 'signup'
      ? await supabase.auth.signUp({ ...credentials, options: { data: { display_name: displayName.value.trim(), username: displayName.value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_') } } })
      : await supabase.auth.signInWithPassword(credentials);

    submitButton.disabled = false;
    if (result.error) return setStatus(result.error.message, true);
    if (mode === 'signup' && !result.data.session) return setStatus('CHECK YOUR EMAIL TO VERIFY YOUR RICH ID');

    const activeSession = result.data.session;
    if (activeSession) {
      const chosenName = displayName.value.trim() || String(activeSession.user.user_metadata.display_name ?? activeSession.user.email?.split('@')[0] ?? 'Rich Member');
      await supabase.from('profiles').upsert({
        id: activeSession.user.id,
        display_name: chosenName,
        username: String(activeSession.user.user_metadata.username ?? chosenName.toLowerCase().replace(/[^a-z0-9_]+/g, '_')),
        online_status: 'online',
        has_avatar: false,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    }

    setStatus(`WELCOME ${esc(displayName.value.trim() || email.value.split('@')[0]).toUpperCase()}`);
    window.setTimeout(() => location.assign(next), 450);
  });

  document.querySelector<HTMLButtonElement>('#recoverButton')?.addEventListener('click', async () => {
    if (!email.value.trim()) return setStatus('ENTER YOUR EMAIL FIRST', true);
    setStatus('SENDING RESET LINK...');
    const { error } = await supabase.auth.resetPasswordForEmail(email.value.trim(), {
      redirectTo: `${location.origin}/tap-in.html?mode=recovery`
    });
    setStatus(error?.message ?? 'PASSWORD RESET LINK SENT', Boolean(error));
  });
}
