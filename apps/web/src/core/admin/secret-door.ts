import { getAuthSnapshot } from '../auth/auth-store';
import { supabase } from '../supabase/client';

const REQUIRED_TAPS = 5;
const HOLD_MS = 900;
const TAP_WINDOW_MS = 2400;

function revealDoor(): void {
  if (document.querySelector('#rbAdminSecretDoor')) return;
  const door = document.createElement('div');
  door.id = 'rbAdminSecretDoor';
  door.innerHTML = '<div class="rb-admin-core"></div><section><small>FOUNDER AUTHORITY VERIFIED</small><strong>SECRET DOOR OPEN</strong><span>ENTERING PRIVATE COMMAND NETWORK</span><nav><b>ON THE GO</b><b>DASH BUSINESSES</b><b>PRIVATE WORLD</b><b>MOVIES</b></nav></section>';
  const style = document.createElement('style');
  style.textContent = '#rbAdminSecretDoor{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 48%,rgba(49,255,99,.22),transparent 30%),linear-gradient(150deg,#071109,#000 72%);color:#fff;font-family:inherit;animation:rbAdminIn .4s ease both}#rbAdminSecretDoor .rb-admin-core{position:absolute;width:min(82vw,460px);aspect-ratio:1;border-radius:50%;border:1px solid rgba(247,201,72,.62);box-shadow:0 0 78px rgba(49,255,99,.42),inset 0 0 96px rgba(49,255,99,.24);animation:rbAdminSpin 8s linear infinite}#rbAdminSecretDoor .rb-admin-core:before,#rbAdminSecretDoor .rb-admin-core:after{content:"";position:absolute;border-radius:50%;border:1px dashed rgba(49,255,99,.58)}#rbAdminSecretDoor .rb-admin-core:before{inset:12%}#rbAdminSecretDoor .rb-admin-core:after{inset:30%;border-style:solid;border-color:rgba(247,201,72,.68);background:radial-gradient(circle,rgba(49,255,99,.52),rgba(0,0,0,.92) 66%)}#rbAdminSecretDoor section{position:relative;z-index:2;display:grid;gap:8px;text-align:center;text-shadow:0 4px 24px #000}#rbAdminSecretDoor small{color:#f7c948;font-size:.58rem;font-weight:950;letter-spacing:.2em}#rbAdminSecretDoor strong{font-size:clamp(1.5rem,7vw,3rem);font-weight:1000;letter-spacing:.08em}#rbAdminSecretDoor span{color:#31ff63;font-size:.58rem;font-weight:950;letter-spacing:.14em}#rbAdminSecretDoor nav{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:min(82vw,380px);margin:12px auto 0}#rbAdminSecretDoor nav b{display:grid;place-items:center;min-height:48px;padding:10px 8px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:linear-gradient(145deg,rgba(10,28,13,.86),rgba(0,0,0,.72));color:#fff;font-size:.48rem;letter-spacing:.1em;box-shadow:inset 0 0 18px rgba(49,255,99,.12),0 0 18px rgba(49,255,99,.08)}@keyframes rbAdminIn{from{opacity:0;filter:blur(10px)}to{opacity:1;filter:none}}@keyframes rbAdminSpin{to{transform:rotate(360deg)}}';
  document.head.append(style);
  document.body.append(door);
  navigator.vibrate?.([35, 35, 80]);
  window.setTimeout(() => location.assign('/admin.html'), 1250);
}

export async function mountAdminSecretDoor(): Promise<void> {
  if ((document.body.dataset.page ?? '') !== 'portal') return;
  if (!getAuthSnapshot().user) return;
  const trigger = document.querySelector<HTMLElement>('.portal-brand');
  if (!trigger || trigger.dataset.adminDoorMounted === 'true') return;

  const { data: allowed, error } = await supabase.rpc('rb_is_admin', { p_min_permission: 1 });
  if (error || !allowed) return;
  trigger.dataset.adminDoorMounted = 'true';

  let taps = 0;
  let tapReset: number | null = null;
  let holdTimer: number | null = null;
  let opened = false;
  const clearHold = () => { if (holdTimer !== null) window.clearTimeout(holdTimer); holdTimer = null; };
  const open = () => { if (opened) return; opened = true; revealDoor(); };
  const startHold = () => { clearHold(); holdTimer = window.setTimeout(open, HOLD_MS); };
  const registerTap = () => {
    taps += 1;
    if (tapReset !== null) window.clearTimeout(tapReset);
    tapReset = window.setTimeout(() => { taps = 0; }, TAP_WINDOW_MS);
    if (taps >= REQUIRED_TAPS) open();
  };

  trigger.addEventListener('pointerdown', startHold);
  trigger.addEventListener('pointerup', clearHold);
  trigger.addEventListener('pointercancel', clearHold);
  trigger.addEventListener('pointerleave', clearHold);
  trigger.addEventListener('click', registerTap);
  trigger.addEventListener('contextmenu', (event) => event.preventDefault());
}