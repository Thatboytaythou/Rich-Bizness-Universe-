import { initializeAuth } from './core/auth/auth-store';
import { getPageRegistration } from './route-loader';

const BOOT_EPOCH_KEY='rbBootEpoch';

function currentRouteKey():string{
  return `${document.body.dataset.page??'home'}|${location.pathname}|${location.search}|${location.hash}`;
}

function clearStaleRouteState():void{
  const app=document.querySelector<HTMLElement>('#app');
  if(!app)return;
  const expectedPage=document.body.dataset.page??'home';
  const previousPage=app.dataset.routePage;
  if(previousPage&&previousPage!==expectedPage){
    app.replaceChildren();
    delete app.dataset.pageOwner;
    delete app.dataset.pageMounted;
    delete app.dataset.routePage;
  }
}

export async function bootstrap(): Promise<void> {
  clearStaleRouteState();

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
  app.dataset.routePage=page;
  app.dataset.routeKey=routeKey;
  app.dataset.bootEpoch=bootEpoch;

  if (registration.auth !== 'public') {
    const auth = await initializeAuth();
    if(app.dataset.bootEpoch!==bootEpoch||app.dataset.routeKey!==routeKey)return;
    if (registration.auth === 'required' && !auth.user) {
      const next = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
      location.replace(`/tap-in.html?next=${next}`);
      return;
    }
  }

  const module = await registration.load();
  if(app.dataset.bootEpoch!==bootEpoch||app.dataset.routeKey!==routeKey)return;
  await module.mount();
  if(app.dataset.bootEpoch!==bootEpoch||app.dataset.routeKey!==routeKey)return;
  app.dataset.routePage=page;
}
