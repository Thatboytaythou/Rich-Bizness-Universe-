import { initializeAuth, getAuthSnapshot, subscribeAuth } from './core/auth/auth-store';
import { getPageRegistration } from './route-loader';

const BOOT_EPOCH_KEY='rbBootEpoch';

function currentRouteKey():string{
  return `${document.body.dataset.page??'home'}|${location.pathname}|${location.search}|${location.hash}`;
}

export async function bootstrap(): Promise<boolean> {
  const page = document.body.dataset.page ?? 'home';
  const registration = getPageRegistration(page);

  if (!registration) {
    throw new Error(`No page controller registered for ${page}`);
  }

  const app=document.querySelector<HTMLElement>('#app');
  if(!app)throw new Error('Missing #app mount');

  const routeKey=currentRouteKey();
  let bootEpoch=String(Date.now());
  try {
    bootEpoch=String(Number(sessionStorage.getItem(BOOT_EPOCH_KEY)??'0')+1);
    sessionStorage.setItem(BOOT_EPOCH_KEY,bootEpoch);
  } catch { /* private browsing/storage restrictions must not stop startup */ }

  // Bootstrap only guards route/auth/module loading. Route-loader alone owns
  // #app pageOwner/pageMounted/pageEpoch and the shared __rbPageCleanup lifecycle.
  app.dataset.routePage=page;
  app.dataset.routeKey=routeKey;
  app.dataset.bootEpoch=bootEpoch;

  const isCurrentBoot=()=>app.dataset.bootEpoch===bootEpoch&&app.dataset.routeKey===routeKey;

  if(page==='tap-in'||page==='home'){
    // Public Home and Tap In render immediately; their own subscriptions handle late sessions.
    void initializeAuth().catch(error=>console.warn('[Rich ID] session check failed',error));
  } else if (registration.auth !== 'public') {
    const auth = await initializeAuth();
    if(!isCurrentBoot())return false;
    if(registration.auth==='required'&&!auth.ready){
      // A network timeout is not a sign-out. Never mount private routes without auth.
      const panel=document.createElement('main');
      panel.setAttribute('role','status');
      panel.style.cssText='min-height:100svh;display:grid;place-content:center;gap:14px;padding:24px;color:#eff9ef;background:#07140d;font:16px/1.5 system-ui';
      const title=document.createElement('h1');title.textContent='Reconnecting your Rich ID';
      const info=document.createElement('p');info.textContent='The session check timed out. Your account and saved data have not been changed.';
      const retry=document.createElement('button');retry.type='button';retry.textContent='Retry connection';retry.style.cssText='padding:14px;border-radius:12px;background:#d5b961;color:#08130c;font-weight:800';retry.onclick=()=>location.reload();
      const signIn=document.createElement('a');signIn.textContent='Return to Tap In';signIn.href='/tap-in.html?next='+encodeURIComponent(location.pathname+location.search+location.hash);
      panel.append(title,info,retry,signIn);app.replaceChildren(panel);return false;
    }
    if (registration.auth === 'required' && !auth.user) {
      const next = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
      location.replace(`/tap-in.html?next=${next}`);
      return false;
    }
  }

  const module = await registration.load();
  if(!isCurrentBoot())return false;
  if(registration.auth==='required'){
    const owner=getAuthSnapshot().user?.id;
    if(!owner){location.replace('/tap-in.html?reason=session&next='+encodeURIComponent(location.pathname+location.search+location.hash));return false;}
    let leaving=false;const stop=subscribeAuth(state=>{
      if(!isCurrentBoot()||leaving||!state.ready)return;
      if(!state.user||state.user.id!==owner){leaving=true;app.hidden=true;const cleanup=(window as Window&{__rbPageCleanup?:()=>void|Promise<void>}).__rbPageCleanup;void Promise.resolve().then(()=>cleanup?.()).catch(()=>{});if(!state.user)location.replace('/tap-in.html?reason=session&next='+encodeURIComponent(location.pathname+location.search+location.hash));else location.reload();}
    });window.addEventListener('pagehide',stop,{once:true});
    if(leaving)return false;
  }
  await module.mount();
  if(!isCurrentBoot())return false;
  app.dataset.routePage=page;
  return !app.hidden&&app.dataset.pageMounted==='true'&&app.dataset.pageOwner===registration.owner;
}
