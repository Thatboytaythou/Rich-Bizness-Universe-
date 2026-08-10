import { initializeAuth } from './core/auth/auth-store';
import { getPageRegistration } from './route-loader';

const BOOT_EPOCH_KEY='rbBootEpoch';

function currentRouteKey():string{
  return `${document.body.dataset.page??'home'}|${location.pathname}|${location.search}|${location.hash}`;
}

export async function bootstrap(): Promise<void> {
  const page = document.body.dataset.page ?? 'home';
  const registration = getPageRegistration(page);

  if (!registration) {
    throw new Error(`No page controller registered for ${page}`);
  }

  const app=document.querySelector<HTMLElement>('#app');
  if(!app)throw new Error('Missing #app mount');

  const routeKey=currentRouteKey();
  const bootEpoch=String(Number(sessionStorage.getItem(BOOT_EPOCH_KEY)??'0')+1);
  sessionStorage.setItem(BOOT_EPOCH_KEY,bootEpoch);

  // Bootstrap only guards route/auth/module loading. Route-loader alone owns
  // #app pageOwner/pageMounted/pageEpoch and the shared __rbPageCleanup lifecycle.
  app.dataset.routePage=page;
  app.dataset.routeKey=routeKey;
  app.dataset.bootEpoch=bootEpoch;

  const isCurrentBoot=()=>app.dataset.bootEpoch===bootEpoch&&app.dataset.routeKey===routeKey;

  if (registration.auth !== 'public') {
    const auth = await initializeAuth();
    if(!isCurrentBoot())return;
    if (registration.auth === 'required' && !auth.user) {
      const next = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
      location.replace(`/tap-in.html?next=${next}`);
      return;
    }
  }

  const module = await registration.load();
  if(!isCurrentBoot())return;
  await module.mount();
  if(!isCurrentBoot())return;
  app.dataset.routePage=page;
}
