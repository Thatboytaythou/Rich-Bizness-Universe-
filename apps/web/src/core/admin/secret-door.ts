import { getAuthSnapshot } from '../auth/auth-store';
import { supabase } from '../supabase/client';

const ADMIN_ROUTE = '/admin.html';
const REQUIRED_TAPS = 5;
const TAP_WINDOW_MS = 2_400;
const HOLD_MS = 900;

function revealDoor(): void {
  if (document.querySelector('#rbAdminSecretDoor')) return;

  const door = document.createElement('div');
  door.id = 'rbAdminSecretDoor';
  door.setAttribute('role', 'status');
  door.setAttribute('aria-live', 'assertive');
  door.innerHTML = `
    <div class="rb-admin-door__veil"></div>
    <div class="rb-admin-door__portal" aria-hidden="true"><i></i><i></i><i></i></div>
    <section class="rb-admin-door__copy">
      <small>FOUNDER AUTHORITY VERIFIED</small>
      <strong>SECRET DOOR OPEN</strong>
      <span>ENTERING ADMIN CORE</span>
    </section>`;

  const style = document.createElement('style');
  style.textContent = `
    #rbAdminSecretDoor{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;overflow:hidden;background:#010301;color:#fff;font-family:inherit;animation:rbDoorIn .45s ease both}
    .rb-admin-door__veil{position:absolute;inset:0;background:radial-gradient(circle at 50% 48%,rgba(49,255,99,.16),transparent 32%),radial-gradient(circle at 50% 50%,transparent 0 26%,rgba(0,0,0,.86) 70%),linear-gradient(150deg,#071109,#000 72%)}
    .rb-admin-door__portal{position:absolute;width:min(74vw,390px);aspect-ratio:1;border-radius:50%;border:1px solid rgba(247,201,72,.5);box-shadow:0 0 50px rgba(49,255,99,.35),inset 0 0 70px rgba(49,255,99,.24);animation:rbDoorSpin 2.2s linear infinite}
    .rb-admin-door__portal:before,.rb-admin-door__portal:after,.rb-admin-door__portal i{content:"";position:absolute;inset:8%;border-radius:50%;border:1px solid rgba(49,255,99,.48)}
    .rb-admin-door__portal:after{inset:22%;border-color:rgba(247,201,72,.62);box-shadow:0 0 34px rgba(247,201,72,.25)}
    .rb-admin-door__portal i:nth-child(1){inset:14%;border-style:dashed;animation:rbDoorReverse 1.5s linear infinite}
    .rb-admin-door__portal i:nth-child(2){inset:30%;background:radial-gradient(circle,rgba(49,255,99,.58),rgba(2,20,7,.88) 46%,#000 72%);box-shadow:0 0 58px rgba(49,255,99,.48)}
    .rb-admin-door__portal i:nth-child(3){inset:42%;background:#f7c948;border:0;box-shadow:0 0 30px #31ff63,0 0 60px rgba(247,201,72,.7)}
    .rb-admin-door__copy{position:relative;z-index:2;display:grid;gap:8px;text-align:center;text-shadow:0 4px 24px #000}
    .rb-admin-door__copy small{color:#f7c948;font-size:.58rem;font-weight:950;letter-spacing:.2em}
    .rb-admin-door__copy strong{font-size:clamp(1.5rem,7vw,3rem);font-weight:1000;letter-spacing:.08em}
    .rb-admin-door__copy span{color:#31ff63;font-size:.62rem;font-weight:950;letter-spacing:.16em}
    @keyframes rbDoorIn{from{opacity:0;filter:blur(10px)}to{opacity:1;filter:none}}
    @keyframes rbDoorSpin{to{transform:rotate(360deg)}}
    @keyframes rbDoorReverse{to{transform:rotate(-360deg)}}`;

  document.head.append(style);
  document.body.append(door);
  navigator.vibrate?.([35, 35, 80]);
  window.setTimeout(() => location.assign(ADMIN_ROUTE), 720);
}

export async function mountAdminSecretDoor(): Promise<void> {
  if ((document.body.dataset.page ?? '') !== 'portal') return;

  const user = getAuthSnapshot().user;
  const trigger = document.querySelector<HTMLElement>('.portal-brand');
  if (!user || !trigger) return;

  const { data: isAdmin, error } = await supabase.rpc('rb_is_admin', { p_min_permission: 1 });
  if (error || !isAdmin) return;

  trigger.dataset.adminDoor = 'armed';
  trigger.style.cursor = 'default';
  trigger.style.userSelect = 'none';
  trigger.style.webkitUserSelect = 'none';

  let tapCount = 0;
  let tapReset: number | null = null;
  let holdTimer: number | null = null;
  let opened = false;

  const open = () => {
    if (opened) return;
    opened = true;
    revealDoor();
  };

  const clearHold = () => {
    if (holdTimer !== null) window.clearTimeout(holdTimer);
    holdTimer = null;
  };

  const startHold = () => {
    clearHold();
    holdTimer = window.setTimeout(open, HOLD_MS);
  };

  const registerTap = () => {
    tapCount += 1;
    if (tapReset !== null) window.clearTimeout(tapReset);
    tapReset = window.setTimeout(() => { tapCount = 0; }, TAP_WINDOW_MS);
    if (tapCount >= REQUIRED_TAPS) open();
  };

  trigger.addEventListener('pointerdown', startHold);
  trigger.addEventListener('pointerup', clearHold);
  trigger.addEventListener('pointercancel', clearHold);
  trigger.addEventListener('pointerleave', clearHold);
  trigger.addEventListener('click', registerTap);
  trigger.addEventListener('contextmenu', (event) => event.preventDefault());

  window.addEventListener('beforeunload', () => {
    clearHold();
    if (tapReset !== null) window.clearTimeout(tapReset);
  }, { once: true });
}
