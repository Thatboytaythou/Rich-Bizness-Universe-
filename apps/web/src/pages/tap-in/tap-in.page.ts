import { safeInternalRoute } from '@rb/config/routes';
import { getAuthSnapshot, subscribeAuth, initializeAuth } from '../../core/auth/auth-store';
import { supabase } from '../../core/supabase/client';
import './tap-in.elite.css';

const OWNER = 'rich-bizness-tap-in-v2';
async function authDeadline<T>(request: PromiseLike<T>,ms=15000):Promise<T>{
 let timer=0;try{return await Promise.race([request,new Promise<never>((_,reject)=>{timer=window.setTimeout(()=>reject(new Error('Connection took too long. Check your connection and try again.')),ms);})]);}finally{window.clearTimeout(timer);}
}
const usernameFrom = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'rich_member';

export async function mountTapInPage(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) throw new Error('Missing #app mount');
  const mountEpoch = app.dataset.pageEpoch ?? '';
  let disposed = false;
  const isCurrent = () => !disposed && app.dataset.pageEpoch === mountEpoch && app.dataset.pageOwner === OWNER;
  if (app.dataset.pageOwner !== OWNER) return;

  const params = new URLSearchParams(location.search);
  const rawNext=safeInternalRoute(params.get('next'));
  const target=new URL(rawNext,location.origin);
  const next=target.origin===location.origin&&!/^\/tap-in(?:\.html)?\/?$/i.test(target.pathname)?target.pathname+target.search+target.hash:'/portal.html';
  const recoveryMode = params.get('mode') === 'recovery';
  const reason = params.get('reason');
  // Render the gateway before attempting any navigation.

  const controller = new AbortController();
  const { signal } = controller;
  let redirectTimer = 0;
  let unsubscribeAuth: (()=>void)|undefined;
  let navigating=false;

  app.innerHTML = `
    <main class="auth-shell" data-auth-state="ready">
      <div class="auth-media" aria-hidden="true"></div>
      <div class="auth-grid" aria-hidden="true"></div>
      <div class="auth-atmosphere" aria-hidden="true"><i></i><i></i><i></i></div>
      <a class="auth-back" href="/" aria-label="Back to Rich Bizness home">←</a>
      <section class="auth-visual">
        <div class="auth-mark"><span>RB</span><b></b><i></i></div>
        <p>RICH BIZNESS LLC • SECURE ACCESS</p>
        <h1>TAP INTO<br>YOUR EMPIRE.</h1>
        <span class="auth-visual-copy">One protected identity unlocks your full creator universe, avatar, XP, money, live rooms, messages, games and ownership tools.</span>
        <div class="auth-route-strip"><span>PROFILE LOCK</span><span>AVATAR</span><span>WE LIT 🔥</span><span>STORE</span><span>META</span></div>
      </section>
      <section class="auth-card">
        <div class="auth-card-scan" aria-hidden="true"></div>
        <header>
          <p class="eyebrow">RICH ID • GLOBAL ACCESS</p>
          <h2>${recoveryMode ? 'GET YOUR ACCESS BACK' : 'TAP IN'}</h2>
          <span>${recoveryMode ? 'Lock a new password to your verified Rich ID.' : 'One verified Rich ID controls your Portal, profile, avatar, XP, money, creator tools, rooms and the entire universe.'}</span>
        </header>
        ${recoveryMode ? `
          <form id="recoveryForm" class="auth-form">
            <label>NEW PASSWORD<div class="auth-input"><input id="newPassword" type="password" minlength="8" autocomplete="new-password" required placeholder="8 characters minimum"><button type="button" data-toggle-password="newPassword">SHOW</button></div></label>
            <button id="recoverySubmit" class="auth-primary" type="submit">LOCK IT IN</button>
          </form>
        ` : `
          <div class="auth-tabs" role="tablist" aria-label="Rich ID access mode">
            <button class="active" type="button" role="tab" aria-selected="true" data-auth-mode="signin">TAP IN</button>
            <button type="button" role="tab" aria-selected="false" data-auth-mode="signup">CREATE RICH ID</button>
          </div>
          <form id="authForm" class="auth-form">
            <label id="displayNameLabel" hidden>WHAT THEY CALL YOU?<div class="auth-input"><input id="displayName" name="displayName" autocomplete="name" maxlength="80" placeholder="ThatboyTayThou"></div></label>
            <label>EMAIL<div class="auth-input"><input id="email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" required placeholder="you@example.com"></div></label>
            <label>PASSWORD<div class="auth-input"><input id="password" name="password" type="password" required autocomplete="current-password" placeholder="8 characters minimum"><button type="button" data-toggle-password="password">SHOW</button></div></label>
            <button id="submitButton" class="auth-primary" type="submit">TAP IN</button>
            <button id="recoverButton" class="auth-link" type="button">I CAN’T GET IN</button>
          </form>
        `}
        <p id="authStatus" class="auth-status" role="status" aria-live="polite">${reason === 'session' ? 'YOUR SESSION EXPIRED — TAP BACK IN' : 'SECURE GATEWAY READY'}</p>
        <div style="display:grid;gap:8px;margin-top:14px;font-size:12px;color:#b9d3bd">
          <small>ACCESS RELEASE • rich-id-isolated-3</small>
          <small id="rbAccessNetwork" aria-live="polite">Connection: waiting for request</small>
          ${recoveryMode?'':'<button type="button" id="rbResumeSession" class="auth-link">CONTINUE EXISTING SESSION</button>'}
          <a href="" style="color:#e3ce86">Reload secure gateway</a>
        </div>
        <footer><span>PROFILE LOCK</span><i></i><span>VERIFIED SESSION</span><i></i><span>RICH LEVEL</span><i></i><span>EMPIRE</span></footer>
      </section>
    </main>`;

  const shell = app.querySelector<HTMLElement>('.auth-shell');
  const status = app.querySelector<HTMLParagraphElement>('#authStatus');
  if (!shell || !status) throw new Error('Tap In gateway failed to mount');

  const startup=document.getElementById('rb-access-startup');
  if(startup)startup.hidden=true;
  const net=app.querySelector<HTMLElement>('#rbAccessNetwork');
  const showNetwork=()=>{if(net)net.textContent='Connection: '+(document.body.dataset.rbAccessNetwork??'waiting for request');};
  window.addEventListener('rb-access-network',showNetwork,{signal});
  showNetwork();
  const setStatus = (message: string, error = false, busy = false) => {
    if (!isCurrent()) return;
    status.textContent = message;
    status.dataset.error = String(error);
    shell.dataset.authState = error ? 'error' : busy ? 'busy' : 'ready';
  };

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    controller.abort();
    if (redirectTimer) window.clearTimeout(redirectTimer);
    unsubscribeAuth?.();
  };
  (window as Window & { __rbPageCleanup?: (() => void | Promise<void>) | null }).__rbPageCleanup = cleanup;
  window.addEventListener('pagehide', cleanup, { once: true });
  // Do not dispose on beforeunload; cancelled navigation must leave the form functional.

  app.querySelectorAll<HTMLButtonElement>('[data-toggle-password]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!isCurrent()) return;
      const input = app.querySelector<HTMLInputElement>(`#${button.dataset.togglePassword}`);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      button.textContent = input.type === 'password' ? 'SHOW' : 'HIDE';
      button.setAttribute('aria-pressed', String(input.type === 'text'));
    }, { signal });
  });

  if (recoveryMode) {
    const form = app.querySelector<HTMLFormElement>('#recoveryForm');
    const password = app.querySelector<HTMLInputElement>('#newPassword');
    const submit = app.querySelector<HTMLButtonElement>('#recoverySubmit');
    if (!form || !password || !submit) throw new Error('Recovery form failed to mount');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!isCurrent() || !form.reportValidity()) return;
      submit.disabled = true;
      setStatus('LOCKIN’ YOUR NEW ACCESS...', false, true);
      try {const {error}=await authDeadline(supabase.auth.updateUser({password:password.value}));if(!isCurrent())return;if(error)return setStatus(error.message,true);setStatus('ACCESS LOCKED — YOU TAPPED IN');redirectTimer=window.setTimeout(()=>{if(isCurrent())location.replace(next);},500);}
      catch(error){setStatus(error instanceof Error?error.message:'Unable to update password. Try again.',true);}finally{if(isCurrent())submit.disabled=false;}
    }, { signal });
    return;
  }

  let mode: 'signin' | 'signup' = 'signin';
  let pending = false;
  const form = app.querySelector<HTMLFormElement>('#authForm');
  const email = app.querySelector<HTMLInputElement>('#email');
  const password = app.querySelector<HTMLInputElement>('#password');
  const displayName = app.querySelector<HTMLInputElement>('#displayName');
  const displayNameLabel = app.querySelector<HTMLElement>('#displayNameLabel');
  const submitButton = app.querySelector<HTMLButtonElement>('#submitButton');
  const recoverButton = app.querySelector<HTMLButtonElement>('#recoverButton');
  if (!form || !email || !password || !displayName || !displayNameLabel || !submitButton || !recoverButton) throw new Error('Tap In form failed to mount');

  const enter=()=>{
    if(!isCurrent()||navigating)return;
    navigating=true;setStatus('RICH ID VERIFIED — ENTERING YOUR UNIVERSE');
    submitButton.disabled=true;recoverButton.disabled=true;
    // Keep an actual link available even if Safari defers automatic navigation.
    const link=document.createElement('a');link.href=next;link.textContent='ENTER YOUR UNIVERSE';link.className='auth-primary';link.style.cssText='display:grid;place-items:center;margin-top:12px';status.after(link);
    redirectTimer=window.setTimeout(()=>{if(isCurrent())location.replace(next);},150);
  };
  const resume=app.querySelector<HTMLButtonElement>('#rbResumeSession');
  resume?.addEventListener('click',async()=>{
    if(!isCurrent()||pending||navigating)return;
    pending=true;resume.disabled=true;submitButton.disabled=true;recoverButton.disabled=true;
    setStatus('CHECKING EXISTING RICH ID...',false,true);
    try{
      const current=await authDeadline(initializeAuth(),12000);
      if(!isCurrent())return;
      if(!current.session||!current.user){setStatus('No verified session found. Tap in with your email and password.',true);return;}
      const verified=await authDeadline(supabase.auth.getUser(current.session.access_token),10000);
      if(verified.error||!verified.data.user){setStatus('Session could not be verified. Sign in again.',true);return;}
      enter();
    }catch{setStatus('Session check timed out. Reload this gateway or sign in again.',true);}
    finally{pending=false;if(isCurrent()&&!navigating){resume.disabled=false;submitButton.disabled=false;recoverButton.disabled=false;}}
  },{signal});
  unsubscribeAuth=subscribeAuth((current)=>{
    // Never redirect within an SDK auth event callback.
    if(current.session&&current.user&&reason!=='session'&&!pending)window.setTimeout(()=>{if(!pending&&getAuthSnapshot().session)enter();},0);
  });
  app.querySelectorAll<HTMLButtonElement>('[data-auth-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!isCurrent() || pending) return;
      mode = button.dataset.authMode === 'signup' ? 'signup' : 'signin';
      app.querySelectorAll<HTMLButtonElement>('[data-auth-mode]').forEach((node) => {
        const active = node === button;
        node.classList.toggle('active', active);
        node.setAttribute('aria-selected', String(active));
      });
      displayNameLabel.hidden = mode !== 'signup';
      displayName.required = mode === 'signup';
      password.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
      password.minLength=mode==='signup'?8:0;
      submitButton.textContent = mode === 'signup' ? 'BUILD MY RICH ID' : 'TAP IN';
      setStatus(mode === 'signup' ? 'BUILD YOUR VERIFIED PROFILE LOCK' : 'SECURE GATEWAY READY');
    }, { signal });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isCurrent() || pending || !form.reportValidity()) return;
    pending = true;
    submitButton.disabled = true;
    recoverButton.disabled = true;
    setStatus(mode === 'signup' ? 'BUILDIN’ YOUR RICH ID...' : 'VERIFYIN’ YOUR RICH ID...', false, true);

    const credentials = { email: email.value.trim().toLowerCase(), password: password.value };
    const chosenName = displayName.value.trim();
    const username = usernameFrom(chosenName || credentials.email.split('@')[0]);
    try {
      const result=await authDeadline(mode==='signup'
        ? supabase.auth.signUp({...credentials,options:{emailRedirectTo:`${location.origin}/tap-in.html?next=${encodeURIComponent(next)}`,data:{display_name:chosenName,username}}})
        : supabase.auth.signInWithPassword(credentials));
      if(!isCurrent())return;
      if(result.error)return setStatus(result.error.message,true);
      if(!result.data.session)return setStatus(mode==='signup'?'CHECK YOUR EMAIL — THEN TAP BACK IN':'No verified session returned. Please try again.',mode!=='signup');
      // No database, XP or profile request belongs in the login critical path.
      setStatus('RICH ID ACCEPTED — OPENING DESTINATION');
      enter();
    }catch(error){
      if(!isCurrent())return;
      setStatus('Sign-in did not complete. '+(document.body.dataset.rbAccessNetwork??'No auth request reached the browser network layer.')+' — retry or continue an existing session.',true);
    }finally{pending=false;if(isCurrent()&&!navigating){submitButton.disabled=false;recoverButton.disabled=false;}}
  }, { signal });

  recoverButton.addEventListener('click', async () => {
    if (!isCurrent() || pending) return;
    if (!email.value.trim()) return setStatus('DROP YOUR EMAIL FIRST', true);
    pending = true;
    recoverButton.disabled = true;
    submitButton.disabled = true;
    setStatus('SENDING YOUR GET-BACK-IN LINK...', false, true);
    const redirect = `${location.origin}/tap-in.html?mode=recovery&next=${encodeURIComponent(next)}`;
    try{const {error}=await authDeadline(supabase.auth.resetPasswordForEmail(email.value.trim().toLowerCase(),{redirectTo:redirect}));if(isCurrent())setStatus(error?.message??'CHECK YOUR EMAIL — YOUR LINK ON THE WAY',Boolean(error));}catch(error){setStatus(error instanceof Error?error.message:'Unable to send recovery link. Try again.',true);}finally{pending=false;if(isCurrent()&&!navigating){recoverButton.disabled=false;submitButton.disabled=false;}}
  }, { signal });
}
