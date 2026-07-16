import { getAuthSnapshot } from '../auth/auth-store';
import { supabase } from '../supabase/client';

const REQUIRED_TAPS = 5;
const HOLD_MS = 900;
const TAP_WINDOW_MS = 2400;

function revealDoor(): void {
  if (document.querySelector('#rbAdminSecretDoor')) return;
  const door = document.createElement('div');
  door.id = 'rbAdminSecretDoor';
  door.innerHTML = '<div></div><section><small>FOUNDER AUTHORITY VERIFIED</small><strong>SECRET DOOR OPEN</strong><span>ENTERING ADMIN CORE</span></section>';
  const style = document.createElement('style');
  style.textContent = '#rbAdminSecretDoor{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 48%,rgba(49,255,99,.2),transparent 30%),linear-gradient(150deg,#071109,#000 72%);color:#fff;font-family:inherit;animation:rbAdminIn .4s ease both}#rbAdminSecretDoor>div{position:absolute;width:min(76vw,420px);aspect-ratio:1;border-radius:50%;border:1px solid rgba(247,201,72,.56);box-shadow:0 0 60px rgba(49,255,99,.38),inset 0 0 80px rgba(49,255,99,.22);animation:rbAdminSpin 2s linear infinite}#rbAdminSecretDoor>div:before,#rbAdminSecretDoor>div:after{content:"";position:absolute;border-radius:50%;border:1px dashed rgba(49,255,99,.52)}#rbAdminSecretDoor>div:before{inset:12%}#rbAdminSecretDoor>div:after{inset:30%;border-style:solid;border-color:rgba(247,201,72,.62);background:radial-gradient(circle,rgba(49,255,99,.5),rgba(0,0,0,.9) 66%)}#rbAdminSecretDoor section{position:relative;z-index:2;display:grid;gap:8px;text-align:center;text-shadow:0 4px 24px #000}#rbAdminSecretDoor small{color:#f7c948;font-size:.58rem;font-weight:950;letter-spacing:.2em}#rbAdminSecretDoor strong{font-size:clamp(1.5rem,7vw,3rem);font-weight:1000;letter-spacing:.08em}#rbAdminSecretDoor span{color:#31ff63;font-size:.62rem;font-weight:950;letter-spacing:.16em}@keyframes rbAdminIn{from{opacity:0;filter:blur(10px)}to{opacity:1;filter:none}}@keyframes rbAdminSpin{to{transform:rotate(360deg)}}';
  document.head.append(style);
  document.body.append(door);
  navigator.vibrate?.([35, 35, 80]);
  window.setTimeout(() => location.assign('/admin.html'), 720);
}

export async function mountAdminSecretDoor(): Promise<void> {
  if ((document.body.dataset.page ?? '') !== 'portal') return;
  if (!getAuthSnapshot().user) return;
  const trigger = document.querySelector<HTMLElement>('.portal-brand');
  if (!trigger) return;

  const { data: allowed, error } = await supabase.rpc('rb_is_admin', { p_min_permission: 1 });
  if (error || !allowed) return;

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