import { requireTapIn } from './rb-identity.js?v=tap-in-foundation-1';

const key = String(document.body?.dataset?.section || document.documentElement?.dataset?.section || '').replace(/\.html$/,'') || 'index';
const publicRoutes = new Set(['index','home','auth']);

async function bootTapInGuard(){
  if(publicRoutes.has(key)) return;
  const state = await requireTapIn({ next: location.pathname + location.search });
  if(!state) return;
  document.body.dataset.rbTapIn = 'ready';
  window.dispatchEvent(new CustomEvent('rb-tap-in-ready',{detail:{key, profile: state.profile}}));
}

bootTapInGuard().catch((error)=>console.warn('[RB Tap In guard]', error));
